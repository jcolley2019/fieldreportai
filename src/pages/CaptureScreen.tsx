import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Camera, Mic, Trash2, Undo2, ChevronLeft, FileText, ChevronRight, ListChecks, ClipboardList, Pencil, Loader2, PenTool, Link2 } from "lucide-react";
import { toast } from "sonner";
import { CameraDialog } from "@/components/CameraDialog";
import CoachMarks from "@/components/CoachMarks";
import { LiveCameraCapture } from "@/components/LiveCameraCapture";
import { PhotoAnnotationDialog } from "@/components/PhotoAnnotationDialog";
import { PhotoTimestamp } from "@/components/PhotoTimestamp";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from '@/lib/dateFormat';
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useEffectiveOffline } from "@/hooks/useEffectiveOffline";
import { queueMedia, fileToArrayBuffer, type PendingMediaItem } from "@/lib/offlineQueue";
import { saveDraft, loadDraft, clearDraft, fileToBase64, base64ToFile, type DraftData } from "@/lib/draftStorage";

interface ImageItem {
  id: string;
  url: string;
  file?: File;
  originalFile?: File;
  deleted: boolean;
  caption?: string;
  voiceNote?: string;
  latitude?: number;
  longitude?: number;
  capturedAt?: Date;
  locationName?: string;
  isVideo?: boolean;
}

const CaptureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { features } = usePlanFeatures();
  const { getCurrentPosition } = useGeolocation();
  const { isEffectivelyOffline: isOffline } = useEffectiveOffline();
  const isSimpleMode = location.state?.simpleMode || false;
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showLiveCamera, setShowLiveCamera] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [editingCaptionText, setEditingCaptionText] = useState("");
  const [labelingImages, setLabelingImages] = useState<Set<string>>(new Set());
  const [annotatingImageId, setAnnotatingImageId] = useState<string | null>(null);
  const [gpsStampingEnabled, setGpsStampingEnabled] = useState(false);
  const [recordingForPhotoId, setRecordingForPhotoId] = useState<string | null>(null);
  const [photoMediaRecorder, setPhotoMediaRecorder] = useState<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load user preferences
  const [photoDescriptionMode, setPhotoDescriptionMode] = useState("ai_enhanced");
  useEffect(() => {
    const loadPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gps_stamping_enabled, photo_description_mode')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          setGpsStampingEnabled(profile.gps_stamping_enabled || false);
          setPhotoDescriptionMode(profile.photo_description_mode || "ai_enhanced");
        }
      }
    };
    loadPreferences();
  }, []);

  // Restore draft photos from IndexedDB on mount
  useEffect(() => {
    const restoreDraft = async () => {
      const draft = await loadDraft();
      if (draft && draft.images.length > 0) {
        const restoredImages: ImageItem[] = draft.images.map(di => {
          const file = di.base64 ? base64ToFile(di.base64, `restored-${di.id}.jpg`) : undefined;
          const originalFile = di.originalBase64 ? base64ToFile(di.originalBase64, `original-${di.id}.jpg`) : undefined;
          return {
            id: di.id,
            url: file ? URL.createObjectURL(file) : "",
            file,
            originalFile,
            deleted: di.deleted,
            caption: di.caption,
            voiceNote: di.voiceNote,
            latitude: di.latitude,
            longitude: di.longitude,
            capturedAt: di.capturedAt ? new Date(di.capturedAt) : undefined,
            locationName: di.locationName,
            isVideo: di.isVideo,
          };
        });
        setImages(restoredImages);
        if (draft.description) setDescription(draft.description);
        toast.info("Restored your previous captured photos");
      }
    };
    restoreDraft();
  }, []);

  // Auto-save draft to IndexedDB whenever images or description change
  const draftSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current);
    draftSaveTimeout.current = setTimeout(async () => {
      const activeImgs = images.filter(img => !img.deleted);
      if (activeImgs.length === 0 && !description) return;
      try {
        const draftImages = await Promise.all(
          images.map(async (img) => {
            let base64: string | undefined;
            let originalBase64: string | undefined;
            if (img.file) base64 = await fileToBase64(img.file);
            if (img.originalFile) originalBase64 = await fileToBase64(img.originalFile);
            return {
              id: img.id,
              base64: base64 || "",
              originalBase64: originalBase64 || null,
              caption: img.caption,
              voiceNote: img.voiceNote,
              latitude: img.latitude,
              longitude: img.longitude,
              capturedAt: img.capturedAt?.toISOString(),
              locationName: img.locationName,
              isVideo: img.isVideo,
              deleted: img.deleted,
            };
          })
        );
        await saveDraft({
          images: draftImages,
          description,
          reportId: location.state?.reportId,
          savedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Error auto-saving draft:", err);
      }
    }, 2000); // Debounce 2 seconds
    return () => { if (draftSaveTimeout.current) clearTimeout(draftSaveTimeout.current); };
  }, [images, description]);

  // Generate AI label for a photo
  const generateAILabel = async (imageId: string, file: File, voiceNote?: string) => {
    // Skip AI labeling when offline — use voice note as caption fallback
    if (isOffline) {
      if (voiceNote) {
        setImages(prev => prev.map(img =>
          img.id === imageId ? { ...img, caption: voiceNote, voiceNote } : img
        ));
      }
      return;
    }
    setLabelingImages(prev => new Set(prev).add(imageId));

    // Safety timeout: clear spinner after 30s in case something silently fails
    const safetyTimer = setTimeout(() => {
      setLabelingImages(prev => { const next = new Set(prev); next.delete(imageId); return next; });
    }, 30000);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onerror = () => {
        console.error("FileReader error for image:", imageId);
        setLabelingImages(prev => { const next = new Set(prev); next.delete(imageId); return next; });
      };

      reader.onloadend = async () => {
        try {
          const base64Data = reader.result as string;
          
          const { data, error } = await supabase.functions.invoke('label-photo', {
            body: { imageBase64: base64Data, voiceNote }
          });

          if (error) {
            console.error("Label generation error:", error);
            if (voiceNote) {
              setImages(prev => prev.map(img =>
                img.id === imageId ? { ...img, caption: voiceNote, voiceNote } : img
              ));
            }
            return;
          }

          if (data?.label) {
            setImages(prev => prev.map(img =>
              img.id === imageId ? { ...img, caption: data.label, voiceNote: voiceNote || img.voiceNote } : img
            ));
          }
        } catch (err) {
          console.error("Error in label-photo callback:", err);
        } finally {
          clearTimeout(safetyTimer);
          setLabelingImages(prev => { const next = new Set(prev); next.delete(imageId); return next; });
        }
      };
    } catch (error) {
      console.error("Error generating label:", error);
      setLabelingImages(prev => { const next = new Set(prev); next.delete(imageId); return next; });
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files) return;

    // Get GPS data only if enabled in settings
    const geoData = gpsStampingEnabled ? await getCurrentPosition() : null;

    const newImages: ImageItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      file,
      deleted: false,
      latitude: geoData?.latitude,
      longitude: geoData?.longitude,
      capturedAt: gpsStampingEnabled ? new Date() : undefined,
      locationName: geoData?.locationName
    }));

    setImages(prev => [...prev, ...newImages]);
    
    // Generate AI labels for uploaded images
    newImages.forEach(img => {
      if (img.file) {
        generateAILabel(img.id, img.file);
      }
    });
    
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

  const handleLiveCameraCapture = async (files: File[]) => {
    // Get GPS data only if enabled in settings
    const geoData = gpsStampingEnabled ? await getCurrentPosition() : null;

    const newImages: ImageItem[] = files.map(file => {
      const isVideo = file.type.startsWith('video/');
      return {
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        file,
        deleted: false,
        latitude: geoData?.latitude,
        longitude: geoData?.longitude,
        capturedAt: gpsStampingEnabled ? new Date() : undefined,
        locationName: geoData?.locationName,
        isVideo,
      };
    });

    setImages(prev => [...prev, ...newImages]);
    
    // Generate AI labels for captured images (not videos)
    newImages.forEach(img => {
      if (img.file && !img.isVideo) {
        generateAILabel(img.id, img.file);
      }
    });
  };

  const handleEditCaption = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    setEditingCaptionId(imageId);
    setEditingCaptionText(image?.caption || "");
  };

  const handleSaveCaption = () => {
    if (editingCaptionId) {
      setImages(prev => prev.map(img =>
        img.id === editingCaptionId ? { ...img, caption: editingCaptionText } : img
      ));
      setEditingCaptionId(null);
      setEditingCaptionText("");
      toast.success(t('captureScreen.captionSaved'));
    }
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const discardAll = () => {
    setImages([]);
    setDescription("");
    clearDraft();
    toast.success(t('common.allDiscarded'));
  };

  // Track when annotation dialog just closed to prevent preview dialog from closing
  const justClosedAnnotation = useRef(false);

  // Handle annotated image save - preserves original, uses annotated as display version
  const handleAnnotationSave = (imageId: string, annotatedBlob: Blob) => {
    const newUrl = URL.createObjectURL(annotatedBlob);
    const newFile = new File([annotatedBlob], `annotated-${Date.now()}.png`, { type: 'image/png' });
    
    setImages(prev => prev.map(img => {
      if (img.id !== imageId) return img;
      // Preserve original file if not already preserved
      const originalFile = img.originalFile || img.file;
      return { ...img, url: newUrl, file: newFile, originalFile };
    }));
    
    justClosedAnnotation.current = true;
    setAnnotatingImageId(null);
    setTimeout(() => { justClosedAnnotation.current = false; }, 500);
    toast.success("Annotation saved");
  };

  // Per-photo voice note recording
  const startPhotoVoiceNote = async (imageId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/wav'];
      let selectedMimeType = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { selectedMimeType = mt; break; }
      }
      const recorder = new MediaRecorder(stream, selectedMimeType ? { mimeType: selectedMimeType } : {});
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(chunks, { type: recorder.mimeType });
        setRecordingForPhotoId(null);
        setPhotoMediaRecorder(null);
        
        // Transcribe the audio
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const { data, error } = await supabase.functions.invoke('transcribe-audio', {
              body: { audio: base64Data, mimeType: audioBlob.type }
            });
            if (error || !data?.text) {
              toast.error("Failed to transcribe voice note");
              return;
            }
            // Set voice note and regenerate AI label with user context
            const image = images.find(img => img.id === imageId);
            if (image?.file) {
              setImages(prev => prev.map(img =>
                img.id === imageId ? { ...img, voiceNote: data.text } : img
              ));
              generateAILabel(imageId, image.file, data.text);
              toast.success("Voice note added to photo");
            }
          };
        } catch (err) {
          console.error("Error transcribing photo voice note:", err);
          toast.error("Error processing voice note");
        }
      };

      recorder.start();
      setRecordingForPhotoId(imageId);
      setPhotoMediaRecorder(recorder);
      toast.info("Recording voice note for photo...");
    } catch (error) {
      console.error("Error recording voice note:", error);
      toast.error("Could not access microphone");
    }
  };

  const stopPhotoVoiceNote = () => {
    if (photoMediaRecorder && photoMediaRecorder.state !== 'inactive') {
      photoMediaRecorder.stop();
    }
  };

  const handleOpenCamera = () => {
    // Just open the camera without starting audio recording
    setShowLiveCamera(true);
  };

  const handleAudioToggle = async () => {
    if (!isRecording) {
      // Start recording
      await handleStartNewRecording();
    } else {
      // Pause/Resume recording
      handlePauseRecording();
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorder && isRecording) {
      if (mediaRecorder.state === 'recording') {
        mediaRecorder.pause();
        setIsPaused(true);
      } else if (mediaRecorder.state === 'paused') {
        mediaRecorder.resume();
        setIsPaused(false);
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
      setIsPaused(false);
      // Camera stays open — user can start a new recording
    }
  };

  const handleStartNewRecording = async () => {
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
          break;
        }
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
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
      setIsPaused(false);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error(t('common.microphoneError'));
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (isOffline) {
      toast.info("You're offline — audio will be transcribed when you're back online.");
      return;
    }
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

    // ─── Offline: queue media locally ───
    if (isOffline) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("You must be logged in to save offline content.");
          return;
        }
        const reportId = location.state?.reportId || 'draft-' + Date.now();

        let queued = 0;
        for (const img of activeImgs) {
          if (!img.file) continue;
          const buffer = await fileToArrayBuffer(img.file);
          const item: PendingMediaItem = {
            id: img.id,
            reportId,
            userId: user.id,
            fileData: buffer,
            fileName: img.file.name,
            mimeType: img.file.type,
            fileType: img.isVideo ? 'video' : 'photo',
            fileSize: img.file.size,
            caption: img.caption,
            voiceNote: img.voiceNote,
            latitude: img.latitude,
            longitude: img.longitude,
            capturedAt: img.capturedAt?.toISOString(),
            locationName: img.locationName,
            createdAt: new Date().toISOString(),
          };
          await queueMedia(item);
          queued++;
        }

        toast.success(
          `Saved ${queued} item${queued > 1 ? 's' : ''} offline. They'll upload and process automatically when you're back online.`
        );
        navigate(-1);
      } catch (err) {
        console.error("Offline queue error:", err);
        toast.error("Failed to save offline. Please try again.");
      }
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
      // Convert files to base64, compressing images for AI to keep payload small & fast
      const imageWithBase64 = await Promise.all(
        activeImgs.map(async (img) => {
          if (!img.file) return { ...img, base64: null, originalBase64: null };

          // Compress image aggressively before sending to AI (max 512px, 0.6 quality)
          let fileForAI: Blob = img.file;
          if (!img.isVideo) {
            try {
              const { compressImage } = await import('@/lib/imageCompression');
              fileForAI = await compressImage(img.file, { maxWidth: 512, maxHeight: 512, quality: 0.6 });
            } catch {
              // fallback to original
            }
          }

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(img.file!);
          });

          const aiBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(fileForAI);
          });

          // Convert original file to base64 if it exists (annotation preserved original)
          let originalBase64: string | null = null;
          if (img.originalFile) {
            originalBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(img.originalFile!);
            });
          }
          
          return { ...img, base64, aiBase64, originalBase64 };
        })
      );

      // Use compressed images for AI, full images for display (cap at 10 for AI)
      const validImageDataUrls = imageWithBase64
        .map(img => (img as any).aiBase64 ?? img.base64)
        .filter(url => url !== null)
        .slice(0, 10) as string[];

      const imageCaptions = imageWithBase64.map(img => img.caption || img.voiceNote || "").slice(0, 10);

      // 90-second timeout using Promise.race
      const invokePromise = supabase.functions.invoke('generate-report-summary', {
        body: { 
          description: description || "",
          imageDataUrls: validImageDataUrls,
          imageCaptions,
          photoDescriptionMode
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AbortError: Request timed out')), 90000)
      );

      const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as Awaited<typeof invokePromise>;

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
      setTimeout(async () => {
        // Clear draft on successful navigation
        await clearDraft();
        // Navigate with the generated summary and media (including captions, geo data, and base64 data)
        navigate("/review-summary", { 
          state: { 
            simpleMode: isSimpleMode,
            summary: data.summary,
            description,
            images: imageWithBase64.map(img => ({ 
              url: img.url, 
              id: img.id, 
              caption: img.caption, 
              voiceNote: img.voiceNote,
              base64: img.base64,
              originalBase64: img.originalBase64,
              latitude: img.latitude,
              longitude: img.longitude,
              capturedAt: img.capturedAt?.toISOString(),
              locationName: img.locationName,
              isVideo: img.isVideo || false,
            }))
          } 
        });
      }, 300);
    } catch (err: any) {
      const isTimeout = err?.message?.includes('AbortError') || err?.message?.includes('timed out');
      console.error("Error generating summary:", err);
      toast.error(isTimeout 
        ? "Summary generation timed out. Your photos are saved — please try again." 
        : "Failed to generate summary. Your photos are saved — please try again.");
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
      {/* Coach Marks - first visit only */}
      <CoachMarks
        storageKey="captureScreenCoachDismissed"
        steps={[
          {
            targetSelector: '[data-coach="camera-button"]',
            title: t("coachMarks.capture.cameraTitle"),
            description: t("coachMarks.capture.cameraDesc"),
          },
          {
            targetSelector: '[data-coach="field-notes"]',
            title: t("coachMarks.capture.notesTitle"),
            description: t("coachMarks.capture.notesDesc"),
          },
          {
            targetSelector: '[data-coach="add-note-button"]',
            title: t("coachMarks.capture.addNoteTitle"),
            description: t("coachMarks.capture.addNoteDesc"),
          },
          {
            targetSelector: '[data-coach="tasks-button"]',
            title: t("coachMarks.capture.tasksTitle"),
            description: t("coachMarks.capture.tasksDesc"),
          },
          {
            targetSelector: '[data-coach="checklist-button"]',
            title: t("coachMarks.capture.checklistTitle"),
            description: t("coachMarks.capture.checklistDesc"),
          },
          {
            targetSelector: '[data-coach="generate-button"]',
            title: t("coachMarks.capture.generateTitle"),
            description: t("coachMarks.capture.generateDesc"),
          },
        ]}
      />
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('captureScreen.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <SettingsButton />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex-1 px-4 pt-4 pb-36 animate-fade-in">
        {/* Project Info Pills */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">{t('captureScreen.project')}: {location.state?.projectName || ''}</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">
              {formatDate(new Date())}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-y-6">
          {/* Description Textarea */}
          <div className="relative" data-coach="field-notes">
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
          <div className="grid grid-cols-3 gap-3">
            <button 
              data-coach="add-note-button"
              onClick={() => navigate("/notes", { state: { simpleMode: isSimpleMode } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{t('captureScreen.addNote')}</span>
            </button>
            <button 
              data-coach="tasks-button"
              onClick={() => navigate("/tasks", { state: { simpleMode: isSimpleMode } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ClipboardList className="h-7 w-7 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{t('captureScreen.tasks')}</span>
            </button>
            <button 
              data-coach="checklist-button"
              onClick={() => navigate("/checklist", { state: { simpleMode: isSimpleMode } })}
              className="flex flex-col items-center gap-3 rounded-lg bg-card p-4 transition-colors hover:bg-secondary"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <ListChecks className="h-7 w-7 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{t('captureScreen.checklist')}</span>
            </button>
          </div>


          {/* Upload/Camera Section with Auto Voice Recording */}
          <div className="flex flex-col items-center gap-4">
            <button
              data-coach="camera-button"
              onClick={handleOpenCamera}
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl bg-primary/20 p-6 text-center text-primary transition-all hover:bg-primary/30 shadow-xl shadow-primary/50 ring-4 ring-primary/30"
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
                {images.map((image) => {
                  const activeIndex = activeImages.findIndex(img => img.id === image.id);
                  return (
                    <div
                      key={image.id}
                      className="relative aspect-square w-20 flex-shrink-0 snap-start overflow-hidden rounded-lg bg-secondary"
                    >
                      {image.isVideo ? (
                        <div className="relative h-full w-full bg-secondary cursor-pointer" onClick={() => setSelectedImageIndex(activeIndex)}>
                          <video src={image.url} className="h-full w-full object-cover" muted />
                          <div className="absolute top-1 left-1 rounded bg-red-500 px-1 py-0.5 text-[8px] font-bold text-white">VIDEO</div>
                        </div>
                      ) : (
                        <img
                          src={image.url}
                          alt="Captured content"
                          className="h-full w-full object-cover cursor-pointer"
                          onClick={() => setSelectedImageIndex(activeIndex)}
                        />
                      )}
                      {labelingImages.has(image.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-5 w-5 text-white animate-spin" />
                        </div>
                      )}
                      {recordingForPhotoId === image.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                          <div className="flex flex-col items-center gap-1">
                            <Mic className="h-5 w-5 text-red-500 animate-pulse" />
                            <button onClick={(e) => { e.stopPropagation(); stopPhotoVoiceNote(); }} className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-bold text-white">Stop</button>
                          </div>
                        </div>
                      )}
                      {image.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                          <p className="text-[9px] text-white leading-tight line-clamp-2">{image.voiceNote ? '🎙 ' : ''}{image.caption}</p>
                        </div>
                      )}
                      {!image.isVideo && recordingForPhotoId !== image.id && (
                        <button onClick={(e) => { e.stopPropagation(); startPhotoVoiceNote(image.id); }}
                          className={`absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full backdrop-blur-sm ${image.voiceNote ? 'bg-green-500 text-white' : 'bg-black/50 text-white/90 hover:bg-black/70'}`}
                          title="Record voice note">
                          <Mic className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={(e) => { e.stopPropagation(); handleEditCaption(image.id); }}
                        className="absolute top-1 left-7 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70">
                        <Pencil className="h-3 w-3" />
                      </button>
                      {!image.isVideo && (
                        <button onClick={(e) => { e.stopPropagation(); setAnnotatingImageId(image.id); }}
                          className="absolute top-1 left-[52px] flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white backdrop-blur-sm hover:bg-primary/80" title="Annotate photo">
                          <PenTool className="h-3 w-3" />
                        </button>
                      )}
                      <button onClick={() => deleteImage(image.id)}
                        className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white/90 backdrop-blur-sm hover:bg-black/70">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
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
          data-coach="generate-button"
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
        isPaused={isPaused}
        onPauseRecording={handlePauseRecording}
        onStopRecording={handleStopRecording}
        onStartRecording={handleStartNewRecording}
        maxRecordingSeconds={features.maxRecordingSeconds}
        onRecordingLimitReached={() => {
          toast.info(t('captureScreen.upgradeToPremium'));
        }}
        isAudioRecording={isRecording}
        onAudioToggle={handleAudioToggle}
      />

      {/* Full-size Image Viewer */}
      <Dialog open={selectedImageIndex !== null} onOpenChange={(open) => { if (!open && justClosedAnnotation.current) return; if (!open) setSelectedImageIndex(null); }}>
        <DialogContent 
          className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {selectedImageIndex !== null && activeImages[selectedImageIndex] && (
              <>
                {activeImages[selectedImageIndex].isVideo ? (
                  <video
                    src={activeImages[selectedImageIndex].url}
                    controls
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                ) : (
                  <img
                    src={activeImages[selectedImageIndex].url}
                    alt="Full size view"
                    className="max-w-full max-h-[80vh] object-contain transition-transform duration-200"
                    style={{
                      transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
                      touchAction: 'none'
                    }}
                  />
                )}
                
                {/* GPS & Timestamp overlay */}
                <PhotoTimestamp
                  latitude={activeImages[selectedImageIndex].latitude}
                  longitude={activeImages[selectedImageIndex].longitude}
                  capturedAt={activeImages[selectedImageIndex].capturedAt}
                  locationName={activeImages[selectedImageIndex].locationName}
                  variant="overlay"
                  className="pointer-events-none"
                />
                
                {/* Top action bar */}
                <div className="absolute top-4 right-4 flex items-center gap-2" onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
                  {/* Voice note button */}
                  {!activeImages[selectedImageIndex].isVideo && recordingForPhotoId !== activeImages[selectedImageIndex].id && (
                    <button
                      onClick={() => startPhotoVoiceNote(activeImages[selectedImageIndex].id)}
                      className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-all ${activeImages[selectedImageIndex].voiceNote ? 'bg-green-500 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}
                      title="Record voice note"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                  {recordingForPhotoId === activeImages[selectedImageIndex].id && (
                    <button
                      onClick={() => stopPhotoVoiceNote()}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white animate-pulse backdrop-blur-sm"
                      title="Stop recording"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                  {/* Edit caption button */}
                  <button
                    onClick={() => handleEditCaption(activeImages[selectedImageIndex].id)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-all"
                    title="Edit caption"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  {/* Annotate button */}
                  {!activeImages[selectedImageIndex].isVideo && (
                    <button
                      onClick={() => setAnnotatingImageId(activeImages[selectedImageIndex].id)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white backdrop-blur-sm hover:bg-primary/80 transition-all"
                      title="Annotate photo"
                    >
                      <PenTool className="h-5 w-5" />
                    </button>
                  )}
                  {/* Delete button */}
                  <button
                    onClick={() => { deleteImage(activeImages[selectedImageIndex].id); setSelectedImageIndex(null); }}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-white backdrop-blur-sm hover:bg-destructive/80 transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Caption overlay at bottom */}
                {activeImages[selectedImageIndex].caption && (
                  <div className="absolute bottom-20 left-4 right-4 bg-black/70 px-4 py-3 rounded-xl backdrop-blur-sm">
                    <p className="text-sm text-white">{activeImages[selectedImageIndex].voiceNote ? '🎙 ' : ''}{activeImages[selectedImageIndex].caption}</p>
                  </div>
                )}
                
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
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm backdrop-blur-sm">
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

      {/* Caption Edit Dialog */}
      <Dialog open={editingCaptionId !== null} onOpenChange={() => setEditingCaptionId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('captureScreen.editCaption')}</DialogTitle>
            <DialogDescription>
              {t('captureScreen.editCaptionDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              value={editingCaptionText}
              onChange={(e) => setEditingCaptionText(e.target.value)}
              placeholder={t('captureScreen.captionPlaceholder')}
              className="w-full"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setEditingCaptionId(null)}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSaveCaption}
                className="flex-1"
              >
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photo Annotation Dialog */}
      {annotatingImageId && (
        <PhotoAnnotationDialog
          open={!!annotatingImageId}
          onClose={() => setAnnotatingImageId(null)}
          imageUrl={images.find(img => img.id === annotatingImageId)?.url || ""}
          onSave={(blob) => handleAnnotationSave(annotatingImageId, blob)}
        />
      )}
    </div>
  );
};

export default CaptureScreen;
