import React, { useState } from "react";
import { UploadCloud, FileAudio, FileVideo, X } from "lucide-react";

interface UploadTabProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onError?: (msg: string) => void;
  disabled?: boolean;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  selectedFile,
  onFileSelect,
  onError,
  disabled,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndSet = (file: File) => {
    const validExtensions = [".mp3", ".wav", ".m4a", ".mp4", ".mov", ".ogg", ".webm", ".aac", ".flac"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const isAudioOrVideo = file.type.startsWith("audio/") || file.type.startsWith("video/") || validExtensions.includes(ext);

    if (isAudioOrVideo) {
      onFileSelect(file);
    } else {
      const msg = "Please upload an audio or video file (.mp3, .wav, .m4a, .mp4, .mov)";
      if (onError) {
        onError(msg);
      } else {
        alert(msg);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSet(e.target.files[0]);
    }
    // Reset so selecting the same file triggers onChange
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSet(e.dataTransfer.files[0]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVideo =
    selectedFile?.type.startsWith("video/") ||
    selectedFile?.name.endsWith(".mp4") ||
    selectedFile?.name.endsWith(".mov");

  return (
    <div className="flex flex-col gap-2">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-neo transition-all ${
            isDragOver
              ? "border-indigo bg-indigo/5 scale-[0.99]"
              : "border-ink bg-white hover:bg-btn-gray/20 shadow-neo-sm"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {/* Native file input covering the entire drop zone */}
          <input
            type="file"
            onChange={handleInputChange}
            accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.ogg,.webm"
            disabled={disabled}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            title="Choose a file to upload"
          />

          <div className="w-12 h-12 rounded-full bg-btn-gray border-2 border-ink flex items-center justify-center mb-2 shadow-neo-sm pointer-events-none">
            <UploadCloud className="w-6 h-6 text-ink" />
          </div>
          <p className="font-bold text-sm text-ink mb-1 text-center pointer-events-none">
            Click to upload or drag & drop
          </p>
          <p className="text-[11px] font-semibold text-text-gray text-center pointer-events-none">
            MP4, MOV, MP3, WAV, M4A (100% processed locally)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 bg-white border-2 border-ink rounded-neo shadow-neo-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-lg bg-indigo/10 border-2 border-indigo flex items-center justify-center text-indigo flex-shrink-0">
              {isVideo ? <FileVideo className="w-5 h-5" /> : <FileAudio className="w-5 h-5" />}
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-ink truncate max-w-[240px]">
                {selectedFile.name}
              </p>
              <p className="text-[11px] font-bold text-text-gray uppercase tracking-wider">
                {formatSize(selectedFile.size)} · Ready to transcribe
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onFileSelect(null)}
            disabled={disabled}
            className="p-1 rounded-md hover:bg-btn-gray text-text-gray hover:text-ink transition-colors cursor-pointer"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
