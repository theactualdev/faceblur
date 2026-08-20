import React, { createContext, useContext, useState, ReactNode} from 'react';

export type AppState = 'upload' | 'uploading' | 'result' | 'no-faces';

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  image: File | null;
  setImage: React.Dispatch<React.SetStateAction<File | null>>;
  uploadProgress: number;
  setUploadProgress: React.Dispatch<React.SetStateAction<number>>;
  resultImage: string | null;
  setResultImage: React.Dispatch<React.SetStateAction<string | null>>;
  faceCount: number;
  setFaceCount: React.Dispatch<React.SetStateAction<number>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  resetApp: () => void;
}

const AppContext = createContext<AppContextType>({
  state: 'upload',
  setState: () => {},
  image: null,
  setImage: () => {},
  uploadProgress: 0,
  setUploadProgress: () => {},
  resultImage: null,
  setResultImage: () => {},
  faceCount: 0,
  setFaceCount: () => {},
  error: null,
  setError: () => {},
  resetApp: () => {},
});

export const AppProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [state, setState] = useState<AppState>('upload');
  const [image, setImage] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const resetApp = () => {
    setState('upload');
    setImage(null);
    setUploadProgress(0);
    setResultImage(null);
    setFaceCount(0);
    setError(null);
  };

  return (
    <AppContext.Provider
      value={{
        state,
        setState,
        image,
        setImage,
        uploadProgress,
        setUploadProgress,
        resultImage,
        setResultImage,
        faceCount,
        setFaceCount,
        error,
        setError,
        resetApp,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);