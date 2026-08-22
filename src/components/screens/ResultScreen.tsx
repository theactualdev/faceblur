import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, SlidersHorizontal, UploadCloud, Share2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { renderBlurred } from '../../utils/detectFaces';
import FaceToggleOverlay from '../FaceToggleOverlay';

const SHARE_FILE_NAME = 'blurred-image.jpg';

const ResultScreen: React.FC = () => {
  const { resultImage, setResultImage, faceCount, faces, sourceUrl, revealed, setRevealed, resetApp } =
    useAppContext();
  const [canShare, setCanShare] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<boolean>(false);
  const [pendingExport, setPendingExport] = useState<null | 'download' | 'share'>(null);

  // The decoded original, kept only while adjusting so re-blurring never re-detects.
  const sourceRef = useRef<HTMLImageElement | null>(null);
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null);

  // How many faces the last render actually blurred — read from the renderer, not
  // inferred from the selection, so the copy can never overstate what happened.
  const [blurredCount, setBlurredCount] = useState<number>(faceCount);
  const visibleCount = faceCount - blurredCount;

  useEffect(() => {
    setBlurredCount(faceCount);
  }, [faceCount]);

  // Sharing files is unsupported on most desktop browsers, so only offer the
  // button where it will actually work.
  useEffect(() => {
    const probe = new File([''], SHARE_FILE_NAME, { type: 'image/jpeg' });
    setCanShare(
      typeof navigator.share === 'function' &&
        navigator.canShare?.({ files: [probe] }) === true
    );
  }, []);

  const enterAdjust = () => {
    setShareError(null);
    if (sourceRef.current) {
      setAdjusting(true);
      return;
    }
    if (!sourceUrl) return;

    const img = new Image();
    img.onload = () => {
      sourceRef.current = img;
      setSourceSize({ width: img.width, height: img.height });
      setAdjusting(true);
    };
    img.onerror = () => setShareError('Could not reopen the original image to adjust it.');
    img.src = sourceUrl;
  };

  const toggleFace = (index: number) => {
    const source = sourceRef.current;
    if (!source) return;

    const next = new Set(revealed);
    if (next.has(index)) next.delete(index);
    else next.add(index);

    // Render synchronously from the pristine source. Repeated toggling therefore
    // cannot compound blur, and the shown bytes can never lag the selection.
    try {
      const { url, blurredCount: actuallyBlurred } = renderBlurred(source, faces, next);
      setRevealed(next);
      setResultImage(url);
      setBlurredCount(actuallyBlurred);
      setShareError(null);
    } catch {
      setShareError('Could not update the image. Your previous version is unchanged.');
    }
  };

  const doDownload = () => {
    if (!resultImage) return;
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = SHARE_FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const doShare = async () => {
    if (!resultImage) return;
    setShareError(null);

    try {
      const blob = await (await fetch(resultImage)).blob();
      const file = new File([blob], SHARE_FILE_NAME, { type: 'image/jpeg' });

      if (!navigator.canShare?.({ files: [file] })) {
        throw new Error('Sharing images is not supported in this browser.');
      }

      await navigator.share({
        files: [file],
        title: 'FaceBlur',
        text: 'Image with faces blurred by FaceBlur.',
      });
    } catch (err) {
      // The user dismissing the share sheet is not an error worth reporting.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('Error sharing image:', err);
      setShareError(
        err instanceof Error ? err.message : 'Could not share the image. Try downloading it instead.'
      );
    }
  };

  /** Any export that would leave a face recognizable asks first. */
  const requestExport = (kind: 'download' | 'share') => {
    if (visibleCount > 0) {
      setPendingExport(kind);
      return;
    }
    if (kind === 'download') doDownload();
    else void doShare();
  };

  const confirmExport = () => {
    const kind = pendingExport;
    setPendingExport(null);
    if (kind === 'download') doDownload();
    else if (kind === 'share') void doShare();
  };

  const summary =
    visibleCount > 0
      ? `${blurredCount} of ${faceCount} faces blurred — ${visibleCount} left visible.`
      : faceCount === 1
        ? 'We found 1 face and blurred it.'
        : `We found ${faceCount} faces and blurred them all.`;

  return (
    <div className="card flex flex-col items-center transition-all duration-300 ease-in-out fade-in">
      <div className="flex items-center space-x-2 mb-2">
        <h2 className="text-2xl font-semibold text-center">
          {visibleCount > 0 ? 'Ready to Save' : 'All Done!'}
        </h2>
        {visibleCount === 0 && <div className="inline-block animate-bounce-slow">🎉</div>}
      </div>
      <p className={`mb-6 text-center ${visibleCount > 0 ? 'text-amber-700 font-medium' : 'text-slate-600'}`}>
        {summary}
      </p>

      {resultImage && (
        <div className="relative w-full mb-4 rounded-lg overflow-hidden shadow-lg">
          <img
            src={resultImage}
            alt={
              visibleCount > 0
                ? `Processed image. ${blurredCount} of ${faceCount} faces blurred, ${visibleCount} left visible.`
                : 'Processed image with every detected face blurred'
            }
            className="w-full object-cover"
          />
          {adjusting && sourceSize && (
            <FaceToggleOverlay
              imageWidth={sourceSize.width}
              imageHeight={sourceSize.height}
              faces={faces}
              revealed={revealed}
              onToggle={toggleFace}
            />
          )}
        </div>
      )}

      {adjusting ? (
        <p className="text-sm text-slate-500 mb-6 text-center max-w-md" aria-live="polite">
          Tap a face to leave it visible, tap again to blur it. Faces outlined in amber
          will stay recognizable in the saved image.
        </p>
      ) : (
        faceCount > 0 && (
          <button
            className="btn btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto mb-6"
            onClick={enterAdjust}
          >
            <SlidersHorizontal size={18} />
            <span>Adjust faces</span>
          </button>
        )
      )}

      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
        <button
          className="btn btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
          onClick={() => requestExport('download')}
        >
          <Download size={18} />
          <span>Download Image</span>
        </button>

        <button
          className="btn btn-secondary flex items-center justify-center space-x-2 w-full sm:w-auto"
          onClick={resetApp}
        >
          <UploadCloud size={18} />
          <span>Upload Another</span>
        </button>

        {canShare && (
          <button
            className="btn btn-accent flex items-center justify-center space-x-2 w-full sm:w-auto"
            onClick={() => requestExport('share')}
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        )}
      </div>

      {pendingExport && (
        <div
          role="alertdialog"
          aria-label="Confirm export with visible faces"
          className="w-full max-w-md mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4"
        >
          <p className="text-sm text-amber-900 mb-3">
            {visibleCount === 1
              ? '1 face will stay recognizable in this image.'
              : `${visibleCount} faces will stay recognizable in this image.`}{' '}
            Continue anyway?
          </p>
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-2 sm:space-y-0">
            <button
              className="btn btn-primary flex items-center justify-center w-full sm:w-auto"
              onClick={confirmExport}
            >
              <span>Yes, continue</span>
            </button>
            <button
              className="btn btn-secondary flex items-center justify-center w-full sm:w-auto"
              onClick={() => setPendingExport(null)}
            >
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}

      {shareError && (
        <div role="alert" className="flex items-center space-x-2 text-red-500 mb-4">
          <AlertCircle size={16} />
          <span className="text-sm">{shareError}</span>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm text-slate-500">
          Your privacy is important to us. All uploaded images are processed locally and are not stored on our servers.
        </p>
      </div>
    </div>
  );
};

export default ResultScreen;
