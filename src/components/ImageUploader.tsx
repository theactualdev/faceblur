import React from 'react';
import { useAppContext } from '../context/AppContext';
import UploadScreen from './screens/UploadScreen';
import UploadingScreen from './screens/UploadingScreen';
import ResultScreen from './screens/ResultScreen';

const ImageUploader: React.FC = () => {
  const { state } = useAppContext();

  return (
    <div className="w-full max-w-2xl transition-all duration-300 ease-in-out">
      {state === 'upload' && <UploadScreen />}
      {state === 'uploading' && <UploadingScreen />}
      {state === 'result' && <ResultScreen />}
    </div>
  );
};

export default ImageUploader;