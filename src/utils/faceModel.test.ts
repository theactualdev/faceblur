import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { Cv } from "./opencv";

async function loadModule() {
    vi.resetModules();
    return import("./faceModel");
}

function fakeCv() {
    return {
        FS_createDataFile: vi.fn(),
        readNetFromONNX: vi.fn((path: string) => ({ net: true, path })),
    } as unknown as Cv;
}

function fetchOk() {
    return vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", arrayBuffer: async () => new ArrayBuffer(8) }));
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("loadFaceModel", () => {
    it("fetches the model only once across concurrent and repeated calls", async () => {
        const fetchMock = fetchOk();
        vi.stubGlobal("fetch", fetchMock);
        const { loadFaceModel } = await loadModule();
        const cv = fakeCv();

        await Promise.all([loadFaceModel(cv, "/"), loadFaceModel(cv, "/")]);
        await loadFaceModel(cv, "/");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        // Writing the same path into OpenCV's FS twice throws, so this must be once.
        expect(cv.FS_createDataFile).toHaveBeenCalledTimes(1);
    });

    it("resolves with the built network", async () => {
        vi.stubGlobal("fetch", fetchOk());
        const { loadFaceModel, MODEL_FILE } = await loadModule();
        const cv = fakeCv();

        const { net } = await loadFaceModel(cv, "/");

        expect(net).toMatchObject({ net: true, path: MODEL_FILE });
    });

    it("surfaces a friendly error when the model cannot be fetched", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" })));
        const { loadFaceModel } = await loadModule();

        await expect(loadFaceModel(fakeCv(), "/")).rejects.toThrow(/could not load the face detection model/i);
    });

    it("allows a retry after a failed load", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, statusText: "Server Error" })));
        const { loadFaceModel } = await loadModule();
        const cv = fakeCv();

        await expect(loadFaceModel(cv, "/")).rejects.toThrow();

        vi.stubGlobal("fetch", fetchOk());
        await expect(loadFaceModel(cv, "/")).resolves.toBeDefined();
    });
});
