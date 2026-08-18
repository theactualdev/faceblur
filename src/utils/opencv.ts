import type cvType from "@techstark/opencv-js";

export type Cv = typeof cvType;

/**
 * OpenCV is handed back inside a box, never on its own.
 *
 * The module object has a `then` method, so it is a thenable. Resolving a promise
 * with it — `resolve(cv)`, `Promise.resolve(cv)`, or `return cv` from an async
 * function — makes the promise adopt it, and that thenable never settles. Boxing
 * keeps the value inert.
 */
export type CvHandle = { cv: Cv };

const POLL_MS = 50;
const TIMEOUT_MS = 120_000;

/**
 * Waits for the WebAssembly runtime to come up.
 *
 * `cv.Mat` is the signal: the wrapper functions (cv.imread and friends) exist as
 * soon as the module is imported, but the embind classes only appear once the
 * runtime has initialised. Neither the thenable nor onRuntimeInitialized is
 * reliable here — see the notes on CvHandle.
 */
export function whenRuntimeReady(cv: Cv): Promise<CvHandle> {
    const bag = cv as unknown as Record<string, unknown>;
    const isReady = () => typeof bag.Mat === "function";

    if (isReady()) return Promise.resolve({ cv });

    return new Promise<CvHandle>((resolve, reject) => {
        const startedAt = Date.now();

        const timer = setInterval(() => {
            if (isReady()) {
                clearInterval(timer);
                resolve({ cv });
                return;
            }

            // A bounded wait: a silent hang here is far harder to diagnose than an error.
            if (Date.now() - startedAt > TIMEOUT_MS) {
                clearInterval(timer);
                reject(new Error("The image processing engine did not start in time. Please reload and try again."));
            }
        }, POLL_MS);
    });
}
