import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Columns2, Rows2, SplitSquareVertical, Image as ImageIcon, Upload, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type LayoutType = "side-by-side" | "top-bottom" | "slider";

interface BeforeAfterComparisonProps {
  open: boolean;
  onClose: () => void;
  beforeImage?: string;
  afterImage?: string;
  logoUrl?: string;
  onExport?: (dataUrl: string) => void;
}

export const BeforeAfterComparison = ({
  open,
  onClose,
  beforeImage: initialBefore,
  afterImage: initialAfter,
  logoUrl: initialLogo,
  onExport,
}: BeforeAfterComparisonProps) => {
  const [layout, setLayout] = useState<LayoutType>("side-by-side");
  const [sliderPosition, setSliderPosition] = useState(50);
  const [beforeImage, setBeforeImage] = useState<string | null>(initialBefore || null);
  const [afterImage, setAfterImage] = useState<string | null>(initialAfter || null);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogo || null);
  const [logoPosition, setLogoPosition] = useState<"top-left" | "top-right" | "bottom-left" | "bottom-right">("bottom-right");
  const [logoOpacity, setLogoOpacity] = useState(80);
  const [logoSize, setLogoSize] = useState(15); // percentage of container width

  useEffect(() => {
    if (initialBefore) setBeforeImage(initialBefore);
    if (initialAfter) setAfterImage(initialAfter);
    if (initialLogo) setLogoUrl(initialLogo);
  }, [initialBefore, initialAfter, initialLogo]);

  const handleImageUpload = (type: "before" | "after" | "logo") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === "before") setBeforeImage(result);
      else if (type === "after") setAfterImage(result);
      else setLogoUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleExport = async () => {
    if (!beforeImage || !afterImage) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgWidth = 1200;
    const imgHeight = layout === "top-bottom" ? 1600 : 800;
    canvas.width = imgWidth;
    canvas.height = imgHeight;

    // Load images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    try {
      const [beforeImg, afterImg] = await Promise.all([
        loadImage(beforeImage),
        loadImage(afterImage),
      ]);

      // Draw based on layout
      if (layout === "side-by-side") {
        ctx.drawImage(beforeImg, 0, 0, imgWidth / 2, imgHeight);
        ctx.drawImage(afterImg, imgWidth / 2, 0, imgWidth / 2, imgHeight);
        // Add labels
        ctx.font = "bold 24px system-ui";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(10, 10, 100, 36);
        ctx.fillRect(imgWidth / 2 + 10, 10, 90, 36);
        ctx.fillStyle = "white";
        ctx.fillText("BEFORE", 20, 36);
        ctx.fillText("AFTER", imgWidth / 2 + 20, 36);
      } else if (layout === "top-bottom") {
        ctx.drawImage(beforeImg, 0, 0, imgWidth, imgHeight / 2);
        ctx.drawImage(afterImg, 0, imgHeight / 2, imgWidth, imgHeight / 2);
        // Add labels
        ctx.font = "bold 24px system-ui";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(10, 10, 100, 36);
        ctx.fillRect(10, imgHeight / 2 + 10, 90, 36);
        ctx.fillStyle = "white";
        ctx.fillText("BEFORE", 20, 36);
        ctx.fillText("AFTER", 20, imgHeight / 2 + 36);
      } else {
        // Slider mode - export at current position
        const splitX = (sliderPosition / 100) * imgWidth;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, imgHeight);
        ctx.clip();
        ctx.drawImage(beforeImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();
        
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, imgWidth - splitX, imgHeight);
        ctx.clip();
        ctx.drawImage(afterImg, 0, 0, imgWidth, imgHeight);
        ctx.restore();
        
        // Draw slider line
        ctx.strokeStyle = "white";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, imgHeight);
        ctx.stroke();
        
        // Add labels
        ctx.font = "bold 24px system-ui";
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(10, 10, 100, 36);
        ctx.fillRect(imgWidth - 100, 10, 90, 36);
        ctx.fillStyle = "white";
        ctx.fillText("BEFORE", 20, 36);
        ctx.fillText("AFTER", imgWidth - 90, 36);
      }

      // Draw logo overlay if present
      if (logoUrl) {
        try {
          const logoImg = await loadImage(logoUrl);
          const logoWidth = (logoSize / 100) * imgWidth;
          const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
          
          let x = 20;
          let y = 20;
          
          if (logoPosition.includes("right")) x = imgWidth - logoWidth - 20;
          if (logoPosition.includes("bottom")) y = imgHeight - logoHeight - 20;

          ctx.globalAlpha = logoOpacity / 100;
          ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
          ctx.globalAlpha = 1;
        } catch (e) {
          console.error("Failed to load logo:", e);
        }
      }

      const dataUrl = canvas.toDataURL("image/png");
      onExport?.(dataUrl);
      
      // Download
      const link = document.createElement("a");
      link.download = `before-after-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  const getLogoPositionClasses = () => {
    switch (logoPosition) {
      case "top-left": return "top-3 left-3";
      case "top-right": return "top-3 right-3";
      case "bottom-left": return "bottom-3 left-3";
      case "bottom-right": return "bottom-3 right-3";
    }
  };

  const renderComparison = () => {
    if (!beforeImage || !afterImage) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
          <ImageIcon className="h-12 w-12" />
          <p>Upload both before and after images to compare</p>
        </div>
      );
    }

    const logoOverlay = logoUrl && (
      <img
        src={logoUrl}
        alt="Logo overlay"
        className={cn("absolute pointer-events-none", getLogoPositionClasses())}
        style={{
          width: `${logoSize}%`,
          opacity: logoOpacity / 100,
        }}
      />
    );

    if (layout === "side-by-side") {
      return (
        <div className="relative flex gap-1 rounded-lg overflow-hidden bg-muted">
          <div className="relative flex-1">
            <img src={beforeImage} alt="Before" className="w-full h-64 object-cover" />
            <span className="absolute top-2 left-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
              BEFORE
            </span>
          </div>
          <div className="relative flex-1">
            <img src={afterImage} alt="After" className="w-full h-64 object-cover" />
            <span className="absolute top-2 left-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
              AFTER
            </span>
          </div>
          {logoOverlay}
        </div>
      );
    }

    if (layout === "top-bottom") {
      return (
        <div className="relative flex flex-col gap-1 rounded-lg overflow-hidden bg-muted">
          <div className="relative">
            <img src={beforeImage} alt="Before" className="w-full h-32 object-cover" />
            <span className="absolute top-2 left-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
              BEFORE
            </span>
          </div>
          <div className="relative">
            <img src={afterImage} alt="After" className="w-full h-32 object-cover" />
            <span className="absolute top-2 left-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
              AFTER
            </span>
          </div>
          {logoOverlay}
        </div>
      );
    }

    // Slider layout
    return (
      <div className="relative rounded-lg overflow-hidden bg-muted h-64">
        <img src={afterImage} alt="After" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={beforeImage}
            alt="Before"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ width: `${100 / (sliderPosition / 100)}%` }}
          />
        </div>
        {/* Slider handle */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg cursor-ew-resize"
          style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
            <SplitSquareVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {/* Labels */}
        <span className="absolute top-2 left-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
          BEFORE
        </span>
        <span className="absolute top-2 right-2 bg-background/80 text-foreground text-xs font-semibold px-2 py-1 rounded">
          AFTER
        </span>
        {logoOverlay}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Before & After Comparison</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Upload Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Before Image</Label>
              <div className="relative">
                {beforeImage ? (
                  <div className="relative group">
                    <img src={beforeImage} alt="Before" className="w-full h-24 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => setBeforeImage(null)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Upload Before</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload("before")} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>After Image</Label>
              <div className="relative">
                {afterImage ? (
                  <div className="relative group">
                    <img src={afterImage} alt="After" className="w-full h-24 object-cover rounded-lg border border-border" />
                    <button
                      onClick={() => setAfterImage(null)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">Upload After</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload("after")} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Layout Selection */}
          <div className="space-y-2">
            <Label>Layout</Label>
            <ToggleGroup type="single" value={layout} onValueChange={(v) => v && setLayout(v as LayoutType)} className="justify-start">
              <ToggleGroupItem value="side-by-side" aria-label="Side by side">
                <Columns2 className="h-4 w-4 mr-2" />
                Side by Side
              </ToggleGroupItem>
              <ToggleGroupItem value="top-bottom" aria-label="Top and bottom">
                <Rows2 className="h-4 w-4 mr-2" />
                Top & Bottom
              </ToggleGroupItem>
              <ToggleGroupItem value="slider" aria-label="Slider">
                <SplitSquareVertical className="h-4 w-4 mr-2" />
                Slider
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Slider control for slider layout */}
          {layout === "slider" && beforeImage && afterImage && (
            <div className="space-y-2">
              <Label>Slider Position</Label>
              <Slider
                value={[sliderPosition]}
                onValueChange={(v) => setSliderPosition(v[0])}
                min={5}
                max={95}
                step={1}
              />
            </div>
          )}

          {/* Comparison Preview */}
          {renderComparison()}

          {/* Logo Overlay Section */}
          <div className="space-y-4 border-t border-border pt-4">
            <Label className="text-base font-semibold">Logo Overlay</Label>
            
            <div className="space-y-2">
              <Label className="text-sm">Upload Logo</Label>
              {logoUrl ? (
                <div className="flex items-center gap-4">
                  <img src={logoUrl} alt="Logo" className="h-10 object-contain bg-muted rounded p-1" />
                  <Button variant="outline" size="sm" onClick={() => setLogoUrl(null)}>
                    <X className="h-3 w-3 mr-1" /> Remove
                  </Button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Upload Logo</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload("logo")} className="hidden" />
                </label>
              )}
            </div>

            {logoUrl && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Position</Label>
                    <ToggleGroup
                      type="single"
                      value={logoPosition}
                      onValueChange={(v) => v && setLogoPosition(v as typeof logoPosition)}
                      className="flex-wrap justify-start"
                    >
                      <ToggleGroupItem value="top-left" className="text-xs">Top Left</ToggleGroupItem>
                      <ToggleGroupItem value="top-right" className="text-xs">Top Right</ToggleGroupItem>
                      <ToggleGroupItem value="bottom-left" className="text-xs">Bottom Left</ToggleGroupItem>
                      <ToggleGroupItem value="bottom-right" className="text-xs">Bottom Right</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Size ({logoSize}%)</Label>
                    <Slider
                      value={[logoSize]}
                      onValueChange={(v) => setLogoSize(v[0])}
                      min={5}
                      max={40}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Opacity ({logoOpacity}%)</Label>
                    <Slider
                      value={[logoOpacity]}
                      onValueChange={(v) => setLogoOpacity(v[0])}
                      min={20}
                      max={100}
                      step={5}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!beforeImage || !afterImage}>
            <Download className="h-4 w-4 mr-2" />
            Export Comparison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
