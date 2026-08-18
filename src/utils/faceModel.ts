import type { Cv } from "./opencv"
import { loadDataFile } from "./loadDataFile"

export const MODEL_FILE = "face_detection_yunet_2023mar.onnx";

/** Boxed for the same reason as CvHandle — never resolve a promise with a bare embind object. */
export type NetHandle = { net: unknown };

// The model only needs writing into OpenCV's virtual FS once per worker, and the
// network only needs building once. Writing the file twice throws, so the in-flight
// promise is shared by every caller.
let modelPromise: Promise<NetHandle> | null = null;

export function loadFaceModel(cv: Cv, baseUrl: string): Promise<NetHandle> {
    if (!modelPromise) {
        modelPromise = loadDataFile(cv, MODEL_FILE, `${baseUrl}${MODEL_FILE}`)
            .then(() => ({ net: (cv as unknown as { readNetFromONNX: (p: string) => unknown }).readNetFromONNX(MODEL_FILE) }))
            .catch((error) => {
                modelPromise = null; // let the next attempt retry
                console.error("Error loading face model:", error);
                throw new Error("Could not load the face detection model. Please check your connection and try again.");
            });
    }

    return modelPromise;
}

/** Test seam: drops the memoized model so each test starts clean. */
export function resetFaceModelForTests(): void {
    modelPromise = null;
}
