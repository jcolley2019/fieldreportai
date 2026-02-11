import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Camera, X, Check, Mic, MicOff, SwitchCamera, Image, Zap, ZapOff, Grid3x3, Sparkles, Maximize2, Minimize2, ChevronDown, Pause, Square, Video } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LiveCameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (files: File[]) => void;
  isRecording?: boolean;
  isPaused?: boolean;
  onPauseRecording?: () => void;
  onStopRecording?: () => void;
  onStartRecording?: () => void;
  maxRecordingSeconds?: number;
  onRecordingLimitReached?: () => void;
  isAudioRecording?: boolean;
  onAudioToggle?: () => void;
}

export const LiveCameraCapture = ({
  open,
  onOpenChange,
  onCapture,
  isRecording = false,
  isPaused = false,
  onPauseRecording,
  onStopRecording,
  onStartRecording,
  maxRecordingSeconds = 300,
  onRecordingLimitReached,
  isAudioRecording = false,
  onAudioToggle,
}: LiveCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<File[]>([]);
  const [showGalleryReview, setShowGalleryReview] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  
  // Detect if device is desktop/laptop (no touch or large screen without touch)
  const isDesktop = typeof window !== 'undefined' && (
    !('ontouchstart' in window) || 
    (window.matchMedia('(min-width: 1024px)').matches && !navigator.maxTouchPoints)
  );
  
  // Default to front camera on desktop/laptop, back camera on mobile
  const [facingMode, setFacingMode] = useState<"user" | "environment">(isDesktop ? "user" : "environment");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [flashMode, setFlashMode] = useState<'off' | 'auto' | 'on'>('off');
  const [hdrEnabled, setHdrEnabled] = useState(false);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pinchDistance, setPinchDistance] = useState<number | null>(null);
  const [supportedZoomLevels, setSupportedZoomLevels] = useState<number[]>([0.5, 1, 2, 4, 8]);
  const [minZoomCapability, setMinZoomCapability] = useState(0.5);
  const [maxZoomCapability, setMaxZoomCapability] = useState(8);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enumerate available video devices
  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(cameras);
      return cameras;
    } catch (error) {
      console.error('Error enumerating devices:', error);
      return [];
    }
  };

  useEffect(() => {
    if (open) {
      enumerateDevices().then(() => {
        startCamera();
      });
    } else {
      stopCamera();
      setCapturedImages([]);
    }

    return () => {
      stopCamera();
    };
  }, [open, facingMode]);

  // Timer effect for recording duration with limit enforcement
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          
          // Warning at 30 seconds before limit
          if (newDuration === maxRecordingSeconds - 30) {
            toast.warning(`Recording will stop in 30 seconds (${Math.floor(maxRecordingSeconds / 60)}-minute limit)`);
          }
          
          // Stop recording when limit is reached
          if (newDuration >= maxRecordingSeconds) {
            toast.info(`Recording limit reached (${Math.floor(maxRecordingSeconds / 60)} minutes). Upgrade to Premium for longer recordings.`);
            if (onStopRecording) {
              onStopRecording();
            }
            if (onRecordingLimitReached) {
              onRecordingLimitReached();
            }
            return maxRecordingSeconds;
          }
          
          return newDuration;
        });
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
  }, [isRecording, isPaused, maxRecordingSeconds, onStopRecording, onRecordingLimitReached]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startCamera = async (deviceId?: string) => {
    try {
      // Stop any existing stream first
      stopCamera();
      
      let stream: MediaStream | null = null;
      
      // If a specific device ID is provided, use it
      if (deviceId) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
          audio: false,
        });
        setSelectedDeviceId(deviceId);
      } else if (selectedDeviceId) {
        // Use previously selected device
        stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedDeviceId } },
          audio: false,
        });
      } else {
        // Try facingMode first, fallback to any camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode },
            audio: false,
          });
        } catch (facingModeError) {
          console.warn('Failed with facingMode, trying fallback:', facingModeError);
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (videoRef.current && stream) {
        streamRef.current = stream;
        
        // Re-enumerate devices to get labels (only available after permission granted)
        await enumerateDevices();
        
        // Set up metadata handler BEFORE assigning srcObject to avoid race condition
        const handleMetadataLoaded = async () => {
          try {
            await videoRef.current?.play();
            setIsReady(true);
          } catch (playError) {
            console.error('Video play() failed:', playError);
            // Still set ready even if autoplay fails - user can still capture
            setIsReady(true);
          }
          
          // Detect supported zoom levels
          const videoTrack = stream.getVideoTracks()[0];
          const capabilities = videoTrack.getCapabilities() as any;
          
          if (capabilities.zoom) {
            const minZoom = capabilities.zoom.min ?? 1;
            const maxZoom = capabilities.zoom.max ?? 8;
            
            // Store device zoom capabilities for pinch-to-zoom
            setMinZoomCapability(minZoom);
            setMaxZoomCapability(maxZoom);
            
            // Filter available zoom levels based on device capabilities
            const allZoomLevels = [0.5, 1, 2, 4, 8];
            const supported = allZoomLevels.filter(level => level >= minZoom && level <= maxZoom);
            setSupportedZoomLevels(supported);
          } else {
            // If zoom not supported, only show 1x
            setSupportedZoomLevels([1]);
            setMinZoomCapability(1);
            setMaxZoomCapability(1);
          }
        };
        
        // Attach handler BEFORE setting srcObject
        videoRef.current.onloadedmetadata = handleMetadataLoaded;
        
        // Now set the stream - this triggers metadata loading
        videoRef.current.srcObject = stream;
        
        // Fallback: if metadata already loaded (readyState >= 1), call handler directly
        if (videoRef.current.readyState >= 1) {
          handleMetadataLoaded();
        }
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      toast.error("Could not access camera. Please check permissions.");
      // Don't auto-close - let user see the error and manually close
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

  const applyZoom = async (zoom: number) => {
    if (!streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as any;

      // Prefer native camera zoom when available
      if (capabilities.zoom) {
        const minZoom = capabilities.zoom.min ?? 1;
        const maxZoom = capabilities.zoom.max ?? 8;
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoom));

        await videoTrack.applyConstraints({
          advanced: [{ zoom: clampedZoom } as any],
        });

        setZoomLevel(clampedZoom);
        return;
      }

      // If native zoom isn't supported, gracefully handle 0.5x
      if (zoom < 1) {
        toast.error("0.5x zoom is not supported on this device");
        setZoomLevel(1);
        return;
      }

      // Fallback: use CSS transform-based zoom
      setZoomLevel(zoom);
    } catch (error) {
      console.error("Error applying zoom:", error);
      // Fall back to CSS transform if constraint fails
      setZoomLevel(zoom);
    }
  };

  const handleTapToFocus = async (e: React.MouseEvent<HTMLVideoElement> | React.TouchEvent<HTMLVideoElement>) => {
    if (!videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    const rect = video.getBoundingClientRect();
    
    // Get tap coordinates
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Calculate relative position (0-1 range)
    const x = ((clientX - rect.left) / rect.width);
    const y = ((clientY - rect.top) / rect.height);

    // Show focus indicator
    setFocusPoint({ x: x * 100, y: y * 100 });

    // Clear existing timeout
    if (focusTimeoutRef.current) {
      clearTimeout(focusTimeoutRef.current);
    }

    // Hide focus indicator after animation
    focusTimeoutRef.current = setTimeout(() => {
      setFocusPoint(null);
    }, 1500);

    // Apply focus constraints
    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as any;

      // Try to apply point of interest for focus
      if (capabilities.focusMode) {
        await videoTrack.applyConstraints({
          advanced: [{
            focusMode: 'single-shot',
            pointsOfInterest: [{ x, y }]
          } as any]
        });
      }
    } catch (error) {
      console.log("Manual focus not supported on this device");
    }
  };

  const toggleFlash = async () => {
    if (!streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as any;

      if (!capabilities.torch) {
        toast.error("Flash not supported on this device");
        return;
      }

      // Cycle through: off → auto → on → off
      const nextMode = flashMode === 'off' ? 'auto' : flashMode === 'auto' ? 'on' : 'off';
      
      // Only enable torch when mode is 'on', auto and off keep it disabled
      const torchEnabled = nextMode === 'on';
      await videoTrack.applyConstraints({
        advanced: [{ torch: torchEnabled } as any]
      });
      
      setFlashMode(nextMode);
    } catch (error) {
      console.error("Error toggling flash:", error);
      toast.error("Could not toggle flash");
    }
  };

  const toggleHDR = async () => {
    if (!streamRef.current) return;

    try {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities() as any;

      // Check if HDR is supported
      if (!capabilities.dynamicRange || !capabilities.dynamicRange.includes('high')) {
        toast.error("HDR not supported on this device");
        return;
      }

      const newHdrState = !hdrEnabled;
      
      await videoTrack.applyConstraints({
        advanced: [{ 
          dynamicRange: newHdrState ? 'high' : 'standard'
        } as any]
      });
      
      setHdrEnabled(newHdrState);
    } catch (error) {
      console.error("Error toggling HDR:", error);
      toast.error("Could not toggle HDR");
    }
  };

  const getDistance = (touch1: React.Touch, touch2: React.Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePinchStart = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = getDistance(e.touches[0], e.touches[1]);
      setPinchDistance(distance);
    }
  };

  const handlePinchMove = (e: React.TouchEvent<HTMLVideoElement>) => {
    if (e.touches.length === 2 && pinchDistance !== null) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const scale = currentDistance / pinchDistance;
      
      // Calculate new zoom level
      let newZoom = zoomLevel * scale;
      
      // Clamp between device's min and max zoom capabilities
      newZoom = Math.max(minZoomCapability, Math.min(maxZoomCapability, newZoom));
      
      applyZoom(newZoom);
      setPinchDistance(currentDistance);
    }
  };

  const handlePinchEnd = () => {
    setPinchDistance(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Camera not ready. Please try again.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      toast.error('Could not capture photo. Please try again.');
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast.error('Camera not ready. Please wait for camera to initialize.');
      return;
    }

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
      } else {
        toast.error('Could not save photo. Please try again.');
      }
    }, "image/jpeg", 0.95);
  };

  const handleDone = () => {
    if (capturedImages.length > 0) {
      onCapture(capturedImages);
      onOpenChange(false);
    } else if (isRecording && onStopRecording) {
      onStopRecording();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={`!flex !flex-col p-0 overflow-hidden bg-black border-none transition-all duration-300 [&>button]:hidden ${
          isFullscreen 
            ? 'max-w-none w-screen h-screen rounded-none' 
            : 'max-w-[95vw] sm:max-w-[95vw] h-[95vh] max-h-[95vh]'
        }`}
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>Camera Capture</DialogTitle>
        </VisuallyHidden>
        <div className="relative w-full h-full flex flex-col flex-1 min-h-0">
          {/* Camera viewfinder */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden" style={{ minHeight: '200px' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover cursor-crosshair"
              style={{ transform: `scale(${Math.max(1, zoomLevel)})` }}
               onClick={handleTapToFocus}
              onTouchStart={(e) => {
                if (e.touches.length === 2) {
                  handlePinchStart(e);
                } else {
                  handleTapToFocus(e);
                }
              }}
              onTouchMove={handlePinchMove}
              onTouchEnd={handlePinchEnd}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Focus Indicator */}
            {focusPoint && (
              <div
                className="absolute w-20 h-20 border-2 border-yellow-400 rounded-sm pointer-events-none animate-[focus-pulse_0.3s_ease-out]"
                style={{
                  left: `${focusPoint.x}%`,
                  top: `${focusPoint.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="absolute inset-0 border border-yellow-400/50 rounded-sm scale-110" />
              </div>
            )}

            {/* Grid Overlay (Rule of Thirds) */}
            {gridEnabled && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Vertical lines */}
                <div className="absolute left-1/3 top-0 bottom-0 w-[1px] bg-white/30" />
                <div className="absolute left-2/3 top-0 bottom-0 w-[1px] bg-white/30" />
                {/* Horizontal lines */}
                <div className="absolute top-1/3 left-0 right-0 h-[1px] bg-white/30" />
                <div className="absolute top-2/3 left-0 right-0 h-[1px] bg-white/30" />
              </div>
            )}
            
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4">
              {/* Left controls */}
              <div className="flex items-center gap-2">
                {/* Close/Done button */}
                <button
                  onClick={() => {
                    if (capturedImages.length > 0) {
                      // Save images before closing
                      handleDone();
                    } else if (isRecording && onStopRecording) {
                      onStopRecording();
                    } else {
                      onOpenChange(false);
                    }
                  }}
                  className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm transition-all duration-300 ${
                    capturedImages.length > 0
                      ? 'bg-green-500 text-white hover:bg-green-600 animate-scale-in'
                      : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <X className="h-6 w-6" />
                </button>

                {/* Flash toggle button */}
                <button
                  onClick={toggleFlash}
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
                    flashMode === 'on'
                      ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                      : flashMode === 'auto'
                      ? 'bg-yellow-500/70 text-black hover:bg-yellow-500/90'
                      : 'bg-black/50 text-white/50 hover:bg-black/70 hover:text-white'
                  }`}
                >
                  {flashMode === 'off' ? (
                    <ZapOff className="h-6 w-6" />
                  ) : flashMode === 'auto' ? (
                    <>
                      <Zap className="h-6 w-6" />
                      <span className="absolute bottom-0 right-0 text-[10px] font-bold bg-black text-white rounded-full w-4 h-4 flex items-center justify-center">A</span>
                    </>
                  ) : (
                    <Zap className="h-6 w-6" fill="currentColor" />
                  )}
                </button>

                {/* HDR toggle button */}
                <button
                  onClick={toggleHDR}
                  className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
                    hdrEnabled
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-black/50 text-white/50 hover:bg-black/70 hover:text-white'
                  }`}
                >
                  <Sparkles className="h-6 w-6" />
                </button>

                {/* Grid toggle button */}
                <button
                  onClick={() => setGridEnabled(!gridEnabled)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
                    gridEnabled
                      ? 'bg-yellow-500 text-black hover:bg-yellow-600'
                      : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Grid3x3 className="h-6 w-6" />
                </button>
              </div>

              {/* Center: Recording indicator or Camera name */}
              <div className="flex flex-col items-center gap-1">
              {isRecording ? (
                  <div className={`px-4 py-1.5 rounded-full text-sm font-semibold backdrop-blur-sm ${
                    isPaused 
                      ? 'bg-transparent' 
                      : 'bg-green-500/90'
                  }`}>
                    <span className="font-mono text-white">
                      {formatDuration(recordingDuration)}
                    </span>
                    {isPaused && (
                      <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white tracking-wider">
                        PAUSED
                      </span>
                    )}
                  </div>
                ) : (
                  /* Active camera name */
                  videoDevices.length > 0 && (
                    <div className="px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white/80 text-xs font-medium max-w-[200px] truncate">
                      {(() => {
                        const activeDevice = videoDevices.find(d => d.deviceId === selectedDeviceId);
                        if (activeDevice?.label) return activeDevice.label;
                        if (videoDevices.length === 1 && videoDevices[0].label) return videoDevices[0].label;
                        return facingMode === 'user' ? 'Front Camera' : 'Back Camera';
                      })()}
                    </div>
                  )
                )}
              </div>

              {/* Camera flip button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-6 w-6" />
                  ) : (
                    <Maximize2 className="h-6 w-6" />
                  )}
                </button>
                
                {/* Camera selector dropdown - show when multiple cameras available */}
                {videoDevices.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="flex h-12 items-center gap-1 px-3 rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                      >
                        <SwitchCamera className="h-5 w-5" />
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="end" 
                      className="z-50 bg-background border border-border shadow-lg"
                    >
                      {videoDevices.map((device, index) => (
                        <DropdownMenuItem
                          key={device.deviceId}
                          onClick={() => startCamera(device.deviceId)}
                          className={`cursor-pointer ${
                            selectedDeviceId === device.deviceId ? 'bg-primary/20' : ''
                          }`}
                        >
                          {device.label || `Camera ${index + 1}`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <button
                    onClick={toggleCamera}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
                  >
                    <SwitchCamera className="h-6 w-6" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Zoom Controls */}
          {supportedZoomLevels.length > 1 && (
            <div className="shrink-0 flex items-center justify-center py-3 bg-black/80">
              <div className="flex items-center gap-4 px-6 py-2 rounded-full bg-black/50 backdrop-blur-sm">
                {supportedZoomLevels.map((zoom) => (
                  <button
                    key={zoom}
                    onClick={() => applyZoom(zoom)}
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
          )}

          {/* Mode Toggle (VIDEO / PHOTO) */}
          <div className="shrink-0 flex items-center justify-center py-2 bg-black/90">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setCameraMode('video')}
                className={`text-sm font-semibold uppercase tracking-wider transition-all ${
                  cameraMode === 'video'
                    ? 'text-yellow-500'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Video
              </button>
              <button
                onClick={() => setCameraMode('photo')}
                className={`text-sm font-semibold uppercase tracking-wider transition-all ${
                  cameraMode === 'photo'
                    ? 'text-yellow-500'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                Photo
              </button>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="shrink-0 bg-black/95 backdrop-blur-sm p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center max-w-[600px] mx-auto">
              {isRecording && cameraMode === 'video' ? (
                <>
                  {/* Left: Gallery */}
                  <div className="flex justify-center">
                    {capturedImages.length > 0 ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowGalleryReview(true)}
                          className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all overflow-hidden border-2 border-white/20"
                        >
                          <img 
                            src={URL.createObjectURL(capturedImages[capturedImages.length - 1])} 
                            alt="Gallery"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg animate-scale-in">
                          {capturedImages.length}
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-wider text-white">Gallery</span>
                      </div>
                    ) : (
                      <div className="w-16"></div>
                    )}
                  </div>

                  {/* Center: Stop recording button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={onStopRecording}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 border-2 border-white/30"
                    >
                      <div className="h-7 w-7 rounded-[5px] bg-red-500 transition-all duration-300" />
                    </button>
                    <span className="text-sm font-semibold uppercase tracking-wider text-white">Stop</span>
                  </div>

                  {/* Right: Pause + Shutter */}
                  <div className="flex items-end justify-center gap-3">
                    {onPauseRecording && (
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={onPauseRecording}
                          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                            isPaused
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-green-500 hover:bg-green-600'
                          }`}
                        >
                          {isPaused ? (
                            <div className="h-7 w-7 rounded-full bg-red-300" />
                          ) : (
                            <Pause className="h-7 w-7 text-white" fill="white" />
                          )}
                        </button>
                        <span className="text-sm font-semibold uppercase tracking-wider text-white">
                          {isPaused ? 'Resume' : 'Pause'}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={capturePhoto}
                        disabled={!isReady}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-white disabled:opacity-50 hover:scale-105 transition-all shadow-lg border-2 border-white/80"
                      >
                        <div className="h-10 w-10 rounded-full bg-white" />
                      </button>
                      <span className="text-sm font-semibold uppercase tracking-wider text-white">Photo</span>
                    </div>
                  </div>
                </>
              ) : cameraMode === 'video' && onStartRecording ? (
                <>
                  {/* Left: Gallery */}
                  <div className="flex justify-center">
                    {capturedImages.length > 0 ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowGalleryReview(true)}
                          className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all overflow-hidden border-2 border-white/20"
                        >
                          <img 
                            src={URL.createObjectURL(capturedImages[capturedImages.length - 1])} 
                            alt="Gallery"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg animate-scale-in">
                          {capturedImages.length}
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-wider text-white">Gallery</span>
                      </div>
                    ) : (
                      <div className="w-16"></div>
                    )}
                  </div>

                  {/* Center: Record button */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={onStartRecording}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all duration-300 border-2 border-white/30"
                    >
                      <div className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-300" />
                    </button>
                    <span className="text-sm font-semibold uppercase tracking-wider text-white">Record</span>
                  </div>

                  {/* Right: spacer */}
                  <div></div>
                </>
              ) : (
                <>
                  {/* Photo mode: Gallery / Shutter / Audio */}
                  {/* Left: Gallery */}
                  <div className="flex justify-center">
                    {capturedImages.length > 0 ? (
                      <div className="relative flex flex-col items-center gap-1">
                        <button
                          onClick={() => setShowGalleryReview(true)}
                          className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-all overflow-hidden border-2 border-white/20"
                        >
                          <img 
                            src={URL.createObjectURL(capturedImages[capturedImages.length - 1])} 
                            alt="Last captured"
                            className="w-full h-full object-cover"
                          />
                        </button>
                        <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg animate-scale-in">
                          {capturedImages.length}
                        </div>
                        <span className="text-sm font-semibold uppercase tracking-wider text-white">Gallery</span>
                      </div>
                    ) : (
                      <div className="w-16"></div>
                    )}
                  </div>

                  {/* Center: Shutter */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={capturePhoto}
                      disabled={!isReady}
                      className="flex h-20 w-20 items-center justify-center rounded-full bg-white disabled:opacity-50 hover:scale-105 transition-all shadow-2xl"
                    >
                      <div className="h-16 w-16 rounded-full border-4 border-black/10 bg-white flex items-center justify-center">
                        <Camera className="h-10 w-10 text-black" />
                      </div>
                    </button>
                    <span className="text-sm font-semibold uppercase tracking-wider text-white">Photo</span>
                  </div>

                  {/* Right: Audio */}
                  <div className="flex justify-center">
                    {onAudioToggle ? (
                      <div className="flex items-end gap-3">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={onAudioToggle}
                            className={`flex h-16 w-16 items-center justify-center rounded-full transition-all ${
                              isAudioRecording && !isPaused
                                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                                : isAudioRecording && isPaused
                                  ? 'bg-yellow-500 hover:bg-yellow-600'
                                  : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
                            }`}
                          >
                            {isAudioRecording ? (
                              isPaused ? (
                                <Mic className="h-7 w-7 text-white" />
                              ) : (
                                <MicOff className="h-7 w-7 text-white" />
                              )
                            ) : (
                              <Mic className="h-7 w-7 text-white" />
                            )}
                          </button>
                          <span className="text-sm font-semibold uppercase tracking-wider text-white">
                            AI Notes
                          </span>
                        </div>
                        {isAudioRecording && onStopRecording && (
                          <div className="flex flex-col items-center gap-1">
                            <button
                              onClick={onStopRecording}
                              className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-all border-2 border-white/30"
                            >
                              <div className="h-5 w-5 rounded-sm bg-red-500" />
                            </button>
                            <span className="text-xs font-semibold uppercase tracking-wider text-white">
                              Stop
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-16"></div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Gallery Review Dialog */}
    {showGalleryReview && (
      <Dialog open={showGalleryReview} onOpenChange={setShowGalleryReview}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-black border-border">
          <VisuallyHidden>
            <DialogTitle>Photo Gallery</DialogTitle>
            <DialogDescription>Review your captured photos</DialogDescription>
          </VisuallyHidden>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {capturedImages.length} Photo{capturedImages.length !== 1 ? 's' : ''} Captured
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {capturedImages.map((file, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-white/20 group">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white text-[10px] font-bold">
                    {index + 1}
                  </div>
                  <button
                    onClick={() => setCapturedImages(prev => prev.filter((_, i) => i !== index))}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-all"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
};
