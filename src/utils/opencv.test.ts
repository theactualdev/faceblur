import { describe, expect, it, vi, afterEach } from "vitest";
import { whenRuntimeReady } from "./opencv";
import type { Cv } from "./opencv";

afterEach(() => {
    vi.useRealTimers();
});

/**
 * A stand-in for the OpenCV module: thenable (as the real one is) and gaining its
 * embind classes only after the runtime "initialises".
 */
function fakeCv(readyAfterMs: number | null) {
    const bag: Record<string, unknown> = {
        imread: () => {},
        // The real module exposes `then`, which is exactly the trap this module avoids.
        then: () => {
            throw new Error("the thenable must never be adopted");
        },
    };

    if (readyAfterMs !== null) setTimeout(() => { bag.Mat = class {}; }, readyAfterMs);

    return bag as unknown as Cv;
}

describe("whenRuntimeReady", () => {
    it("resolves immediately when cv.Mat already exists", async () => {
        const cv = fakeCv(null);
        (cv as unknown as Record<string, unknown>).Mat = class {};

        await expect(whenRuntimeReady(cv)).resolves.toMatchObject({ cv });
    });

    it("waits for cv.Mat to appear", async () => {
        const cv = fakeCv(300);

        const { cv: resolved } = await whenRuntimeReady(cv);

        expect(typeof (resolved as unknown as Record<string, unknown>).Mat).toBe("function");
    });

    it("hands back a box rather than the thenable itself", async () => {
        // Resolving a promise *with* the module would adopt its `then` and hang
        // forever; the box keeps it inert.
        const cv = fakeCv(0);

        const handle = await whenRuntimeReady(cv);

        expect(handle).toHaveProperty("cv");
        expect(handle.cv).toBe(cv);
    });

    it("rejects rather than hanging if the runtime never starts", async () => {
        vi.useFakeTimers();
        const cv = fakeCv(null);

        const pending = whenRuntimeReady(cv);
        const assertion = expect(pending).rejects.toThrow(/did not start in time/i);

        await vi.advanceTimersByTimeAsync(121_000);
        await assertion;
    });
});
