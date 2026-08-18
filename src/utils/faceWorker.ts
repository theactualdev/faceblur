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
    keepWithinRegion,
    nonMaxSuppression,
    scaleDetections,
    YUNET_STRIDES,
    type StrideOutput,
} from "./yunetDecode";
import type { FaceRegion, WorkerRequest, WorkerResponse } from "./faceDetectionTypes";

const SCORE_THRESHOLD = 0.6;
const NMS_IOU_THRESHOLD = 0.3;

// YuNet is trained on WIDER FACE, where faces are small-to-medium relative to the
// frame. A face filling most of the shot is out of distribution and is missed
// entirely — measured: found at <=40% frame coverage, missed at >=60%. A close-up
// selfie is exactly what this app gets uploaded, so a second pass renders the image
// small inside a padded blob, which brings an oversized face back into range.
const SECOND_PASS_FRACTION = 0.35;

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

    // This build only binds forward() and forward(name); the multi-output overload
    // is unavailable, so each head is pulled by name.
    const network = net as {
        setInput: (b: unknown) => void;
        forward: (name: string) => { data32F: Float32Array; delete: () => void };
    };

    /**
     * Runs the network once. A fraction of 1 fills the blob with the image; anything
     * smaller renders it into the top-left corner of an otherwise black blob, which
     * shrinks the apparent face size. Returns boxes in original-image coordinates.
     */
    const runPass = (fraction: number): ReturnType<typeof scaleDetections> => {
        const contentW = Math.max(1, Math.round(input.width * fraction));
        const contentH = Math.max(1, Math.round(input.height * fraction));

        let source = bgr;
        let resized: typeof bgr | null = null;
        let padded: typeof bgr | null = null;
        let blob: { delete: () => void } | null = null;

        try {
            if (fraction !== 1) {
                resized = new ready.Mat();
                ready.resize(bgr, resized, new ready.Size(contentW, contentH), 0, 0, ready.INTER_AREA);

                padded = new ready.Mat();
                ready.copyMakeBorder(
                    resized,
                    padded,
                    0,
                    input.height - contentH,
                    0,
                    input.width - contentW,
                    ready.BORDER_CONSTANT,
                    new ready.Scalar(0, 0, 0, 0)
                );
                source = padded;
            }

            blob = ready.blobFromImage(
                source,
                1.0,
                new ready.Size(input.width, input.height),
                new ready.Scalar(0, 0, 0),
                false,
                false
            );
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
                cls: readHead("cls_" + stride),
                obj: readHead("obj_" + stride),
                bbox: readHead("bbox_" + stride),
            }));

            let decoded = decodeYunet(strideOutputs, input.width, input.height, SCORE_THRESHOLD);

            // Drop anything the network reported out in the padding.
            if (fraction !== 1) decoded = keepWithinRegion(decoded, contentW, contentH);

            return scaleDetections(decoded, width / contentW, height / contentH);
        } finally {
            blob?.delete();
            resized?.delete();
            padded?.delete();
        }
    };

    try {
        src.data.set(pixels);
        // YuNet was trained on BGR without mean subtraction.
        ready.cvtColor(src, bgr, ready.COLOR_RGBA2BGR, 0);

        // Two scales: the full frame catches ordinary and small faces, the reduced
        // one catches faces too large for the model to recognise at full size.
        const found = [...runPass(1), ...runPass(SECOND_PASS_FRACTION)];

        post({ type: "progress", id, value: 68 });

        const kept = nonMaxSuppression(found, NMS_IOU_THRESHOLD);

        return clipToImage(kept, width, height).map(({ x, y, width: w, height: h }) => ({
            x,
            y,
            width: w,
            height: h,
        }));
    } finally {
        src.delete();
        bgr.delete();
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
