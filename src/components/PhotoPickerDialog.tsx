import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MediaItem {
  id: string;
  file_path: string;
  file_type: string;
  report_id: string;
  created_at: string;
  report_name?: string;
}

interface PhotoPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mediaId: string) => void;
}

export const PhotoPickerDialog = ({ open, onOpenChange, onSelect }: PhotoPickerDialogProps) => {
  const { t } = useTranslation();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) fetchMedia();
  }, [open]);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("media")
        .select("id, file_path, file_type, report_id, created_at, reports(project_name)")
        .eq("user_id", user.id)
        .in("file_type", ["photo", "image", "video"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const items = (data || []).map((item: any) => ({
        ...item,
        report_name: item.reports?.project_name || null,
      }));
      setMedia(items);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from("media").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getSignedUrl = (filePath: string) => {
    // media bucket is private, use createSignedUrl
    return supabase.storage.from("media").createSignedUrl(filePath, 300);
  };

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (media.length > 0) {
      const fetchUrls = async () => {
        const urls: Record<string, string> = {};
        await Promise.all(
          media.map(async (item) => {
            const { data } = await supabase.storage.from("media").createSignedUrl(item.file_path, 300);
            if (data?.signedUrl) urls[item.id] = data.signedUrl;
          })
        );
        setSignedUrls(urls);
      };
      fetchUrls();
    }
  }, [media]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            {t("mediaLink.selectPhoto", { defaultValue: "Select a Photo" })}
          </DialogTitle>
          <DialogDescription>
            {t("mediaLink.selectPhotoDesc", { defaultValue: "Choose a photo or video to link" })}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : media.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {t("mediaLink.noPhotos", { defaultValue: "No photos found. Capture some photos in a project first." })}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {media.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(item.id);
                  onOpenChange(false);
                }}
                className="relative aspect-square rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-primary transition-all group"
              >
                {signedUrls[item.id] ? (
                  item.file_type === "video" ? (
                    <video
                      src={signedUrls[item.id]}
                      className="w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <img
                      src={signedUrls[item.id]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  )
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {item.report_name && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                    <p className="text-[10px] text-white truncate">{item.report_name}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
