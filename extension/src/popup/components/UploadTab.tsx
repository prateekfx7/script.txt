import React, { useRef, useState } from "react";
import { UploadCloud, FileAudio, FileVideo, X } from "lucide-react";

interface UploadTabProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export const UploadTab: React.FC<UploadTabProps> = ({
  selectedFile,
  onFileSelect,
  disabled,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === "dragover" || e.type === "dragenter") {
      setIsDragOver(true);
    } else if (e.type === "dragleave") {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSet(file);
    }
  };

  const validateAndSet = (file: File) => {
    const validExtensions = [".mp3", ".wav", ".m4a", ".mp4", ".mov", ".ogg", ".webm"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (validExtensions.includes(ext) || file.type.startsWith("audio/") || file.type.startsWith("video/")) {
      onFileSelect(file);
    } else {
      alert("Please upload a valid audio or video file (.mp3, .wav, .m4a, .mp4, .mov)");
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isVideo = selectedFile?.type.startsWith("video/") || selectedFile?.name.endsWith(".mp4") || selectedFile?.name.endsWith(".mov");

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files?.[0] && validateAndSet(e.target.files[0])}
        accept="audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov"
        className="hidden"
        disabled={disabled}
      />

      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-neo cursor-pointer transition-all ${
            isDragOver
              ? "border-indigo bg-indigo/5 scale-[0.99]"
              : "border-ink bg-white hover:bg-btn-gray/20 shadow-neo-sm"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="w-12 h-12 rounded-full bg-btn-gray border-2 border-ink flex items-center justify-center mb-2 shadow-neo-sm">
            <UploadCloud className="w-6 h-6 text-ink" />
          </div>
          <p className="font-bold text-sm text-ink mb-1 text-center">
            Click to upload or drag & drop
          </p>
          <p className="text-[11px] font-semibold text-text-gray text-center">
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
            onClick={() => onFileSelect(null)}
            disabled={disabled}
            className="p-1 rounded-md hover:bg-btn-gray text-text-gray hover:text-ink transition-colors"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
