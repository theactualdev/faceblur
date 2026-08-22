import { detectFacesInImageData } from "./faceDetectorClient"
import type { FaceRegion } from "./faceDetectionTypes"
import type { ProgressCallback } from "./faceDetectorClient"
import * as Stackblur from "stackblur-canvas";

export type { ProgressCallback } from "./faceDetectorClient";
export type { FaceRegion } from "./faceDetectionTypes";

// Blurring still runs here, so the browser needs an explicit chance to paint after
// each progress report or the bar jumps straight to 100. Deliberately a timer rather
// than requestAnimationFrame: rAF never fires in a backgrounded tab, which would
// stall processing until the user came back.
//
// A hidden tab throttles timers to roughly once a minute, which would drag the blur
// loop out for minutes. Nothing is painting then anyway, so fall back to a microtask.
const yieldToPaint = () =>
    document.hidden ? Promise.resolve() : new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Nothing revealed — every detected face gets blurred. This is the default everywhere. */
const NOTHING_REVEALED: ReadonlySet<number> = new Set<number>();

export type ProcessedImage = {
    /** JPEG data URL with every detected face blurred. */
    url: string;
    /** How many faces were found — 0 means the output is visually identical to the input. */
    faceCount: number;
    /** Face rectangles in original-image pixel coordinates, in a stable order. */
    faces: FaceRegion[];
    /** The untouched original, kept so a different subset can be re-blurred without re-detecting. */
    sourceUrl: string;
};

export type RenderResult = {
    url: string;
    /**
     * How many faces this render actually blurred. Derived from the render itself
     * rather than from the caller's intent, so the UI can never claim a face was
     * blurred when the renderer did not blur it.
     */
    blurredCount: number;
};

/**
 * Draws the source image and blurs every face except those in `revealed`.
 *
 * Always starts from the pristine source, so repeated toggling cannot compound blur
 * onto already-blurred pixels. Synchronous by design: blurring now costs roughly the
 * area of the faces rather than the whole frame, and a synchronous render means the
 * displayed bytes can never lag behind the selection that produced them.
 */
export function renderBlurred(
    source: HTMLImageElement,
    faces: readonly FaceRegion[],
    revealed: ReadonlySet<number> = NOTHING_REVEALED
): RenderResult {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas context");

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

    let blurredCount = 0;
    for (let i = 0; i < faces.length; i++) {
        if (revealed.has(i)) continue;
        const face = faces[i];
        blurRegion(canvas, face.x, face.y, face.width, face.height);
        blurredCount++;
    }

    return { url: canvas.toDataURL("image/jpeg", 0.95), blurredCount };
}

export async function processFace(file: File, onProgress?: ProgressCallback): Promise<ProcessedImage> {
    const report = (progress: number) => onProgress?.(progress);

    return new Promise<ProcessedImage>((resolve, reject) => {
        try{
            report(0);

            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Failed to read image file"));
            // Reading the file is the one stage the browser gives real byte counts for.
            reader.onprogress = (event) => {
                if (event.lengthComputable) {
                    report(Math.round((event.loaded / event.total) * 35));
                }
            };
            reader.onload = (event) => {
                if (!event.target?.result) {
                    reject(new Error("Failed to read image file"));
                    return;
                }

                report(35);

                const sourceUrl = event.target.result as string;
                const img = new Image();
                img.onerror = () => reject(new Error("That image could not be opened. Please try a different file."));
                img.src = sourceUrl;

                img.onload = () => {
                    (async () => {
                        const detectedFaces = await detectFaces(img, report);

                        report(70);
                        await yieldToPaint();

                        // Same render path the adjust screen uses, so the default
                        // result and an adjusted one can never diverge.
                        const { url } = renderBlurred(img, detectedFaces);

                        report(95);
                        await yieldToPaint();

                        report(100);
                        resolve({
                            url,
                            faceCount: detectedFaces.length,
                            faces: detectedFaces,
                            sourceUrl,
                        });
                    })().catch(reject);
                };
            };
            reader.readAsDataURL(file);
        } catch(error){
            reject(error);
        }
    })
}

export async function detectFaces(img: HTMLImageElement, onProgress?: ProgressCallback): Promise<FaceRegion[]> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Could not get canvas context");
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Detection, and the OpenCV compile it needs, happen on a worker thread.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return detectFacesInImageData(imageData, onProgress);
}

/**
 * Blurs one rectangle of the canvas in place.
 *
 * stackblur reads and writes only the given rect, so the full-frame offscreen copy
 * this used to make was redundant work — roughly 31MB of pixel traffic per face on a
 * large photo. Worse, that copy needed its own 2D context, and the old code returned
 * silently when it could not get one: the face stayed fully visible while still being
 * counted as blurred. Calling stackblur directly removes both the cost and that
 * silent-disclosure path, and it throws if the pixels cannot be read.
 */
const blurRegion = (
    canvas: HTMLCanvasElement,
    x: number,
    y: number,
    width: number,
    height: number,
    blurRadius: number = 80
) => {
    Stackblur.canvasRGBA(canvas, x, y, width, height, blurRadius);
};
