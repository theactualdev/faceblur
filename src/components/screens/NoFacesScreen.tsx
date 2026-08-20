import React from 'react';
import { ScanFace, UploadCloud } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

/**
 * Shown when detection finished but found nothing. Deliberately distinct from the
 * success screen: for a privacy tool, "no faces blurred" must never be dressed up
 * as "all faces blurred".
 */
const NoFacesScreen: React.FC = () => {
  const { resultImage, resetApp } = useAppContext();

  return (
    <div className="card flex flex-col items-center transition-all duration-300 ease-in-out fade-in">
      <div className="mb-4 p-4 bg-slate-100 rounded-full">
        <ScanFace className="w-12 h-12 text-slate-500" />
      </div>

      <h2 className="text-2xl font-semibold mb-2 text-center">No Faces Found</h2>
      <p className="text-slate-600 mb-6 text-center max-w-md">
        We looked, but couldn't find a face in this image — so nothing was blurred
        and your image is unchanged.
      </p>

      {resultImage && (
        <div className="w-full max-w-sm mb-6 rounded-lg overflow-hidden shadow-lg">
          <img
            src={resultImage}
            alt="Uploaded image, unchanged — no faces were found"
            className="w-full object-cover"
          />
        </div>
      )}

      <button
        className="btn btn-primary flex items-center justify-center space-x-2 w-full sm:w-auto mb-6"
        onClick={resetApp}
      >
        <UploadCloud size={18} />
        <span>Try Another Image</span>
      </button>

      <div className="text-center">
        <p className="text-sm text-slate-500">
          Faces that are very small, turned away, or heavily obscured can be missed.
          If this image does contain a face, blurring it manually is the safe option.
        </p>
      </div>
    </div>
  );
};

export default NoFacesScreen;
