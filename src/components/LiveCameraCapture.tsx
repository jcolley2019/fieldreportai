import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Check, Pause, Play } from "lucide-react";
import { toast } from "sonner";

interface LiveCameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (files: File[]) => void;
  isRecording?: boolean;
  isPaused?: boolean;
  onPauseRecording?: () => void;
  onStopRecording?: () => void;
}

export const LiveCameraCapture = ({
  open,
  onOpenChange,
  onCapture,
  isRecording = false,
  isPaused = false,
  onPauseRecording,
  onStopRecording,
}: LiveCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImages([]);
    }

    return () => {
      stopCamera();
    };
  }, [open]);

  // Timer effect for recording duration
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Reset duration when recording stops
    if (!isRecording) {
      setRecordingDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsReady(true);
        };
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera");
      onOpenChange(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob and then to file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setCapturedImages((prev) => [...prev, file]);
      }
    }, "image/jpeg", 0.95);
  };

  const handleDone = () => {
    if (capturedImages.length > 0) {
      onCapture(capturedImages);
    }
    
    // If recording is active, stop it
    if (isRecording && onStopRecording) {
      onStopRecording();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Camera viewfinder */}
          <div className="relative flex-1 flex items-center justify-center bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Close button */}
            <button
              onClick={() => {
                if (isRecording && onStopRecording) {
                  onStopRecording();
                } else {
                  onOpenChange(false);
                }
              }}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-3 bg-destructive text-white px-6 py-3 rounded-full text-lg font-bold backdrop-blur-sm shadow-lg shadow-destructive/50 animate-in fade-in">
                <div className={`h-4 w-4 rounded-full bg-white ${isPaused ? '' : 'animate-pulse'}`}></div>
                <span>{isPaused ? 'Paused' : 'Recording'}</span>
                <span className="font-mono">{formatDuration(recordingDuration)}</span>
              </div>
            )}

            {/* Photo counter */}
            {capturedImages.length > 0 && !isRecording && (
              <div className="absolute top-4 left-4 bg-primary/90 text-white px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm">
                {capturedImages.length} photo{capturedImages.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="bg-black/90 backdrop-blur-sm p-4 flex items-center justify-between gap-3 w-full max-w-[600px] mx-auto">
            {/* Audio pause/resume button (if recording) */}
            {isRecording && onPauseRecording && (
              <Button
                onClick={onPauseRecording}
                size="sm"
                variant="outline"
                className="rounded-full h-12 px-4 gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20 text-sm flex-shrink-0"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4" />
                    <span className="hidden sm:inline">Resume</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    <span className="hidden sm:inline">Pause</span>
                  </>
                )}
              </Button>
            )}

            {capturedImages.length > 0 && (
              <Button
                onClick={handleDone}
                size="sm"
                className="rounded-full bg-primary hover:bg-primary/90 h-12 px-5 gap-2 text-sm flex-shrink-0"
              >
                <Check className="h-4 w-4" />
                Done ({capturedImages.length})
              </Button>
            )}
            
            <button
              onClick={capturePhoto}
              disabled={!isReady}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white disabled:opacity-50 hover:bg-white/90 transition-all shadow-lg flex-shrink-0"
            >
              <div className="h-12 w-12 rounded-full border-4 border-black/20 bg-white flex items-center justify-center">
                <Camera className="h-6 w-6 text-black" />
              </div>
            </button>

            {capturedImages.length === 0 && !isRecording && (
              <div className="w-12"></div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
