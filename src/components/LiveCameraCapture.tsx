import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Check } from "lucide-react";
import { toast } from "sonner";

interface LiveCameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (files: File[]) => void;
}

export const LiveCameraCapture = ({
  open,
  onOpenChange,
  onCapture,
}: LiveCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [isReady, setIsReady] = useState(false);

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
        toast.success(`Photo captured (${capturedImages.length + 1})`);
      }
    }, "image/jpeg", 0.95);
  };

  const handleDone = () => {
    if (capturedImages.length > 0) {
      onCapture(capturedImages);
      toast.success(`${capturedImages.length} photo${capturedImages.length > 1 ? 's' : ''} added`);
    }
    onOpenChange(false);
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
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Photo counter */}
            {capturedImages.length > 0 && (
              <div className="absolute top-4 left-4 bg-primary/90 text-white px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-sm">
                {capturedImages.length} photo{capturedImages.length > 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Camera controls */}
          <div className="bg-black/90 backdrop-blur-sm p-6 flex items-center justify-center gap-6">
            {capturedImages.length > 0 && (
              <Button
                onClick={handleDone}
                size="lg"
                className="rounded-full bg-primary hover:bg-primary/90 h-14 px-8 gap-2"
              >
                <Check className="h-5 w-5" />
                Done ({capturedImages.length})
              </Button>
            )}
            
            <button
              onClick={capturePhoto}
              disabled={!isReady}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white disabled:opacity-50 hover:bg-white/90 transition-all shadow-lg"
            >
              <div className="h-16 w-16 rounded-full border-4 border-black/20 bg-white flex items-center justify-center">
                <Camera className="h-8 w-8 text-black" />
              </div>
            </button>

            {capturedImages.length === 0 && (
              <div className="w-14"></div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
