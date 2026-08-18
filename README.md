<h1>FaceBlur</h1>
<hr><p>FaceBlur - AI face blurring for privacy protection by theactualdev.</p><h2>General Information</h2>
<hr><ul>
<li>FaceBlur — Privacy Made Simple is an AI-powered face blurring tool developed by theactualdev. Designed for effortless privacy protection, FaceBlur intelligently detects and blurs faces in images with precision and speed. Whether you're safeguarding identities in photos, creating content for social media, or anonymizing personal data, FaceBlur offers a simple, intuitive way to maintain privacy without compromising image quality. With modern AI models and a focus on user-friendly experience, FaceBlur ensures that your privacy is protected — instantly and reliably.</li>
</ul><h2>Technologies Used</h2>
<hr><ul>
<li>React</li>
</ul><ul>
<li>Vite</li>
</ul><ul>
<li>Typescript</li>
</ul><ul>
<li>Git</li>
</ul><ul>
<li>TailwindCSS</li>
</ul><ul>
<li>OpenCV.js (WebAssembly)</li>
</ul><ul>
<li>YuNet face detection model (ONNX)</li>
</ul><ul>
<li>Web Workers</li>
</ul><ul>
<li>Vitest</li>
</ul><h2>Features</h2>
<hr><ul>
<li>Automatic Face Detection: Instantly detects all visible faces in uploaded images using the YuNet neural network — no manual marking needed.</li>
</ul><ul>
<li>Runs Entirely On-Device: Images never leave the browser. Detection and blurring happen locally, so nothing is uploaded to a server.</li>
</ul><ul>
<li>Never Blocks the UI: Detection runs on a background worker thread, so the app stays responsive and the progress bar keeps moving while an image is processed.</li>
</ul><ul>
<li>Works Offline: Installable as a PWA, with the detection model cached for use without a connection.</li>
</ul><ul>
<li>Smart Blurring: Applies smooth, natural-looking blur effects specifically to faces without affecting the rest of the image.</li>
</ul><ul>
<li>Privacy-First Design: No images are stored; processing happens instantly and securely to protect user data.</li>
</ul><ul>
<li>Cross-Platform Ready: Works on desktop and mobile browsers without installing any apps.</li>
</ul><ul>
<li>Downloadable Images: After blurring, users can quickly save the processed image.</li>
</ul><h2>Screenshots</h2>
<hr><p><img src="https://faceblur-theactualdev.vercel.app/mobile.jpeg" alt=""></p><p><img src="https://faceblur-theactualdev.vercel.app/desktop.png" alt=""></p><h2>Setup</h2>
<hr><p>@techstark/opencv-js: https://www.npmjs.com/package/@techstark/opencv-js</p>
<p>lucide-react:
https://www.npmjs.com/package/lucide-react</p><h5>Steps</h5><ul>
<li>First, clone the FaceBlur project to your local machine: git clone https://github.com/theactualdev/faceblur.git</li>
</ul><ul>
<li>Move into the project folder: cd faceblur</li>
</ul><ul>
<li>Install all necessary packages (assuming you're using a package manager like npm or yarn): npm install or yarn install depending on your preferences.</li>
</ul><ul>
<li>Run the app locally: npm run dev or yarn dev depending on your preferences.</li>
</ul><ul>
<li>This will usually start the project on: http://localhost:5173</li>
</ul><ul>
<li>Run the tests: npm test (watch mode: npm run test:watch). npm run build type-checks before bundling, so type errors fail the build.</li>
</ul><h2>How It Works</h2>
<hr><ul>
<li>Detection uses YuNet, a small convolutional face detector, run through OpenCV.js compiled to WebAssembly. The model lives at public/face_detection_yunet_2023mar.onnx (~233KB) and is served from the app itself, so no third-party request is made at runtime.</li>
</ul><ul>
<li>OpenCV and the model are loaded inside a Web Worker (src/utils/faceWorker.ts). The main thread only sends pixels across and receives face rectangles back, which keeps the interface responsive while the ~10MB WebAssembly module compiles and inference runs.</li>
</ul><ul>
<li>Detection runs at two scales. YuNet is trained on faces that are small-to-medium relative to the frame, so a face filling most of the shot is missed entirely — measured as found at 40% frame coverage and below, missed at 60% and above. Because a close-up is exactly what a privacy tool tends to be given, a second pass renders the image small inside a padded blob to bring an oversized face back into range, and the two sets of boxes are merged with non-maximum suppression.</li>
</ul><ul>
<li>This build of OpenCV.js does not expose cv.FaceDetectorYN, so the model's raw outputs are decoded by hand in src/utils/yunetDecode.ts — anchor-free box decoding across strides 8, 16 and 32, followed by non-maximum suppression. That module is pure and covered by unit tests.</li>
</ul><ul>
<li>Blurring is applied to the full-resolution image on the main thread with stackblur-canvas, so detection speed never costs output quality.</li>
</ul><h2>Usage</h2>
<hr><ol>
<li>Upload Your Image</li>
<li>Let FaceBlur Detect Faces</li>
<li>Preview &amp; Confirm.</li>
<li>Download Your Blurred Image.</li>
<li>Done!</li>
</ol><h2>Project Status</h2>
<hr><p>Completed.</p><h2>Acknowledgement</h2>
<hr><ul>
<li>VoiceraIO: https://voicera.io/</li>
</ul><ul>
<li>@paul1029-ife: https://github.com/paul1029-ife</li>
</ul>