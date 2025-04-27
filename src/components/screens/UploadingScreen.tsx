import React, { useEffect, useState } from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

const UploadingScreen: React.FC = () => {
  const { uploadProgress, image, resetApp } = useAppContext();
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const getStage = () => {
    if (uploadProgress < 40) return 'Uploading';
    if (uploadProgress < 70) return 'Detecting faces';
    if (uploadProgress < 95) return 'Applying blur effect';
    return 'Finalizing';
  };

  useEffect(() => {
    if (image) {
      const previewUrl = URL.createObjectURL(image);
      setImagePreview(previewUrl);

      return () => {
        URL.revokeObjectURL(previewUrl);
      };
    } else {
      setImagePreview(null);
    }
  }, [image]);

  return (
    <div className="card flex flex-col items-center transition-all duration-300 ease-in-out fade-in">
      <h2 className="text-2xl font-semibold mb-6 text-center">Processing Image</h2>
      
      {imagePreview && (
        <div className="w-full max-w-sm mb-8 rounded-lg overflow-hidden relative">
          <img 
            src={imagePreview} 
            alt="Upload preview" 
            className="w-full object-cover"
            style={{ filter: 'blur(8px)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/30 backdrop-blur-sm p-3 rounded-full">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </div>
        </div>
      )}
      
      <div className="w-full max-w-md mb-4">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>{getStage()}</span>
          <span>{Math.round(uploadProgress)}%</span>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full progress-animation rounded-full" 
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      </div>
      
      <p className="text-slate-500 text-sm mb-6 animate-pulse">
        Please wait while we process your image...
      </p>
      
      <button 
        className="btn btn-secondary flex items-center space-x-2"
        onClick={resetApp}
      >
        <XCircle size={18} />
        <span>Cancel</span>
      </button>
    </div>
  );
};

export default UploadingScreen;