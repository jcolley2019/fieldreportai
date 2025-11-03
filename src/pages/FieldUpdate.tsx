import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CameraDialog } from "@/components/CameraDialog";
import { Camera, Mic, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FieldUpdate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const handleCameraSelect = () => {
    setCameraOpen(false);
    // TODO: Implement camera capture
    toast({
      title: "Camera",
      description: "Camera functionality will be implemented",
    });
  };

  const handleGallerySelect = () => {
    setCameraOpen(false);
    // TODO: Implement gallery selection
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        Array.from(files).forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              setImages(prev => [...prev, event.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
    };
    input.click();
  };

  const handleDeleteImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    toast({
      title: "Image deleted",
      description: "The image has been removed.",
    });
  };

  const handleDiscardAll = () => {
    setImages([]);
    setDescription("");
    toast({
      title: "All discarded",
      description: "All content has been cleared.",
    });
  };

  const handleGenerateSummary = () => {
    if (!description && images.length === 0) {
      toast({
        title: "No content",
        description: "Please add a description or images before generating a summary.",
        variant: "destructive",
      });
      return;
    }

    // TODO: Integrate with generate-report edge function
    toast({
      title: "Generating summary...",
      description: "Your field update summary is being created.",
    });
    
    // Navigate to review summary page
    setTimeout(() => {
      navigate("/review-summary");
    }, 1000);
  };

  const handleVoiceRecord = () => {
    setIsRecording(!isRecording);
    // TODO: Implement voice recording
    toast({
      title: isRecording ? "Recording stopped" : "Recording started",
      description: isRecording ? "Voice input stopped" : "Speak now...",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-36">
      <main className="px-4 pt-4">
        {/* Project badges */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-secondary-foreground">Project: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-secondary-foreground">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Description textarea */}
        <div className="flex flex-col gap-y-6">
          <div className="relative">
            <Textarea
              placeholder="Describe the progress, issues, or observations..."
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
              className="min-h-[280px] resize-none bg-secondary text-foreground placeholder:text-muted-foreground"
            />
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground">
              {description.length} / 1000
            </div>
          </div>

          {/* Camera section */}
          <div 
            onClick={() => setCameraOpen(true)}
            className="flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg bg-primary/10 border-2 border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <Camera className="h-12 w-12 text-primary" />
            <p className="text-center text-sm font-medium text-primary">
              Tap to Take Photos/Video or to upload from gallery
            </p>
          </div>

          {/* Voice button */}
          <div className="flex justify-center">
            <button
              onClick={handleVoiceRecord}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                isRecording 
                  ? 'bg-destructive hover:bg-destructive/90' 
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              <Mic className="h-8 w-8 text-primary-foreground" />
            </button>
          </div>

          {/* Image gallery */}
          {images.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
              {images.map((img, index) => (
                <div key={index} className="relative shrink-0">
                  <img
                    src={img}
                    alt={`Captured ${index + 1}`}
                    className="h-32 w-32 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => handleDeleteImage(index)}
                    className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary border border-border"
                  >
                    <Trash2 className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Discard All button */}
          {(description || images.length > 0) && (
            <Button
              onClick={handleDiscardAll}
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Discard All
            </Button>
          )}

          {/* Generate Summary button */}
          <Button
            onClick={handleGenerateSummary}
            size="lg"
            className="w-full text-base font-semibold"
          >
            Generate Summary
          </Button>
        </div>
      </main>

      <CameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCameraSelect={handleCameraSelect}
        onGallerySelect={handleGallerySelect}
      />
    </div>
  );
};

export default FieldUpdate;
