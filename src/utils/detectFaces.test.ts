import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { FaceRegion } from "./faceDetectionTypes";

// Faces the mocked worker client will return for the next processFace call.
let detected: FaceRegion[] = [];
// Whether the stubbed Image decodes successfully.
let imageDecodes = true;
// Error the mocked client should reject with, if any.
let detectionError: Error | null = null;

vi.mock("stackblur-canvas", () => ({ canvasRGBA: vi.fn() }));

// detectFaces now delegates to the worker; OpenCV never touches the main thread.
vi.mock("./faceDetectorClient", () => ({
    detectFacesInImageData: vi.fn(async (_data: ImageData, onProgress?: (p: number) => void) => {
        if (detectionError) throw detectionError;
        // Mirrors the progress the real worker posts.
        onProgress?.(40);
        onProgress?.(55);
        onProgress?.(68);
        return detected;
    }),
}));

function stubImage() {
    class StubImage {
        width = 100;
        height = 80;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
            // Must fire asynchronously: processFace assigns onload *after* src.
            setTimeout(() => {
                if (imageDecodes) this.onload?.();
                else this.onerror?.();
            }, 0);
        }
    }

    vi.stubGlobal("Image", StubImage);
}

function stubCanvas() {
    const ctx = {
        clearRect: vi.fn(),
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 })),
        save: vi.fn(),
        restore: vi.fn(),
    };

    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
        if (tag !== "canvas") return realCreateElement(tag);
        return {
            width: 0,
            height: 0,
            getContext: () => ctx,
            toDataURL: () => "data:image/jpeg;base64,stub",
        } as unknown as HTMLCanvasElement;
    });
}

async function loadModule() {
    vi.resetModules();
    return import("./detectFaces");
}

beforeEach(() => {
    detected = [];
    imageDecodes = true;
    detectionError = null;
    stubImage();
    stubCanvas();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("processFace progress reporting", () => {
    it("emits a non-decreasing sequence that starts at 0 and ends at 100", async () => {
        const { processFace } = await loadModule();

        const seq: number[] = [];
        await processFace(new File(["x"], "a.png", { type: "image/png" }), (p) => seq.push(p));

        expect(seq[0]).toBe(0);
        expect(seq[seq.length - 1]).toBe(100);
        expect(seq).toEqual([...seq].sort((a, b) => a - b));
        expect(seq.every((p) => p >= 0 && p <= 100)).toBe(true);
    });

    it("relays the worker's detection progress", async () => {
        const { processFace } = await loadModule();

        const seq: number[] = [];
        await processFace(new File(["x"], "a.png", { type: "image/png" }), (p) => seq.push(p));

        expect(seq).toEqual(expect.arrayContaining([40, 55, 68]));
    });

    it("reports the blur band once per detected face, ending at 92", async () => {
        detected = [
            { x: 1, y: 1, width: 10, height: 10 },
            { x: 40, y: 40, width: 10, height: 10 },
        ];
        const { processFace } = await loadModule();

        const seq: number[] = [];
        await processFace(new File(["x"], "a.png", { type: "image/png" }), (p) => seq.push(p));

        expect(seq.filter((p) => p > 70 && p <= 92)).toEqual([81, 92]);
    });
});

describe("processFace error handling", () => {
    it("rejects instead of hanging when the image cannot be decoded", async () => {
        imageDecodes = false;
        const { processFace } = await loadModule();

        await expect(
            processFace(new File(["x"], "broken.png", { type: "image/png" }))
        ).rejects.toThrow(/could not be opened/i);
    });

    it("surfaces the worker's error message", async () => {
        detectionError = new Error("Could not load the face detection model. Please check your connection and try again.");
        const { processFace } = await loadModule();

        await expect(
            processFace(new File(["x"], "a.png", { type: "image/png" }))
        ).rejects.toThrow(/could not load the face detection model/i);
    });
});

describe("processFace result", () => {
    it("reports zero faces so the UI can show an honest empty state", async () => {
        detected = [];
        const { processFace } = await loadModule();

        const result = await processFace(new File(["x"], "a.png", { type: "image/png" }));

        expect(result.faceCount).toBe(0);
        expect(result.url).toMatch(/^data:image\/jpeg/);
    });

    it("reports how many faces were blurred", async () => {
        detected = [
            { x: 1, y: 1, width: 10, height: 10 },
            { x: 40, y: 40, width: 10, height: 10 },
        ];
        const { processFace } = await loadModule();

        const result = await processFace(new File(["x"], "a.png", { type: "image/png" }));

        expect(result.faceCount).toBe(2);
    });
});
