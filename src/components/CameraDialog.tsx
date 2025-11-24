import { Camera, Image, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface CameraDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCameraSelect: () => void;
  onGallerySelect: () => void;
  onLiveCameraSelect: () => void;
  onAudioOnlySelect?: () => void;
  showAudioOptions?: boolean;
}

export const CameraDialog = ({
  open,
  onOpenChange,
  onCameraSelect,
  onGallerySelect,
  onLiveCameraSelect,
  onAudioOnlySelect,
  showAudioOptions = false,
}: CameraDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent className="sm:max-w-md z-50">
        <DialogHeader>
          <DialogTitle>
            {showAudioOptions ? "Choose Capture Mode" : "Add Photos or Videos"}
          </DialogTitle>
          <DialogDescription>
            {showAudioOptions 
              ? "Select how you want to capture content" 
              : "Choose how you want to add media to your report"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {showAudioOptions ? (
            <>
              <Button
                onClick={onLiveCameraSelect}
                className="flex h-20 w-full items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="h-6 w-6" />
                <Mic className="h-6 w-6" />
                <span className="text-base font-medium">Audio + Photo</span>
              </Button>
              <Button
                onClick={onAudioOnlySelect}
                variant="outline"
                className="flex h-20 w-full items-center justify-center gap-3"
              >
                <Mic className="h-6 w-6" />
                <span className="text-base font-medium">Audio Only</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={onLiveCameraSelect}
                className="flex h-20 w-full items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Camera className="h-6 w-6" />
                <span className="text-base font-medium">Open Camera (Multiple Photos)</span>
              </Button>
              <Button
                onClick={onCameraSelect}
                variant="outline"
                className="flex h-20 w-full items-center justify-center gap-3"
              >
                <Camera className="h-6 w-6" />
                <span className="text-base font-medium">Take Single Photo</span>
              </Button>
              <Button
                onClick={onGallerySelect}
                variant="outline"
                className="flex h-20 w-full items-center justify-center gap-3"
              >
                <Image className="h-6 w-6" />
                <span className="text-base font-medium">Choose from Gallery</span>
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
