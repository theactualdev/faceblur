import React, { useEffect, useState } from 'react';
import { AlertCircle, Download, UploadCloud, Share2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const SHARE_FILE_NAME = 'blurred-image.jpg';

const ResultScreen: React.FC = () => {
  const { resultImage, faceCount, resetApp } = useAppContext();
  const [canShare, setCanShare] = useState<boolean>(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Sharing files is unsupported on most desktop browsers, so only offer the
  // button where it will actually work.
  useEffect(() => {
    const probe = new File([''], SHARE_FILE_NAME, { type: 'image/jpeg' });
    setCanShare(
      typeof navigator.share === 'function' &&
        navigator.canShare?.({ files: [probe] }) === true
    );
  }, []);

  const handleShare = async () => {
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

  const handleDownload = () => {
    if (resultImage) {
      const link = document.createElement('a');
      link.href = resultImage;
      link.download = 'blurred-image.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="card flex flex-col items-center transition-all duration-300 ease-in-out fade-in">
      <div className="flex items-center space-x-2 mb-2">
        <h2 className="text-2xl font-semibold text-center">All Done!</h2>
        <div className="inline-block animate-bounce-slow">🎉</div>
      </div>
      <p className="text-slate-600 mb-6 text-center">
        {faceCount === 1
          ? 'We found 1 face and blurred it.'
          : `We found ${faceCount} faces and blurred them all.`}
      </p>
      
      {resultImage && (
        <div className="w-full mb-8 rounded-lg overflow-hidden shadow-lg">
          <img 
            src={resultImage} 
            alt="Processed image with blurred faces" 
            className="w-full object-cover"
          />
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
        <button 
          className="btn btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto"
          onClick={handleDownload}
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
            onClick={handleShare}
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        )}
      </div>

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