import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mic, Trash2, Undo2, ChevronLeft, FileText, ChevronRight, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";
import { LiveCameraCapture } from "@/components/LiveCameraCapture";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from '@/lib/dateFormat';

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  deleted: boolean;
  caption?: string;
}

const CaptureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const isSimpleMode = location.state?.simpleMode || false;
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
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
    toast.success(`${files.length} ${files.length > 1 ? t('common.imagesAdded') : t('common.imageAdded')}`);
  };

  const handleCameraSelect = () => {
    setShowCameraDialog(false);
    cameraInputRef.current?.click();
  };

  const handleGallerySelect = () => {
    setShowCameraDialog(false);
    fileInputRef.current?.click();
  };

  const handleLiveCameraSelect = () => {
    setShowCameraDialog(false);
    setShowLiveCamera(true);
  };

  const handleLiveCameraCapture = (files: File[]) => {
    const newImages: ImageItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file,
      deleted: false
    }));

    setImages(prev => [...prev, ...newImages]);
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, deleted: true } : img
    ));
    toast.success(t('captureScreen.imageDeleted') + ". " + t('captureScreen.undo') + " to restore.");
  };

  const undoDelete = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, deleted: false } : img
    ));
    toast.success(t('common.imageRestored'));
  };

  const discardAll = () => {
    setImages([]);
    setDescription("");
    toast.success(t('common.allDiscarded'));
  };

  const handleVoiceRecord = async () => {
    if (!isRecording) {
      // Start recording and open camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const mimeTypes = [
          'audio/webm',
          'audio/webm;codecs=opus',
          'audio/mp4',
          'audio/mpeg',
          'audio/wav'
        ];
        
        let selectedMimeType = '';
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            console.log('Selected MIME type:', mimeType);
            break;
          }
        }
        
        if (!selectedMimeType) {
          console.warn('No preferred MIME type supported, using browser default');
        }
        
        const recorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {};
        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: recorder.mimeType });
          
          console.log('Recorded audio details:', {
            mimeType: audioBlob.type,
            size: audioBlob.size,
            sizeKB: (audioBlob.size / 1024).toFixed(2),
            recorderMimeType: recorder.mimeType
          });
          
          toast.info(`Recorded: ${audioBlob.type} (${(audioBlob.size / 1024).toFixed(1)}KB)`);
          
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setAudioChunks(chunks);
        setIsRecording(true);
        setShowLiveCamera(true);
        toast.success(t('common.recordingStarted'));
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error(t('common.microphoneError'));
      }
    } else {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        setIsRecording(false);
        toast.success(t('common.processingAudio'));
      }
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorder && isRecording) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        toast.info(t('common.recordingPaused'));
      } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        toast.info(t('common.recordingResumed'));
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      setShowLiveCamera(false);
      toast.success(t('common.processingAudio'));
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        
        // Log the data URL prefix to verify MIME type
        const dataUrlPrefix = base64Audio.substring(0, base64Audio.indexOf(','));
        console.log('Audio data URL prefix:', dataUrlPrefix);
        
        // Strip the data URL prefix to get pure base64
        const base64Data = base64Audio.split(',')[1];
        
        console.log('Sending to transcribe-audio function:', {
          base64Length: base64Data.length,
          estimatedSizeKB: (base64Data.length * 0.75 / 1024).toFixed(2)
        });

        // Call transcribe-audio edge function
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { 
            audio: base64Data,
            mimeType: audioBlob.type // Send MIME type for backend logging
          }
        });

        if (error) {
          console.error("Transcription error:", error);
          const message = (error as any)?.message || 'Unknown transcription error';
          toast.error(`Transcription failed: ${message}`);
          return;
        }

        if (data?.text) {
          // Check if the text contains "photo caption" or "subtítulo de foto"
          const text = data.text;
          const lowerText = text.toLowerCase();
          
          // Detect caption trigger in English or Spanish
          const captionTriggerEn = lowerText.indexOf('photo caption');
          const captionTriggerEs = lowerText.indexOf('subtítulo de foto');
          
          if (captionTriggerEn !== -1 || captionTriggerEs !== -1) {
            // Extract the caption text after the trigger phrase
            const triggerIndex = captionTriggerEn !== -1 ? captionTriggerEn : captionTriggerEs;
            const triggerPhrase = captionTriggerEn !== -1 ? 'photo caption' : 'subtítulo de foto';
            const captionText = text.substring(triggerIndex + triggerPhrase.length).trim();
            
            if (captionText && images.length > 0) {
              // Find the most recent non-deleted image
              const activeImages = images.filter(img => !img.deleted);
              if (activeImages.length > 0) {
                const latestImage = activeImages[activeImages.length - 1];
                
                // Update the image with the caption
                setImages(prev => prev.map(img => 
                  img.id === latestImage.id 
                    ? { ...img, caption: captionText }
                    : img
                ));
                
                toast.success(`Caption added: "${captionText}"`);
              }
            }
          } else {
            // Regular transcription - append to description
            setDescription(prev => prev ? `${prev}\n${data.text}` : data.text);
            toast.success(t('common.transcriptionSuccess'));
          }
        }
      };
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      const message = error?.message || 'Unknown error while processing audio';
      toast.error(t('common.transcriptionError'));
    }
  };

  const generateSummary = async () => {
    const activeImgs = images.filter(img => !img.deleted);
    
    if (!description && activeImgs.length === 0) {
      toast.error(t('captureScreen.addContentFirst'));
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);

    // Simulate progress animation
    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      // Convert blob URLs to base64
      const imageDataPromises = activeImgs.map(async (img) => {
        if (!img.file) return null;
        
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(img.file);
        });
      });

      const imageDataUrls = await Promise.all(imageDataPromises);
      const validImageDataUrls = imageDataUrls.filter(url => url !== null) as string[];

      const { data, error } = await supabase.functions.invoke('generate-report-summary', {
        body: { 
          description: description || "",
          imageDataUrls: validImageDataUrls
        }
      });

      if (error) {
        console.error("Summary generation error:", error);
        toast.error(error.message || "Failed to generate summary");
        clearInterval(progressInterval);
        setIsGenerating(false);
        setGenerationProgress(0);
        return;
      }

      if (!data?.summary) {
        toast.error("No summary generated");
        clearInterval(progressInterval);
        setIsGenerating(false);
        setGenerationProgress(0);
        return;
      }

      // Complete the progress
      clearInterval(progressInterval);
      setGenerationProgress(100);
      
      // Small delay to show completion
      setTimeout(() => {
        // Navigate with the generated summary and media
        navigate("/review-summary", { 
          state: { 
            simpleMode: isSimpleMode,
            summary: data.summary,
            description,
            images: activeImgs.map(img => ({ url: img.url, id: img.id }))
          } 
        });
      }, 300);
    } catch (err) {
      console.error("Error generating summary:", err);
      toast.error("Failed to generate summary. Please try again.");
      clearInterval(progressInterval);
    } finally {
      setIsGenerating(false);
      setGenerationProgress(0);
    }
  };

  const activeImages = images.filter(img => !img.deleted);

  const handleNextImage = () => {
    if (selectedImageIndex === null) return;
    const nextIndex = (selectedImageIndex + 1) % activeImages.length;
    setSelectedImageIndex(nextIndex);
  };

  const handlePrevImage = () => {
    if (selectedImageIndex === null) return;
    const prevIndex = (selectedImageIndex - 1 + activeImages.length) % activeImages.length;
    setSelectedImageIndex(prevIndex);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImageIndex === null) return;
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
      if (e.key === 'Escape') setSelectedImageIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageIndex, activeImages.length]);

  // Reset zoom when image changes
  useEffect(() => {
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  }, [selectedImageIndex]);

  // Touch swipe and pinch-to-zoom handling
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const initialDistance = useRef(0);
  const lastScale = useRef(1);
  const isPinching = useRef(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastTouchTime = useRef(0);

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      isPinching.current = true;
      initialDistance.current = getDistance(e.touches[0], e.touches[1]);
      lastScale.current = imageScale;
    } else if (e.touches.length === 1) {
      // Single touch - check for double tap or pan
      const currentTime = Date.now();
      const timeDiff = currentTime - lastTouchTime.current;
      
      if (timeDiff < 300 && timeDiff > 0) {
        // Double tap detected - reset zoom
        setImageScale(1);
        setImagePosition({ x: 0, y: 0 });
      } else if (imageScale > 1) {
        // Start panning when zoomed in
        isPanning.current = true;
        panStart.current = {
          x: e.touches[0].clientX - imagePosition.x,
          y: e.touches[0].clientY - imagePosition.y
        };
      }
      
      lastTouchTime.current = currentTime;
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPinching.current) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = (currentDistance / initialDistance.current) * lastScale.current;
      
      // Limit zoom between 1x and 4x
      const newScale = Math.min(Math.max(scale, 1), 4);
      setImageScale(newScale);
    } else if (e.touches.length === 1) {
      if (isPanning.current && imageScale > 1) {
        // Pan the image when zoomed in
        e.preventDefault();
        const newX = e.touches[0].clientX - panStart.current.x;
        const newY = e.touches[0].clientY - panStart.current.y;
        setImagePosition({ x: newX, y: newY });
      } else if (!isPinching.current) {
        // Track for swipe
        touchEndX.current = e.touches[0].clientX;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isPinching.current) {
      isPinching.current = false;
      return;
    }

    if (isPanning.current) {
      isPanning.current = false;
      return;
    }

    // Only allow swipe if not zoomed in
    if (imageScale === 1 && e.touches.length === 0) {
      if (touchStartX.current - touchEndX.current > 50) {
        // Swiped left - next image
        handleNextImage();
      }
      if (touchEndX.current - touchStartX.current > 50) {
        // Swiped right - previous image
        handlePrevImage();
      }
    }
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-1 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">{t('captureScreen.title')}</h1>
          <SettingsButton />
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-36">
        {/* Project Info Pills */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">{t('captureScreen.project')}: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">
              {formatDate(new Date())}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          {/* Description Textarea */}
          <div className="relative">
            <label className="text-foreground font-medium flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-primary" />
              {t('captureScreen.fieldNotes')}
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('captureScreen.descriptionPlaceholder')}
              className="min-h-[200px] resize-none rounded-xl border-none bg-secondary text-base focus-visible:ring-2 focus-visible:ring-primary"
              maxLength={1000}
            />
            <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
              {description.length} / 1000
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => navigate("/notes", { state: { simpleMode: isSimpleMode } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{t('captureScreen.addNote')}</span>
            </button>
            <button 
              onClick={() => navigate("/checklist", { state: { simpleMode: isSimpleMode } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-6 transition-colors hover:bg-secondary"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <ListChecks className="h-8 w-8 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">{t('captureScreen.checklist')}</span>
            </button>
          </div>


          {/* Upload/Camera Section with Auto Voice Recording */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleVoiceRecord}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-primary/20 p-6 text-center text-primary transition-all hover:bg-primary/30 shadow-xl shadow-primary/50 animate-pulse ring-4 ring-primary/30"
            >
              <div className="flex items-center gap-3">
                <Camera className="h-16 w-16" />
                <Mic className="h-14 w-14" />
              </div>
              <p className="text-base font-bold text-foreground drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {t('captureScreen.takePhotosWithVoice')}
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
                {images.map((image, index) => {
                  const activeIndex = activeImages.findIndex(img => img.id === image.id);
                  return (
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
                          className="h-full w-full object-cover cursor-pointer"
                          onClick={() => setSelectedImageIndex(activeIndex)}
                        />
                        {image.caption && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                            <p className="text-[9px] text-white leading-tight line-clamp-2">
                              {image.caption}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => deleteImage(image.id)}
                          className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                )})}
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
                {t('captureScreen.discardAll')}
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 z-20 w-full bg-background/80 p-4 backdrop-blur-lg">
        <Button
          onClick={generateSummary}
          disabled={isGenerating}
          className="w-full rounded-xl bg-primary px-4 py-6 text-base font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isGenerating ? t('captureScreen.generating') : t('captureScreen.generateSummary')}
        </Button>
      </div>

      {/* Camera Dialog */}
      <CameraDialog
        open={showCameraDialog}
        onOpenChange={setShowCameraDialog}
        onCameraSelect={handleCameraSelect}
        onGallerySelect={handleGallerySelect}
        onLiveCameraSelect={handleLiveCameraSelect}
      />

      {/* Live Camera Capture */}
      <LiveCameraCapture
        open={showLiveCamera}
        onOpenChange={setShowLiveCamera}
        onCapture={handleLiveCameraCapture}
        isRecording={isRecording}
        isPaused={mediaRecorder?.state === 'paused'}
        onPauseRecording={handlePauseRecording}
        onStopRecording={handleStopRecording}
      />

      {/* Full-size Image Viewer */}
      <Dialog open={selectedImageIndex !== null} onOpenChange={() => setSelectedImageIndex(null)}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {selectedImageIndex !== null && activeImages[selectedImageIndex] && (
              <>
                <img
                  src={activeImages[selectedImageIndex].url}
                  alt="Full size view"
                  className="max-w-full max-h-[95vh] object-contain transition-transform duration-200"
                  style={{
                    transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                    touchAction: 'none'
                  }}
                />
                
                {/* Navigation Arrows */}
                {activeImages.length > 1 && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-all"
                    >
                      <ChevronLeft className="h-8 w-8" />
                    </button>
                    <button
                      onClick={handleNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-all"
                    >
                      <ChevronRight className="h-8 w-8" />
                    </button>
                    
                    {/* Image Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
                      {selectedImageIndex + 1} / {activeImages.length}
                      {imageScale > 1 && ` • ${imageScale.toFixed(1)}x`}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress Dialog */}
      <Dialog open={isGenerating} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md [&>button]:hidden">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">{t('captureScreen.generatingTitle')}</DialogTitle>
            <DialogDescription className="text-center pt-2">
              {t('captureScreen.analyzingContent')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={generationProgress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">
              {t('captureScreen.estimatedTime')}
            </p>
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CaptureScreen;
