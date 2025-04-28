import cv from "@techstark/opencv-js"
import { loadDataFile } from "./loadDataFIle"

type FaceRegion = { x: number; y: number; width: number; height: number };

export async function loadFaceModels(){
    try{
        await loadDataFile("haarcascade_frontalface_default.xml", "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_default.xml")
    } catch (error) {
        console.error("Error loading face models:", error)
    }
}


export async function processFace(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        try{
            const reader = new FileReader();
            reader.onload = (event) => {
                if (!event.target?.result) {
                    reject(new Error("Failed to read image file"));
                    return;
                }

                const img = new Image();
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

                        const detectedFaces = await detectFaces(img);

                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                        detectedFaces.forEach((face) => {
                            blurRegion(ctx, canvas, face.x, face.y, face.width, face.height);
                        });

                        const processedImageUrl = canvas.toDataURL("image/jpeg", 0.95);
                        resolve(processedImageUrl);
                    })();
                };
            };
            reader.readAsDataURL(file);
        } catch(error){
            reject(error);
        }
    })
}

export async function detectFaces(img: HTMLImageElement): Promise<FaceRegion[]> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
        throw new Error("Could not get canvas context");
    }

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    await loadFaceModels();

    const faceCascade = new cv.CascadeClassifier();
    faceCascade.load("haarcascade_frontalface_default.xml");

    const faces = new cv.RectVector();
    const msize = new cv.Size(0, 0);
    faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0, msize, msize);

    const faceRegions: FaceRegion[] = [];
    for (let i = 0; i < faces.size(); i++) {
        const face = faces.get(i);
        faceRegions.push({ x: face.x, y: face.y, width: face.width, height: face.height });
    }

    src.delete();
    gray.delete();
    faces.delete();
    faceCascade.delete();

    return faceRegions;
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