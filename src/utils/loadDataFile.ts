import type { Cv } from "./opencv"

/** Fetches a file and writes it into OpenCV's in-memory filesystem. */
export async function loadDataFile(cv: Cv, cvFilePath: string, url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const buffer = await response.arrayBuffer();
    const data = new Uint8Array(buffer);
    cv.FS_createDataFile("/", cvFilePath, data, true, false, false);
}
