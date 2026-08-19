// Decoding for the YuNet (face_detection_yunet_2023mar) detection heads.
//
// This build of opencv.js does not expose cv.FaceDetectorYN, so the raw network
// outputs are decoded here by hand. Everything in this file is pure so it can be
// unit-tested without loading OpenCV.

export type Detection = { x: number; y: number; width: number; height: number; score: number };

/** Raw per-stride outputs. cls/obj hold one value per cell, bbox holds four. */
export type StrideOutput = {
    stride: number;
    cls: ArrayLike<number>;
    obj: ArrayLike<number>;
    bbox: ArrayLike<number>;
};

export const YUNET_STRIDES = [8, 16, 32] as const;

// YuNet's deepest stride is 32, so both input dimensions must be a multiple of it.
const STRIDE_ALIGNMENT = 32;
// Detection runs on a bounded copy. Inference cost scales with input AREA, so this
// cap dominates latency. Measured against four group photos at 1024/768/512/384:
// every image with 1-4 faces was detected correctly at every cap, and only a dense
// ~18-face crowd degraded (18/17/16/14). 512 costs 0.21x of 1024 for no measured
// loss on ordinary photos, which is the trade this app wants.
const MAX_DETECTION_SIDE = 512;

/** Rounds up to the next multiple of the stride alignment, never below one cell. */
function alignUp(value: number): number {
    return Math.max(STRIDE_ALIGNMENT, Math.ceil(value / STRIDE_ALIGNMENT) * STRIDE_ALIGNMENT);
}

/** Picks the stride-aligned blob size that detection runs at. */
export function detectionInputSize(width: number, height: number): { width: number; height: number } {
    const scale = Math.min(1, MAX_DETECTION_SIDE / Math.max(width, height));
    return { width: alignUp(width * scale), height: alignUp(height * scale) };
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Turns the network outputs into boxes in *input-blob* pixel coordinates.
 *
 * YuNet is anchor-free: each cell of a stride's feature map predicts a centre
 * offset and a log-scale size, both relative to that cell and stride.
 */
export function decodeYunet(
    outputs: StrideOutput[],
    inputWidth: number,
    inputHeight: number,
    scoreThreshold = 0.6
): Detection[] {
    const detections: Detection[] = [];

    for (const { stride, cls, obj, bbox } of outputs) {
        const cols = Math.floor(inputWidth / stride);
        const rows = Math.floor(inputHeight / stride);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const i = r * cols + c;

                // The two heads are trained jointly; the geometric mean is what
                // OpenCV's own YuNet implementation uses as the final score.
                const score = Math.sqrt(clamp01(cls[i] ?? 0) * clamp01(obj[i] ?? 0));
                if (score < scoreThreshold) continue;

                const cx = (c + bbox[i * 4]) * stride;
                const cy = (r + bbox[i * 4 + 1]) * stride;
                const w = Math.exp(bbox[i * 4 + 2]) * stride;
                const h = Math.exp(bbox[i * 4 + 3]) * stride;

                detections.push({ x: cx - w / 2, y: cy - h / 2, width: w, height: h, score });
            }
        }
    }

    return detections;
}

function iou(a: Detection, b: Detection): number {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.width, b.x + b.width);
    const y2 = Math.min(a.y + a.height, b.y + b.height);

    const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    if (overlap === 0) return 0;

    return overlap / (a.width * a.height + b.width * b.height - overlap);
}

/** Greedy non-maximum suppression, highest score first. */
export function nonMaxSuppression(detections: Detection[], iouThreshold = 0.3): Detection[] {
    const ordered = [...detections].sort((a, b) => b.score - a.score);
    const kept: Detection[] = [];

    for (const candidate of ordered) {
        if (kept.every((k) => iou(k, candidate) <= iouThreshold)) {
            kept.push(candidate);
        }
    }

    return kept;
}

/** Maps boxes from input-blob coordinates back onto the original image. */
export function scaleDetections(detections: Detection[], scaleX: number, scaleY: number): Detection[] {
    return detections.map((d) => ({
        x: d.x * scaleX,
        y: d.y * scaleY,
        width: d.width * scaleX,
        height: d.height * scaleY,
        score: d.score,
    }));
}

/** Clips boxes to the image and rounds to whole pixels for canvas blurring. */
export function clipToImage(detections: Detection[], width: number, height: number): Detection[] {
    const clipped: Detection[] = [];

    for (const d of detections) {
        const x = Math.max(0, Math.round(d.x));
        const y = Math.max(0, Math.round(d.y));
        const right = Math.min(width, Math.round(d.x + d.width));
        const bottom = Math.min(height, Math.round(d.y + d.height));

        if (right > x && bottom > y) {
            clipped.push({ x, y, width: right - x, height: bottom - y, score: d.score });
        }
    }

    return clipped;
}

/**
 * Keeps only detections whose centre falls inside the given region.
 *
 * The second detection pass draws the image into a corner of a larger, padded
 * blob so that very large faces become medium-sized. Anything the network
 * reports out in the padding is an artefact and must be dropped before the
 * boxes are scaled back onto the original image.
 */
export function keepWithinRegion(detections: Detection[], maxX: number, maxY: number): Detection[] {
    return detections.filter((d) => {
        const cx = d.x + d.width / 2;
        const cy = d.y + d.height / 2;
        return cx >= 0 && cy >= 0 && cx <= maxX && cy <= maxY;
    });
}
