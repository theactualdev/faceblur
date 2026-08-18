import { detectFacesInImageData } from "./faceDetectorClient"
import type { FaceRegion } from "./faceDetectionTypes"
import type { ProgressCallback } from "./faceDetectorClient"

export type { ProgressCallback } from "./faceDetectorClient";

// Blurring still runs here, so the browser needs an explicit chance to paint after
// each progress report or the bar jumps straight to 100. Deliberately a timer rather
// than requestAnimationFrame: rAF never fires in a backgrounded tab, which would
// stall processing until the user came back.
//
// A hidden tab throttles timers to roughly once a minute, which would drag the blur
// loop out for minutes. Nothing is painting then anyway, so fall back to a microtask.
const yieldToPaint = () =>
    document.hidden ? Promise.resolve() : new Promise<void>((resolve) => setTimeout(resolve, 0));


export async function processFace(file: File, onProgress?: ProgressCallback): Promise<string> {
    const report = (progress: number) => onProgress?.(progress);

    return new Promise((resolve, reject) => {
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

                const img = new Image();
                img.onerror = () => reject(new Error("That image could not be opened. Please try a different file."));
                img.src = event.target.result as string;

                img.onload = () => {
                    (async () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = img.width;
                        canvas.height = img.height;
                        const ctx = canvas.getContext("2d");

                        if (!ctx) {
                            reject(new Error("Could not get canvas context"));
                            return;
                        }

                        const detectedFaces = await detectFaces(img, report);

                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        report(70);
                        await yieldToPaint();

                        for (let i = 0; i < detectedFaces.length; i++) {
                            const face = detectedFaces[i];
                            blurRegion(ctx, canvas, face.x, face.y, face.width, face.height);
                            report(70 + Math.round(((i + 1) / detectedFaces.length) * 22));
                            await yieldToPaint();
                        }

                        report(95);
                        await yieldToPaint();

                        const processedImageUrl = canvas.toDataURL("image/jpeg", 0.95);
                        report(100);
                        resolve(processedImageUrl);
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

import * as Stackblur from "stackblur-canvas";

const blurRegion = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number, blurRadius: number = 80) => {
    ctx.save();

    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const offscreenCtx = offscreenCanvas.getContext("2d");

    if (!offscreenCtx) {
        console.error("Could not get offscreen canvas context");
        return;
    }

    offscreenCtx.drawImage(canvas, 0, 0);

    Stackblur.canvasRGBA(offscreenCanvas, x, y, width, height, blurRadius);

    ctx.drawImage(offscreenCanvas, x, y, width, height, x, y, width, height);

    ctx.restore();
}
