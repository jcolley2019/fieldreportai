import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Check, Mic, MicOff, SwitchCamera, Image } from "lucide-react";
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
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [zoomLevel, setZoomLevel] = useState(1);
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
  }, [open, facingMode]);

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
        video: { facingMode: facingMode },
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

  const toggleCamera = async () => {
    stopCamera();
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
    // Restart camera with new facing mode
    setTimeout(() => startCamera(), 100);
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
              style={{ transform: `scale(${zoomLevel})` }}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
              {/* Close button */}
              <button
                onClick={() => {
                  if (isRecording && onStopRecording) {
                    onStopRecording();
                  } else {
                    onOpenChange(false);
                  }
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Recording indicator */}
              {isRecording && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm shadow-lg ${
                  isPaused 
                    ? 'bg-destructive text-white shadow-destructive/50' 
                    : 'bg-green-500 text-white shadow-green-500/50'
                }`}>
                  <div className={`h-3 w-3 rounded-full bg-white ${isPaused ? '' : 'animate-pulse'}`}></div>
                  <span className="font-mono">{formatDuration(recordingDuration)}</span>
                </div>
              )}

              {/* Camera flip button */}
              <button
                onClick={toggleCamera}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              >
                <SwitchCamera className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-32 left-0 right-0 flex items-center justify-center">
            <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/50 backdrop-blur-sm">
              {[0.5, 1, 2, 4, 8].map((zoom) => (
                <button
                  key={zoom}
                  onClick={() => setZoomLevel(zoom)}
                  className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
                    zoomLevel === zoom
                      ? 'bg-yellow-500 text-black'
                      : 'text-white hover:text-yellow-500'
                  }`}
                >
                  {zoom}x
                </button>
              ))}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="bg-black/95 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between max-w-[600px] mx-auto">
              {/* Gallery preview thumbnail */}
              <button
                onClick={handleDone}
                disabled={capturedImages.length === 0}
                className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all disabled:opacity-50 overflow-hidden border-2 border-white/20"
              >
                {capturedImages.length > 0 ? (
                  <div className="relative w-full h-full">
                    <img 
                      src={URL.createObjectURL(capturedImages[capturedImages.length - 1])} 
                      alt="Last captured"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <span className="text-white text-xs font-bold">{capturedImages.length}</span>
                    </div>
                  </div>
                ) : (
                  <Image className="h-6 w-6 text-white/50" />
                )}
              </button>

              {/* Capture button */}
              <button
                onClick={capturePhoto}
                disabled={!isReady}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white disabled:opacity-50 hover:scale-105 transition-all shadow-2xl"
              >
                <div className="h-16 w-16 rounded-full border-4 border-black/10 bg-white flex items-center justify-center">
                  <Camera className="h-10 w-10 text-black" />
                </div>
              </button>

              {/* Audio control button */}
              {isRecording && onPauseRecording ? (
                <button
                  onClick={onPauseRecording}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all border-2 border-white/20"
                >
                  {isPaused ? (
                    <Mic className="h-8 w-8 text-white" />
                  ) : (
                    <MicOff className="h-8 w-8 text-white" />
                  )}
                </button>
              ) : (
                <div className="w-16"></div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
