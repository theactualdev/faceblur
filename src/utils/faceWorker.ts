/// <reference lib="webworker" />
//
// Runs face detection off the main thread. OpenCV is imported here and nowhere on
// the main thread, so neither its ~10MB compile nor inference blocks the UI.
import cv from "@techstark/opencv-js";
import { whenRuntimeReady } from "./opencv";
import { loadFaceModel } from "./faceModel";
import {
    clipToImage,
    decodeYunet,
    detectionInputSize,
    nonMaxSuppression,
    scaleDetections,
    YUNET_STRIDES,
    type StrideOutput,
} from "./yunetDecode";
import type { FaceRegion, WorkerRequest, WorkerResponse } from "./faceDetectionTypes";

const SCORE_THRESHOLD = 0.6;
const NMS_IOU_THRESHOLD = 0.3;

const post = (message: WorkerResponse) =>
    (self as unknown as { postMessage: (m: WorkerResponse) => void }).postMessage(message);

async function detect(id: number, width: number, height: number, pixels: Uint8Array): Promise<FaceRegion[]> {
    post({ type: "progress", id, value: 40 });

    // Waiting for the WebAssembly runtime is the slow part on a cold start.
    const { cv: ready } = await whenRuntimeReady(cv);
    const { net } = await loadFaceModel(ready, self.location.origin + import.meta.env.BASE_URL);

    post({ type: "progress", id, value: 55 });

    const input = detectionInputSize(width, height);

    const src = new ready.Mat(height, width, ready.CV_8UC4);
    const bgr = new ready.Mat();
    let blob: { delete: () => void } | null = null;

    try {
        src.data.set(pixels);
        // YuNet was trained on BGR without mean subtraction.
        ready.cvtColor(src, bgr, ready.COLOR_RGBA2BGR, 0);

        blob = ready.blobFromImage(
            bgr,
            1.0,
            new ready.Size(input.width, input.height),
            new ready.Scalar(0, 0, 0),
            false,
            false
        );

        // This build only binds forward() and forward(name); the multi-output
        // overload is unavailable, so each head is pulled by name.
        const network = net as {
            setInput: (b: unknown) => void;
            forward: (name: string) => { data32F: Float32Array; delete: () => void };
        };
        network.setInput(blob);

        const readHead = (name: string): Float32Array => {
            const mat = network.forward(name);
            try {
                // Copied out immediately: a later forward() can grow the wasm heap
                // and detach views onto the previous buffer.
                return Float32Array.from(mat.data32F);
            } finally {
                mat.delete();
            }
        };

        const strideOutputs: StrideOutput[] = YUNET_STRIDES.map((stride) => ({
            stride,
            cls: readHead(`cls_${stride}`),
            obj: readHead(`obj_${stride}`),
            bbox: readHead(`bbox_${stride}`),
        }));

        const decoded = decodeYunet(strideOutputs, input.width, input.height, SCORE_THRESHOLD);
        post({ type: "progress", id, value: 68 });

        const scaled = scaleDetections(decoded, width / input.width, height / input.height);
        const kept = nonMaxSuppression(scaled, NMS_IOU_THRESHOLD);

        return clipToImage(kept, width, height).map(({ x, y, width: w, height: h }) => ({ x, y, width: w, height: h }));
    } finally {
        src.delete();
        bgr.delete();
        blob?.delete();
    }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
    const { id, width, height, buffer } = event.data;

    try {
        const faces = await detect(id, width, height, new Uint8Array(buffer));
        post({ type: "result", id, faces });
    } catch (error) {
        post({
            type: "error",
            id,
            message: error instanceof Error ? error.message : "Face detection failed. Please try again.",
        });
    }
};
