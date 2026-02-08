import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles, Clock, MapPin, Loader2, AlertCircle, Calendar } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/dateFormat";
import { PhotoTimestamp } from "@/components/PhotoTimestamp";

interface TimelinePhoto {
  id: string;
  file_path: string;
  captured_at: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  created_at: string;
  signedUrl?: string;
}

interface ProjectTimelineProps {
  projectId: string;
  projectName?: string;
  customerName?: string;
}

export const ProjectTimeline = ({ projectId, projectName, customerName }: ProjectTimelineProps) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [photos, setPhotos] = useState<TimelinePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPhotos();
  }, [projectId]);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      
      // Fetch photos ordered by captured_at or created_at
      const { data: mediaData, error } = await supabase
        .from('media')
        .select('*')
        .eq('report_id', projectId)
        .eq('file_type', 'image')
        .order('captured_at', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Generate signed URLs
      const photosWithUrls = await Promise.all(
        (mediaData || []).map(async (photo) => {
          const { data: signedUrlData } = await supabase.storage
            .from('media')
            .createSignedUrl(photo.file_path, 3600);
          
          return {
            ...photo,
            signedUrl: signedUrlData?.signedUrl || ''
          };
        })
      );

      // Sort by captured_at, falling back to created_at
      const sortedPhotos = photosWithUrls.sort((a, b) => {
        const dateA = a.captured_at || a.created_at;
        const dateB = b.captured_at || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      });

      setPhotos(sortedPhotos);
    } catch (error) {
      console.error('Error fetching timeline photos:', error);
      toast.error(t('timeline.fetchError', 'Failed to load timeline photos'));
    } finally {
      setLoading(false);
    }
  };

  const generateNarrative = async () => {
    if (photos.length === 0) {
      toast.error(t('timeline.noPhotos', 'No photos available for timeline'));
      return;
    }

    setGenerating(true);
    try {
      // Convert photos to data URLs for AI
      const imageDataUrls = await Promise.all(
        photos.slice(0, 30).map(async (photo) => { // Limit to 30 photos
          try {
            const response = await fetch(photo.signedUrl || '');
            const blob = await response.blob();
            return new Promise<{ url: string; capturedAt?: string; locationName?: string }>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                resolve({
                  url: reader.result as string,
                  capturedAt: photo.captured_at || photo.created_at,
                  locationName: photo.location_name || undefined,
                });
              };
              reader.readAsDataURL(blob);
            });
          } catch {
            return null;
          }
        })
      );

      const validImages = imageDataUrls.filter(Boolean) as { url: string; capturedAt?: string; locationName?: string }[];

      if (validImages.length === 0) {
        throw new Error('Could not process any images');
      }

      const { data, error } = await supabase.functions.invoke('generate-timeline', {
        body: {
          projectId,
          imageDataUrls: validImages,
          projectName,
          customerName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setNarrative(data.narrative);
      toast.success(t('timeline.generated', 'Timeline narrative generated'));
    } catch (error: any) {
      console.error('Error generating timeline:', error);
      if (error.message?.includes('Rate limit')) {
        toast.error(t('timeline.rateLimitError', 'Rate limit exceeded. Please try again later.'));
      } else if (error.message?.includes('Payment required')) {
        toast.error(t('timeline.creditsError', 'AI credits depleted. Please add credits.'));
      } else {
        toast.error(t('timeline.generateError', 'Failed to generate timeline'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  const getDateLabel = (photo: TimelinePhoto) => {
    const date = photo.captured_at || photo.created_at;
    return formatDate(date);
  };

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48 w-64 flex-shrink-0 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (photos.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            {t('timeline.noPhotosYet', 'No photos with timestamps yet')}
          </p>
          <p className="text-sm text-muted-foreground/70 text-center mt-1">
            {t('timeline.enableGPS', 'Enable GPS stamping in Settings to track photo dates')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {t('timeline.title', 'Project Timeline')}
            </CardTitle>
            <CardDescription>
              {t('timeline.photosCount', '{{count}} photos in chronological order', { count: photos.length })}
            </CardDescription>
          </div>
          <Button
            onClick={generateNarrative}
            disabled={generating || photos.length === 0}
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('timeline.generating', 'Generating...')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('timeline.generateNarrative', 'Generate AI Narrative')}
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Horizontal Timeline Carousel */}
        <div className="relative">
          {/* Navigation Arrows */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 backdrop-blur-sm hover:bg-background"
            onClick={scrollRight}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Timeline Line */}
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-border -translate-y-1/2" />

          {/* Photos Carousel */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide px-8 py-4 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="flex flex-col items-center flex-shrink-0 relative"
                onClick={() => setSelectedPhotoIndex(index)}
              >
                {/* Date Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-primary border-2 border-background z-10" />
                
                {/* Date Label - alternating top/bottom */}
                <div className={`text-xs text-muted-foreground font-medium mb-2 ${index % 2 === 0 ? 'order-first' : 'order-last mt-2 mb-0'}`}>
                  {getDateLabel(photo)}
                </div>

                {/* Photo Card */}
                <div className={`relative cursor-pointer transition-transform hover:scale-105 ${index % 2 === 0 ? 'mt-8' : 'mb-8'}`}>
                  <div className="w-48 h-36 rounded-lg overflow-hidden bg-secondary shadow-lg border border-border/50">
                    <img
                      src={photo.signedUrl}
                      alt={`Timeline photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <PhotoTimestamp
                      latitude={photo.latitude || undefined}
                      longitude={photo.longitude || undefined}
                      capturedAt={photo.captured_at || photo.created_at}
                      locationName={photo.location_name || undefined}
                      variant="overlay"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Generated Narrative */}
        {narrative && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">
                {t('timeline.aiNarrative', 'AI Progress Narrative')}
              </h3>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="bg-secondary/30 rounded-lg p-4 whitespace-pre-wrap text-sm">
                {narrative}
              </div>
            </div>
          </div>
        )}

        {/* Photo Detail Modal could be added here */}
      </CardContent>
    </Card>
  );
};
