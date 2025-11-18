import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mic, Trash2, Undo2, ChevronLeft, FileText } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";
import { supabase } from "@/integrations/supabase/client";

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  deleted: boolean;
}

const Checklist = () => {
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
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
    toast.success("All content discarded");
  };

  const handleVoiceRecord = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setAudioChunks(chunks);
        setIsRecording(true);
        toast.success("Recording started - tap again to stop");
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error("Could not access microphone");
      }
    } else {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        setIsRecording(false);
        toast.success("Processing audio...");
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];

        // Call transcribe-audio edge function
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Data }
        });

        if (error) {
          console.error("Transcription error:", error);
          toast.error("Failed to transcribe audio");
          return;
        }

        if (data?.text) {
          // Append transcribed text to description
          toast.success("Audio transcribed successfully!");
        }
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error("Failed to process audio");
    }
  };

  const generateSummary = async () => {
    if (images.filter(img => !img.deleted).length === 0) {
      toast.error("Please add some content first");
      return;
    }

    setIsRecording(true); // Use as loading state
    toast.success("Generating checklist with AI...");

    try {
      // Convert images to base64
      const imagePromises = images
        .filter(img => !img.deleted)
        .map(async (img) => {
          if (img.file) {
            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(img.file!);
            });
          }
          return img.url;
        });

      const imageData = await Promise.all(imagePromises);

      // Call the edge function
      const { data, error } = await supabase.functions.invoke('generate-checklist', {
        body: {
          images: imageData
        }
      });

      if (error) {
        console.error("Error generating checklist:", error);
        if (error.message.includes("Rate limit")) {
          toast.error("Rate limit exceeded. Please try again later.");
        } else if (error.message.includes("Payment required")) {
          toast.error("AI credits depleted. Please add credits to continue.");
        } else {
          toast.error("Failed to generate checklist. Please try again.");
        }
        setIsRecording(false);
        return;
      }

      console.log("Checklist generated:", data);
      toast.success("Checklist generated successfully!");
      
      // Navigate to confirmation with the checklist data
      navigate("/checklist-confirmation", { 
        state: { 
          checklist: data.checklist,
          images: images.filter(img => !img.deleted).map(img => img.url)
        } 
      });
    } catch (err) {
      console.error("Error:", err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsRecording(false);
    }
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
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Lets Create a Checklist</h1>
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
            <p className="text-xs font-medium text-muted-foreground">Job: 23-001</p>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
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
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                  isRecording 
                    ? 'bg-destructive text-white animate-pulse shadow-lg shadow-destructive/50' 
                    : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
                }`}
              >
                <Mic className="h-8 w-8" />
              </button>
              {isRecording ? (
                <p className="text-sm text-muted-foreground animate-pulse">Recording... tap to stop</p>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">Press Record to describe checklist items</p>
                  <p className="text-xs text-muted-foreground">Tap again to stop. You can record multiple times to add more details.</p>
                </div>
              )}
            </div>

            {/* Previous Checklists Section */}
            <div className="w-full mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Previous Checklists</h3>
              <div className="space-y-3">
                {/* Placeholder for previous checklists - will be populated with actual data */}
                <div className="rounded-lg border border-border bg-secondary p-4 hover:bg-secondary/80 transition-colors cursor-pointer">
                  <h4 className="font-medium text-foreground mb-2">Sample Checklist 1</h4>
                  <p className="text-sm text-muted-foreground">Created 2 hours ago • 5 items</p>
                </div>
                <div className="rounded-lg border border-border bg-secondary p-4 hover:bg-secondary/80 transition-colors cursor-pointer">
                  <h4 className="font-medium text-foreground mb-2">Sample Checklist 2</h4>
                  <p className="text-sm text-muted-foreground">Created yesterday • 8 items</p>
                </div>
              </div>
            </div>

            {/* Image Gallery */}
            {images.length > 0 && (
              <div className="w-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">
                    {images.filter(img => !img.deleted).length} photo{images.filter(img => !img.deleted).length !== 1 ? 's' : ''} captured
                  </h3>
                </div>
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
            {images.length > 0 && (
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
          disabled={isRecording}
          className="w-full rounded-xl bg-primary px-4 py-6 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isRecording ? "Generating with AI..." : "Generate Checklist"}
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

export default Checklist;
