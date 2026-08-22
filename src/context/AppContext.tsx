import React, { createContext, useContext, useState, ReactNode} from 'react';
import type { FaceRegion } from '../utils/detectFaces';

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
  /** Face rectangles in original-image pixels, stable order. Index is the face identity. */
  faces: FaceRegion[];
  setFaces: React.Dispatch<React.SetStateAction<FaceRegion[]>>;
  /** The untouched original, so a different subset can be re-blurred without re-detecting. */
  sourceUrl: string | null;
  setSourceUrl: React.Dispatch<React.SetStateAction<string | null>>;
  /**
   * Indices the user has deliberately un-blurred. Empty means every face is blurred,
   * which is the default and matches the behaviour before selective blur existed.
   * Revealing is always opt-out: doing nothing can only ever over-blur.
   */
  revealed: Set<number>;
  setRevealed: React.Dispatch<React.SetStateAction<Set<number>>>;
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
  faces: [],
  setFaces: () => {},
  sourceUrl: null,
  setSourceUrl: () => {},
  revealed: new Set<number>(),
  setRevealed: () => {},
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
  const [faces, setFaces] = useState<FaceRegion[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set<number>());
  const [error, setError] = useState<string | null>(null);

  const resetApp = () => {
    setState('upload');
    setImage(null);
    setUploadProgress(0);
    setResultImage(null);
    setFaceCount(0);
    setFaces([]);
    setSourceUrl(null);
    setRevealed(new Set<number>());
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
        faces,
        setFaces,
        sourceUrl,
        setSourceUrl,
        revealed,
        setRevealed,
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