import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mic, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  deleted: boolean;
}

const CaptureScreen = () => {
  const navigate = useNavigate();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file,
      deleted: false
    }));

    setImages(prev => [...prev, ...newImages]);
    toast.success(`${files.length} image${files.length > 1 ? 's' : ''} added`);
  };

  const handleCameraSelect = () => {
    setShowCameraDialog(false);
    cameraInputRef.current?.click();
  };

  const handleGallerySelect = () => {
    setShowCameraDialog(false);
    fileInputRef.current?.click();
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, deleted: true } : img
    ));
    toast.success("Image deleted. Tap undo to restore.");
  };

  const undoDelete = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, deleted: false } : img
    ));
    toast.success("Image restored");
  };

  const discardAll = () => {
    setImages([]);
    setDescription("");
    toast.success("All content discarded");
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.success("Recording started");
      // Implement actual voice recording logic
    } else {
      toast.success("Recording stopped");
      // Process the recording
    }
  };

  const generateSummary = () => {
    if (!description && images.filter(img => !img.deleted).length === 0) {
      toast.error("Please add some content first");
      return;
    }
    toast.success("Generating summary...");
    // Navigate to review summary with the captured data
    setTimeout(() => {
      navigate("/review-summary");
    }, 1000);
  };

  const activeImages = images.filter(img => !img.deleted);

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
          >
            <X className="h-5 w-5 text-foreground" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">New Field Update</h1>
          <div className="w-10" /> {/* Spacer for alignment */}
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-36">
        {/* Project Info Pills */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">Project: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          {/* Description Textarea */}
          <div className="relative">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the progress, issues, or observations..."
              className="min-h-[200px] resize-none rounded-xl border-none bg-secondary text-base focus-visible:ring-2 focus-visible:ring-primary"
              maxLength={1000}
            />
            <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
              {description.length} / 1000
            </div>
          </div>

          {/* Upload/Camera Section */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={() => setShowCameraDialog(true)}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-primary/20 p-6 text-center text-primary transition-colors hover:bg-primary/30"
            >
              <Camera className="h-10 w-10" />
              <p className="text-sm font-medium">
                Tap to Take Photos/Video or to upload from gallery
              </p>
            </button>
            
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />

            {/* Voice Recording Button */}
            <div className="flex flex-col items-center justify-center gap-4 w-full">
              <button
                onClick={handleVoiceRecord}
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-colors ${
                  isRecording 
                    ? 'bg-destructive text-white' 
                    : 'bg-primary text-white hover:bg-primary/90'
                }`}
              >
                <Mic className="h-8 w-8" />
              </button>
            </div>

            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="w-full">
                <div className="flex w-full snap-x snap-mandatory scroll-p-4 gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="relative aspect-square w-20 flex-shrink-0 snap-start overflow-hidden rounded-lg bg-secondary"
                    >
                      {image.deleted ? (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg bg-destructive/80 px-2 text-center text-white">
                          <Trash2 className="h-5 w-5" />
                          <p className="text-[10px] font-semibold leading-tight">
                            Image Deleted
                          </p>
                          <button
                            onClick={() => undoDelete(image.id)}
                            className="mt-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-sm hover:bg-white/30"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <>
                          <img
                            src={image.url}
                            alt="Captured content"
                            className="h-full w-full object-cover"
                          />
                          <button
                            onClick={() => deleteImage(image.id)}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discard All Button */}
            {(images.length > 0 || description) && (
              <div className="w-full text-center mt-2">
                <button
                  onClick={discardAll}
                  className="text-sm font-medium text-destructive transition-colors hover:text-destructive/80"
                >
                  Discard All
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 z-10 w-full bg-background/80 p-4 backdrop-blur-lg">
        <Button
          onClick={generateSummary}
          className="w-full rounded-xl bg-primary px-4 py-6 text-base font-semibold text-white hover:bg-primary/90"
        >
          Generate Summary
        </Button>
      </div>

      {/* Camera Dialog */}
      <CameraDialog
        open={showCameraDialog}
        onOpenChange={setShowCameraDialog}
        onCameraSelect={handleCameraSelect}
        onGallerySelect={handleGallerySelect}
      />
    </div>
  );
};

export default CaptureScreen;
