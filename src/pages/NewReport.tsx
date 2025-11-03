import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mic, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";

const NewReport = () => {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<{ id: string; url: string; file: File }[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const maxChars = 1000;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file,
    }));

    setImages((prev) => [...prev, ...newImages].slice(0, 8)); // Limit to 8 images
    toast.success(`${files.length} photo(s) added`);
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.url);
      return prev.filter((img) => img.id !== id);
    });
    toast.success("Photo removed");
  };

  const handleDiscardAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    toast.success("All photos discarded");
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.success("Recording started");
    } else {
      toast.success("Recording stopped");
    }
  };

  const handleCameraClick = () => {
    setShowCameraDialog(false);
    cameraInputRef.current?.click();
  };

  const handleGalleryClick = () => {
    setShowCameraDialog(false);
    fileInputRef.current?.click();
  };

  const handleGenerateSummary = () => {
    if (!description.trim() && images.length === 0) {
      toast.error("Please add description or photos first");
      return;
    }
    toast.success("Generating summary...");
    navigate("/review-summary");
  };

  return (
    <div className="dark min-h-screen bg-background">
      <main className="flex min-h-screen flex-col px-4 pb-8 pt-4">
        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-card px-3">
            <p className="text-xs font-medium text-muted-foreground">Project: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-card px-3">
            <p className="text-xs font-medium text-muted-foreground">Jul 26, 2024</p>
          </div>
        </div>

        {/* Description Textarea */}
        <div className="mb-6">
          <div className="relative">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, maxChars))}
              placeholder="Describe the progress, issues, or observations..."
              className="min-h-[300px] resize-none bg-card text-foreground placeholder:text-muted-foreground"
              maxLength={maxChars}
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {description.length} / {maxChars}
            </div>
          </div>
        </div>

        {/* Photo/Video Upload */}
        <div className="mb-6">
          {/* Gallery input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {/* Camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => setShowCameraDialog(true)}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl bg-card p-8 transition-colors hover:bg-secondary"
          >
            <Camera className="h-12 w-12 text-primary" />
            <p className="text-center text-sm font-medium text-primary">
              Tap to Take Photos/Video or to upload from gallery
            </p>
          </button>
        </div>

        <CameraDialog
          open={showCameraDialog}
          onOpenChange={setShowCameraDialog}
          onCameraSelect={handleCameraClick}
          onGallerySelect={handleGalleryClick}
        />

        {/* Voice Recording Button */}
        <div className="mb-6 flex justify-center">
          <button
            onClick={handleVoiceRecord}
            className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${
              isRecording
                ? "bg-destructive animate-pulse"
                : "bg-primary hover:bg-primary/90"
            }`}
          >
            <Mic className="h-10 w-10 text-primary-foreground" />
          </button>
        </div>

        {/* Image Gallery - 8 thumbnails max */}
        <div className="mb-6">
          <div className="grid grid-cols-4 gap-3">
            {images.map((image) => (
              <div key={image.id} className="relative aspect-square">
                <img
                  src={image.url}
                  alt="Upload preview"
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  onClick={() => handleRemoveImage(image.id)}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-background text-foreground"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          
          {/* Discard All Button */}
          {images.length > 0 && (
            <button
              onClick={handleDiscardAll}
              className="mx-auto mt-4 block text-sm font-medium text-destructive hover:underline"
            >
              Discard All
            </button>
          )}
        </div>

        {/* Generate Summary Button - At bottom */}
        <div className="mt-auto">
          <Button
            onClick={handleGenerateSummary}
            className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Generate Summary
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NewReport;

