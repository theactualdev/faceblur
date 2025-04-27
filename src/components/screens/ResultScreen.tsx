import React from 'react';
import { Download, UploadCloud, Share2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const ResultScreen: React.FC = () => {
  const { resultImage, resetApp } = useAppContext();

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
        Your image has been processed with all faces blurred.
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
          className="btn btn-primary flex items-center space-x-2 w-full sm:w-auto"
          onClick={handleDownload}
        >
          <Download size={18} />
          <span>Download Image</span>
        </button>
        
        <button 
          className="btn btn-secondary flex items-center space-x-2 w-full sm:w-auto"
          onClick={resetApp}
        >
          <UploadCloud size={18} />
          <span>Upload Another</span>
        </button>
        
        <button 
          className="btn btn-accent flex items-center space-x-2 w-full sm:w-auto"
        >
          <Share2 size={18} />
          <span>Share</span>
        </button>
      </div>
      
      <div className="text-center">
        <p className="text-sm text-slate-500">
          Your privacy is important to us. All uploaded images are processed locally and are not stored on our servers.
        </p>
      </div>
    </div>
  );
};

export default ResultScreen;