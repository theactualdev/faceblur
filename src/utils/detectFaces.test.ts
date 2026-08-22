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
    // canvasRGBA is a module-level vi.fn(); restoreAllMocks does not reset it, so its
    // call log would otherwise leak between tests and make assertions meaningless.
    vi.clearAllMocks();
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

    it("reports the render stage once, not per face", async () => {
        // Blurring is now a single synchronous render rather than an awaited loop,
        // so there is no longer a per-face progress band to report.
        detected = [
            { x: 1, y: 1, width: 10, height: 10 },
            { x: 40, y: 40, width: 10, height: 10 },
        ];
        const { processFace } = await loadModule();

        const seq: number[] = [];
        await processFace(new File(["x"], "a.png", { type: "image/png" }), (p) => seq.push(p));

        expect(seq).toEqual(expect.arrayContaining([70, 95, 100]));
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

describe("renderBlurred — selective blur", () => {
    /** A stand-in source image; renderBlurred only reads width/height and draws it. */
    const source = { width: 100, height: 80 } as unknown as HTMLImageElement;

    const FACES = [
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 20, y: 20, width: 10, height: 10 },
        { x: 40, y: 40, width: 10, height: 10 },
    ];

    /** The rectangles actually handed to stackblur, in order. */
    async function blurredRects() {
        const { canvasRGBA } = await import("stackblur-canvas");
        return (canvasRGBA as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => ({
            x: c[1],
            y: c[2],
            width: c[3],
            height: c[4],
        }));
    }

    it("blurs every face when nothing is revealed — the default is unchanged", async () => {
        const { renderBlurred } = await loadModule();

        const result = renderBlurred(source, FACES);

        expect(result.blurredCount).toBe(3);
        expect(await blurredRects()).toEqual(FACES);
    });

    it("skips exactly the revealed faces", async () => {
        const { renderBlurred } = await loadModule();

        const result = renderBlurred(source, FACES, new Set([1]));

        expect(result.blurredCount).toBe(2);
        expect(await blurredRects()).toEqual([FACES[0], FACES[2]]);
    });

    it("reports what it actually blurred, so the UI cannot overstate it", async () => {
        const { renderBlurred } = await loadModule();

        expect(renderBlurred(source, FACES, new Set([0, 1, 2])).blurredCount).toBe(0);
    });

    it("ignores revealed indices that do not correspond to a face", async () => {
        const { renderBlurred } = await loadModule();

        const result = renderBlurred(source, FACES, new Set([99]));

        expect(result.blurredCount).toBe(3);
    });

    it("redraws the pristine source every render so toggling cannot compound blur", async () => {
        const { renderBlurred } = await loadModule();
        const ctx = (document.createElement("canvas") as HTMLCanvasElement).getContext("2d");
        const drawImage = ctx?.drawImage as unknown as { mock: { calls: unknown[][] } };
        drawImage.mock.calls.length = 0;

        renderBlurred(source, FACES, new Set([0]));
        renderBlurred(source, FACES, new Set([1]));

        // One full redraw of the untouched source per render — never a re-blur of
        // whatever the previous render left behind.
        expect(drawImage.mock.calls.length).toBe(2);
        expect(drawImage.mock.calls.every((c) => c[0] === source)).toBe(true);
    });
});
