export type FaceRegion = { x: number; y: number; width: number; height: number };

export type WorkerRequest = {
    id: number;
    width: number;
    height: number;
    buffer: ArrayBuffer;
};

export type WorkerResponse =
    | { type: "progress"; id: number; value: number }
    | { type: "result"; id: number; faces: FaceRegion[] }
    | { type: "error"; id: number; message: string };
