import type { FaceRegion, WorkerResponse } from "./faceDetectionTypes";

export type ProgressCallback = (progress: number) => void;

// Created on first use and kept alive, so OpenCV is compiled once per session.
// Nothing in this file imports OpenCV, which keeps it out of the main bundle.
let worker: Worker | null = null;
let nextRequestId = 0;

function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(new URL("./faceWorker.ts", import.meta.url), { type: "module" });
    }

    return worker;
}

export function detectFacesInImageData(
    imageData: ImageData,
    onProgress?: ProgressCallback
): Promise<FaceRegion[]> {
    return new Promise((resolve, reject) => {
        const activeWorker = getWorker();
        const id = nextRequestId++;

        const cleanup = () => {
            activeWorker.removeEventListener("message", onMessage);
            activeWorker.removeEventListener("error", onError);
        };

        const onMessage = (event: MessageEvent<WorkerResponse>) => {
            const data = event.data;
            if (data.id !== id) return; // a stale response from an earlier image

            if (data.type === "progress") {
                onProgress?.(data.value);
                return;
            }

            cleanup();

            if (data.type === "result") {
                resolve(data.faces);
            } else {
                reject(new Error(data.message));
            }
        };

        const onError = () => {
            cleanup();
            // A worker that failed to start is not reusable.
            worker?.terminate();
            worker = null;
            reject(new Error("Could not start face detection. Please reload and try again."));
        };

        activeWorker.addEventListener("message", onMessage);
        activeWorker.addEventListener("error", onError);

        // The pixel buffer is transferred rather than copied; imageData belongs to a
        // throwaway canvas, so giving up ownership is safe.
        const buffer = imageData.data.buffer as ArrayBuffer;
        activeWorker.postMessage(
            { id, width: imageData.width, height: imageData.height, buffer },
            [buffer]
        );
    });
}
