import { Camera, Image } from "lucide-react";
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
}

export const CameraDialog = ({
  open,
  onOpenChange,
  onCameraSelect,
  onGallerySelect,
}: CameraDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Photos or Videos</DialogTitle>
          <DialogDescription>
            Choose how you want to add media to your report
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button
            onClick={onCameraSelect}
            className="flex h-20 w-full items-center justify-center gap-3 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Camera className="h-6 w-6" />
            <span className="text-base font-medium">Take Photo/Video</span>
          </Button>
          <Button
            onClick={onGallerySelect}
            variant="outline"
            className="flex h-20 w-full items-center justify-center gap-3"
          >
            <Image className="h-6 w-6" />
            <span className="text-base font-medium">Choose from Gallery</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
