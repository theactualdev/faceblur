import React, { useState, useRef } from "react";
import { Upload, Image, AlertCircle } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { processFace } from "../../utils/detectFaces";

const UploadScreen: React.FC = () => {
  const { setImage, setState, setUploadProgress, setResultImage, setFaceCount, error, setError } =
    useAppContext();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.match("image.*")) {
      setError("Please upload an image file (JPEG, PNG, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size should be under 10MB");
      return;
    }

    setImage(file);
    setUploadProgress(0);
    setState("uploading");

    try {
      const { url, faceCount } = await processFace(file, setUploadProgress);
      setResultImage(url);
      setFaceCount(faceCount);
      setState(faceCount === 0 ? "no-faces" : "result");
    } catch (err) {
      console.error("Error processing image:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while processing your image. Please try again."
      );
      setImage(null);
      setState("upload");
    }
  };

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="card flex flex-col items-center transition-all duration-300 ease-in-out fade-in">
      <h2 className="text-2xl font-semibold mb-2 text-center">
        Protect Your Privacy
      </h2>
      <p className="text-slate-600 mb-8 text-center max-w-md">
        Upload an image to automatically blur faces and protect identity.
      </p>

      <div
        className={`upload-zone w-full mb-6 ${
          isDragging ? "upload-zone-active" : ""
        }`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="mb-4 p-4 bg-primary-100 rounded-full">
          <Image className="w-12 h-12 text-primary-500" />
        </div>
        <p className="font-medium text-slate-700 mb-1">
          Drag & drop your image here
        </p>
        <p className="text-sm text-slate-500 mb-4">or</p>
        <button
          className="btn btn-primary flex items-center space-x-2"
          onClick={handleButtonClick}
        >
          <Upload size={18} />
          <span>Browse Files</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
        <p className="text-xs text-slate-400 mt-4">
          Supported formats: JPEG, PNG, GIF • Max size: 10MB
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center space-x-2 text-red-500 mb-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default UploadScreen;
