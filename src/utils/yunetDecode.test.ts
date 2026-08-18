import { describe, expect, it } from "vitest";
import {
    clipToImage,
    decodeYunet,
    nonMaxSuppression,
    keepWithinRegion,
    scaleDetections,
    type Detection,
    type StrideOutput,
} from "./yunetDecode";

/** Builds a single-stride output where one cell carries a face. */
function strideWith(
    stride: number,
    inputWidth: number,
    inputHeight: number,
    cell: { index: number; score: number; dx: number; dy: number; dw: number; dh: number }
): StrideOutput {
    const cells = Math.floor(inputWidth / stride) * Math.floor(inputHeight / stride);
    const cls = new Float32Array(cells);
    const obj = new Float32Array(cells);
    const bbox = new Float32Array(cells * 4);

    cls[cell.index] = cell.score;
    obj[cell.index] = cell.score;
    bbox[cell.index * 4] = cell.dx;
    bbox[cell.index * 4 + 1] = cell.dy;
    bbox[cell.index * 4 + 2] = cell.dw;
    bbox[cell.index * 4 + 3] = cell.dh;

    return { stride, cls, obj, bbox };
}

describe("decodeYunet", () => {
    it("places a box using the cell centre, stride and log-scale size", () => {
        // Cell (row 1, col 2) of a 128x96 input at stride 8 -> index 1*16 + 2 = 18.
        const out = strideWith(8, 128, 96, {
            index: 18,
            score: 1,
            dx: 0.5,
            dy: 0.5,
            dw: Math.log(2), // exp(dw) * 8 = 16
            dh: Math.log(2),
        });

        const [face] = decodeYunet([out], 128, 96, 0.5);

        // centre = (col + dx) * stride = 2.5*8 = 20 ; (row + dy)*stride = 1.5*8 = 12
        expect(face.width).toBeCloseTo(16);
        expect(face.height).toBeCloseTo(16);
        expect(face.x).toBeCloseTo(20 - 8);
        expect(face.y).toBeCloseTo(12 - 8);
        expect(face.score).toBeCloseTo(1);
    });

    it("scores as the geometric mean of the cls and obj heads", () => {
        const out = strideWith(8, 64, 64, { index: 0, score: 0, dx: 0.5, dy: 0.5, dw: 0, dh: 0 });
        (out.cls as Float32Array)[0] = 0.64;
        (out.obj as Float32Array)[0] = 0.25;

        const [face] = decodeYunet([out], 64, 64, 0.1);

        expect(face.score).toBeCloseTo(Math.sqrt(0.64 * 0.25)); // 0.4
    });

    it("drops cells below the score threshold", () => {
        const out = strideWith(8, 64, 64, { index: 5, score: 0.4, dx: 0.5, dy: 0.5, dw: 0, dh: 0 });

        expect(decodeYunet([out], 64, 64, 0.6)).toHaveLength(0);
        expect(decodeYunet([out], 64, 64, 0.3)).toHaveLength(1);
    });

    it("reads each stride's grid at its own resolution", () => {
        // Same cell index on two strides must land in different places.
        const s8 = strideWith(8, 64, 64, { index: 9, score: 1, dx: 0.5, dy: 0.5, dw: 0, dh: 0 });
        const s32 = strideWith(32, 64, 64, { index: 1, score: 1, dx: 0.5, dy: 0.5, dw: 0, dh: 0 });

        const faces = decodeYunet([s8, s32], 64, 64, 0.5);

        expect(faces).toHaveLength(2);
        // stride 32 boxes are 4x larger for the same dw/dh
        expect(faces[1].width / faces[0].width).toBeCloseTo(4);
    });
});

describe("nonMaxSuppression", () => {
    const box = (x: number, y: number, score: number): Detection => ({ x, y, width: 10, height: 10, score });

    it("keeps the highest scoring box among overlapping ones", () => {
        const kept = nonMaxSuppression([box(0, 0, 0.7), box(1, 1, 0.9), box(2, 2, 0.6)], 0.3);

        expect(kept).toHaveLength(1);
        expect(kept[0].score).toBe(0.9);
    });

    it("keeps boxes that do not overlap", () => {
        const kept = nonMaxSuppression([box(0, 0, 0.9), box(100, 100, 0.8)], 0.3);

        expect(kept).toHaveLength(2);
    });
});

describe("scaleDetections and clipToImage", () => {
    it("maps boxes back onto the original image size", () => {
        const scaled = scaleDetections([{ x: 10, y: 20, width: 30, height: 40, score: 1 }], 2, 3);

        expect(scaled[0]).toMatchObject({ x: 20, y: 60, width: 60, height: 120 });
    });

    it("clips boxes to the image bounds and rounds to whole pixels", () => {
        const clipped = clipToImage([{ x: -5.4, y: -2.6, width: 20, height: 20, score: 1 }], 10, 10);

        expect(clipped[0]).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
    });

    it("discards boxes that fall entirely outside the image", () => {
        expect(clipToImage([{ x: 50, y: 50, width: 10, height: 10, score: 1 }], 10, 10)).toHaveLength(0);
    });
});

describe("keepWithinRegion", () => {
    const at = (x: number, y: number): Detection => ({ x, y, width: 10, height: 10, score: 1 });

    it("keeps boxes whose centre is inside the content area", () => {
        expect(keepWithinRegion([at(0, 0), at(50, 50)], 100, 100)).toHaveLength(2);
    });

    it("drops boxes the network reported out in the padding", () => {
        // Centre at (155,155) is well outside a 100x100 content area.
        expect(keepWithinRegion([at(150, 150)], 100, 100)).toHaveLength(0);
    });

    it("keeps a box straddling the content edge but centred inside", () => {
        // Centre at (98,98) is inside; the box overhangs the boundary.
        expect(keepWithinRegion([at(93, 93)], 100, 100)).toHaveLength(1);
    });
});
