import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Mic, MicOff, Trash2, Undo2, ChevronLeft, FileText, ChevronRight, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";
import { LiveCameraCapture } from "@/components/LiveCameraCapture";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { enUS, es } from "date-fns/locale";

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  deleted: boolean;
}

interface PreviousChecklist {
  id: string;
  title: string;
  created_at: string;
  item_count: number;
}

interface ChecklistPreview {
  id: string;
  title: string;
  created_at: string;
  report_id: string | null;
  sections: {
    category: string;
    items: {
      id: string;
      text: string;
      priority: string;
      completed: boolean;
    }[];
  }[];
  imageUrls: string[];
}

const Checklist = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isSimpleMode = location.state?.simpleMode || false;
  const projectName = location.state?.projectName || null;
  const jobNumber = location.state?.jobNumber || null;
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [previousChecklists, setPreviousChecklists] = useState<PreviousChecklist[]>([]);
  const [isLoadingChecklists, setIsLoadingChecklists] = useState(true);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [checklistPreview, setChecklistPreview] = useState<ChecklistPreview | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch previous checklists on mount
  useEffect(() => {
    fetchPreviousChecklists();
  }, []);

  const fetchPreviousChecklists = async () => {
    try {
      setIsLoadingChecklists(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Fetch last 5 checklists with item count
      const { data: checklists, error } = await supabase
        .from('checklists')
        .select(`
          id,
          title,
          created_at,
          checklist_items(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error("Error fetching checklists:", error);
        return;
      }

      // Format the data
      const formattedChecklists: PreviousChecklist[] = checklists?.map(checklist => ({
        id: checklist.id,
        title: checklist.title,
        created_at: checklist.created_at,
        item_count: Array.isArray(checklist.checklist_items) 
          ? checklist.checklist_items.length 
          : (checklist.checklist_items as any)?.count || 0
      })) || [];

      setPreviousChecklists(formattedChecklists);
    } catch (error) {
      console.error("Error fetching checklists:", error);
    } finally {
      setIsLoadingChecklists(false);
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const locale = i18n.language === 'es' ? es : enUS;
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true,
      locale 
    });
  };

  const handlePreviewChecklist = async (checklistId: string) => {
    try {
      setIsLoadingPreview(true);
      setShowPreviewDialog(true);
      
      // Fetch the full checklist with all items
      const { data: checklist, error: checklistError } = await supabase
        .from('checklists')
        .select(`
          id,
          title,
          report_id,
          created_at,
          checklist_items (
            id,
            text,
            category,
            priority,
            completed
          )
        `)
        .eq('id', checklistId)
        .single();

      if (checklistError) {
        console.error("Error fetching checklist:", checklistError);
        toast.error(i18n.language === 'es' ? 'Error al cargar la lista' : 'Failed to load checklist');
        setShowPreviewDialog(false);
        return;
      }

      if (!checklist) {
        toast.error(i18n.language === 'es' ? 'Lista no encontrada' : 'Checklist not found');
        setShowPreviewDialog(false);
        return;
      }

      // Fetch associated media if there's a report_id
      let imageUrls: string[] = [];
      if (checklist.report_id) {
        const { data: media } = await supabase
          .from('media')
          .select('file_path')
          .eq('report_id', checklist.report_id);

        if (media && media.length > 0) {
          // Generate signed URLs for private bucket access
          const signedUrls = await Promise.all(
            media.map(async (m) => {
              const { data: signedUrlData } = await supabase.storage
                .from('media')
                .createSignedUrl(m.file_path, 3600); // 1 hour expiry
              return signedUrlData?.signedUrl || '';
            })
          );
          imageUrls = signedUrls.filter(url => url !== '');
        }
      }

      // Group items by category
      const itemsByCategory: { [key: string]: any[] } = {};
      
      if (checklist.checklist_items && Array.isArray(checklist.checklist_items)) {
        checklist.checklist_items.forEach((item: any) => {
          if (!itemsByCategory[item.category]) {
            itemsByCategory[item.category] = [];
          }
          itemsByCategory[item.category].push({
            id: item.id,
            text: item.text,
            priority: item.priority,
            completed: item.completed
          });
        });
      }

      // Convert to sections format
      const sections = Object.entries(itemsByCategory).map(([category, items]) => ({
        category,
        items
      }));

      setChecklistPreview({
        id: checklist.id,
        title: checklist.title,
        created_at: checklist.created_at,
        report_id: checklist.report_id,
        sections,
        imageUrls
      });
    } catch (error) {
      console.error("Error loading checklist preview:", error);
      toast.error(i18n.language === 'es' ? 'Error al cargar la vista previa' : 'Failed to load preview');
      setShowPreviewDialog(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleNavigateToConfirmation = () => {
    if (!checklistPreview) return;

    const formattedChecklist = {
      title: checklistPreview.title,
      sections: checklistPreview.sections
    };

    navigate("/checklist-confirmation", { 
      state: { 
        checklist: formattedChecklist,
        images: checklistPreview.imageUrls,
        simpleMode: isSimpleMode,
        reportId: checklistPreview.report_id,
        checklistId: checklistPreview.id,
        isExisting: true
      } 
    });
  };

  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;

    const newImages: ImageItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file,
      deleted: false
    }));

    setImages(prev => [...prev, ...newImages]);
    toast.success(`${files.length} ${files.length > 1 ? t('checklist.imagesAdded') : t('checklist.imageAdded')}`);
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
    toast.success(t('checklist.imageDeletedToast'));
  };

  const undoDelete = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, deleted: false } : img
    ));
    toast.success(t('checklist.imageRestored'));
  };

  const discardAll = () => {
    setImages([]);
    toast.success(t('checklist.allDiscarded'));
  };

  const [isProcessingVoice, setIsProcessingVoice] = useState(false);

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
          stream.getTracks().forEach(track => track.stop());
          await transcribeAndGenerateChecklist(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }));
        };

        recorder.start();
        setMediaRecorder(recorder);
        setAudioChunks(chunks);
        setIsRecording(true);
        toast.success(t('checklist.recordingStarted'));
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error(t('checklist.microphoneError'));
      }
    } else {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        setIsRecording(false);
        toast.success(t('checklist.processingAudio'));
      }
    }
  };

  const transcribeAndGenerateChecklist = async (audioBlob: Blob) => {
    setIsProcessingVoice(true);

    // Safety timeout — force reset after 60s
    const safetyTimeout = setTimeout(() => {
      setIsProcessingVoice(false);
      toast.error(t('checklist.audioProcessFailed') || 'Processing timed out. Please try again.');
    }, 60000);

    try {
      // Convert blob to base64 using Promise wrapper
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read audio file'));
        reader.readAsDataURL(audioBlob);
      });

      const base64Data = base64Audio.split(',')[1];

      // Step 1: Transcribe the audio
      const { data: transcriptionData, error: transcriptionError } = await supabase.functions.invoke('transcribe-audio', {
        body: { audio: base64Data }
      });

      if (transcriptionError) {
        console.error("Transcription error:", transcriptionError);
        toast.error(t('checklist.transcribeFailed'));
        return;
      }

      if (!transcriptionData?.text) {
        toast.error(t('checklist.audioProcessFailed') || 'No voice detected. Please try again.');
        return;
      }

      toast.success(t('checklist.audioTranscribed'));

      // Step 2: Generate checklist from transcribed text
      const imageData: string[] = [];
      for (const img of images.filter(i => !i.deleted)) {
        if (img.file) {
          const b64 = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onloadend = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(img.file!);
          });
          imageData.push(b64);
        }
      }

      toast.success(t('checklist.generatingChecklist'));

      const { data: checklistData, error: checklistError } = await supabase.functions.invoke('generate-checklist', {
        body: {
          description: transcriptionData.text,
          images: imageData.length > 0 ? imageData : undefined
        }
      });

      if (checklistError) {
        console.error("Checklist generation error:", checklistError);
        toast.error(t('checklist.generateFailed'));
        return;
      }

      if (checklistData?.checklist) {
        toast.success(t('checklist.checklistGenerated'));
        const projectReportId = location.state?.reportId || null;
        navigate("/checklist-confirmation", {
          state: {
            checklist: checklistData.checklist,
            images: images.filter(img => !img.deleted).map(img => img.url),
            simpleMode: isSimpleMode,
            reportId: projectReportId
          }
        });
      } else {
        toast.error(t('checklist.generateFailed'));
      }
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error(t('checklist.audioProcessFailed'));
    } finally {
      clearTimeout(safetyTimeout);
      setIsProcessingVoice(false);
    }
  };

  const generateSummary = async () => {
    if (images.filter(img => !img.deleted).length === 0) {
      toast.error(t('checklist.addContentFirst'));
      return;
    }

    setIsRecording(true); // Use as loading state
    toast.success(t('checklist.generatingChecklist'));

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
          toast.error(t('checklist.rateLimitError'));
        } else if (error.message.includes("Payment required")) {
          toast.error(t('checklist.creditsError'));
        } else {
          toast.error(t('checklist.generateFailed'));
        }
        setIsRecording(false);
        return;
      }

      console.log("Checklist generated:", data);
      toast.success(t('checklist.checklistGenerated'));
      
      // Navigate to checklist-confirmation with mode and project info
      const projectReportId = location.state?.reportId || null;
      navigate("/checklist-confirmation", { 
        state: { 
          checklist: data.checklist,
          images: images.filter(img => !img.deleted).map(img => img.url),
          simpleMode: isSimpleMode,
          reportId: projectReportId
        } 
      });
    } catch (err) {
      console.error("Error:", err);
      toast.error(t('checklist.errorOccurred'));
    } finally {
      setIsRecording(false);
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
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton fallbackPath="/capture-screen" />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('checklist.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex-1 px-4 pt-4 pb-36 animate-fade-in">
        {/* Project Info Pills - Only show if there's project data */}
        {(projectName || jobNumber) && (
          <div className="flex flex-wrap gap-2 pb-4">
            {projectName && (
              <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('checklist.project')}: {projectName}
                </p>
              </div>
            )}
            {jobNumber && (
              <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('checklist.job')}: {jobNumber}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-y-6">
          {/* Upload/Camera Section */}
          <div className="flex flex-col items-center gap-4">
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

            {/* Voice Input Section */}
            <div className="w-full">
              <button
                onClick={handleVoiceRecord}
                disabled={isProcessingVoice}
                className={`flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl p-6 text-center transition-all ${
                  isRecording 
                    ? 'bg-destructive/20 ring-4 ring-destructive/30 animate-pulse' 
                    : 'bg-primary/20 hover:bg-primary/30 shadow-xl shadow-primary/50 ring-4 ring-primary/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isRecording ? (
                    <MicOff className="h-12 w-12 text-destructive" />
                  ) : isProcessingVoice ? (
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  ) : (
                    <Mic className="h-12 w-12 text-primary" />
                  )}
                </div>
                <p className="text-sm font-bold text-foreground">
                  {isRecording 
                    ? t('checklist.tapToStop')
                    : isProcessingVoice
                    ? t('checklist.processingAudio')
                    : t('checklist.tapToRecord')
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('checklist.voiceHint')}
                </p>
              </button>
            </div>

            {/* Previous Checklists Section */}
            <div className="w-full mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('checklist.previousChecklists')}</h3>
              <div className="space-y-3">
                {isLoadingChecklists ? (
                  <div className="text-center text-muted-foreground py-4">
                    {t('common.loading')}
                  </div>
                ) : previousChecklists.length === 0 ? (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    {i18n.language === 'es' 
                      ? 'No hay listas anteriores aún' 
                      : 'No previous checklists yet'}
                  </div>
                ) : (
                  previousChecklists.map((checklist) => (
                    <div 
                      key={checklist.id}
                      onClick={() => handlePreviewChecklist(checklist.id)}
                      className="rounded-lg border border-border bg-secondary p-4 hover:bg-secondary/80 transition-colors cursor-pointer"
                    >
                      <h4 className="font-medium text-foreground mb-2">{checklist.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeDate(checklist.created_at)} • {checklist.item_count} {checklist.item_count === 1 ? (i18n.language === 'es' ? 'ítem' : 'item') : (i18n.language === 'es' ? 'ítems' : 'items')}
                      </p>
                    </div>
                  ))
                )}
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
                            {t('checklist.imageDeleted')}
                          </p>
                          <button
                            onClick={() => undoDelete(image.id)}
                            className="mt-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold backdrop-blur-sm hover:bg-white/30"
                          >
                            {t('checklist.undo')}
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
            {images.length > 0 && (
              <div className="w-full text-center mt-2">
                <button
                  onClick={discardAll}
                  className="text-sm font-medium text-destructive transition-colors hover:text-destructive/80"
                >
                  {t('checklist.discardAll')}
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
          {isRecording ? t('checklist.generatingWithAI') : t('checklist.generateChecklist')}
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
        isRecording={false}
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

      {/* Checklist Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {isLoadingPreview 
                ? (i18n.language === 'es' ? 'Cargando...' : 'Loading...') 
                : checklistPreview?.title}
            </DialogTitle>
            {checklistPreview && (
              <DialogDescription>
                {formatRelativeDate(checklistPreview.created_at)}
              </DialogDescription>
            )}
          </DialogHeader>

          {isLoadingPreview ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : checklistPreview ? (
            <div className="space-y-4">
              {/* Checklist Items Preview */}
              <div className="space-y-4">
                {checklistPreview.sections.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="space-y-2">
                    <h3 className="text-lg font-semibold text-primary capitalize">
                      {section.category}
                    </h3>
                    <div className="space-y-2">
                      {section.items.map((item, itemIndex) => (
                        <div
                          key={itemIndex}
                          className="flex items-start gap-3 rounded-lg bg-secondary p-3"
                        >
                          <div className={`mt-0.5 h-4 w-4 rounded border-2 flex-shrink-0 ${
                            item.completed 
                              ? 'bg-primary border-primary' 
                              : 'border-muted-foreground'
                          }`}>
                            {item.completed && (
                              <svg className="h-full w-full text-white" viewBox="0 0 12 12" fill="none">
                                <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                              {item.text}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">
                              {item.priority} {i18n.language === 'es' ? 'prioridad' : 'priority'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Images Preview */}
              {checklistPreview.imageUrls.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {i18n.language === 'es' ? 'Imágenes' : 'Images'} ({checklistPreview.imageUrls.length})
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {checklistPreview.imageUrls.slice(0, 6).map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewDialog(false)}
                  className="flex-1"
                >
                  <X className="mr-2 h-4 w-4" />
                  {i18n.language === 'es' ? 'Cerrar' : 'Close'}
                </Button>
                <Button
                  onClick={handleNavigateToConfirmation}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {i18n.language === 'es' ? 'Ver Completo' : 'View Full'}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Checklist;
