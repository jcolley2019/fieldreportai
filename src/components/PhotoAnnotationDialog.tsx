import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowUp,
  Circle,
  Type,
  Pencil,
  Undo2,
  Redo2,
  Check,
  X,
  Palette,
  Minus,
  Plus,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type Tool = "arrow" | "circle" | "text" | "freehand";

interface Point {
  x: number;
  y: number;
}

interface Annotation {
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  strokeWidth: number;
  text?: string;
}

interface PhotoAnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  onSave: (annotatedImageUrl: string, annotatedFile: File) => void;
}

const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#ffffff", // white
  "#000000", // black
];

export const PhotoAnnotationDialog = ({
  open,
  onOpenChange,
  imageUrl,
  onSave,
}: PhotoAnnotationDialogProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("arrow");
  const [selectedColor, setSelectedColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoneAnnotations, setUndoneAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [textInput, setTextInput] = useState("");
  const [textPosition, setTextPosition] = useState<Point | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Load the image when the dialog opens
  useEffect(() => {
    if (open && imageUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageRef.current = img;
        setImageLoaded(true);
        
        // Calculate dimensions to fit in container
        const maxWidth = Math.min(window.innerWidth - 48, 800);
        const maxHeight = window.innerHeight - 280;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        
        setImageDimensions({
          width: Math.floor(img.width * scale),
          height: Math.floor(img.height * scale),
        });
      };
      img.src = imageUrl;
    }
  }, [open, imageUrl]);

  // Draw the canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !imageRef.current || !imageLoaded) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Draw all annotations
    annotations.forEach((annotation) => {
      drawAnnotation(ctx, annotation);
    });

    // Draw current drawing
    if (isDrawing && currentPoints.length > 0) {
      drawAnnotation(ctx, {
        id: "current",
        type: selectedTool,
        points: currentPoints,
        color: selectedColor,
        strokeWidth,
      });
    }
  }, [annotations, isDrawing, currentPoints, selectedTool, selectedColor, strokeWidth, imageLoaded]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const drawAnnotation = (ctx: CanvasRenderingContext2D, annotation: Annotation) => {
    ctx.strokeStyle = annotation.color;
    ctx.fillStyle = annotation.color;
    ctx.lineWidth = annotation.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    switch (annotation.type) {
      case "freehand":
        if (annotation.points.length < 2) return;
        ctx.beginPath();
        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
        for (let i = 1; i < annotation.points.length; i++) {
          ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
        }
        ctx.stroke();
        break;

      case "arrow":
        if (annotation.points.length < 2) return;
        const start = annotation.points[0];
        const end = annotation.points[annotation.points.length - 1];
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLength = 15 + annotation.strokeWidth * 2;
        
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLength * Math.cos(angle - Math.PI / 6),
          end.y - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(
          end.x - headLength * Math.cos(angle + Math.PI / 6),
          end.y - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
        break;

      case "circle":
        if (annotation.points.length < 2) return;
        const circleStart = annotation.points[0];
        const circleEnd = annotation.points[annotation.points.length - 1];
        const radius = Math.sqrt(
          Math.pow(circleEnd.x - circleStart.x, 2) +
          Math.pow(circleEnd.y - circleStart.y, 2)
        );
        
        ctx.beginPath();
        ctx.arc(circleStart.x, circleStart.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
        break;

      case "text":
        if (annotation.text && annotation.points.length > 0) {
          const fontSize = 16 + annotation.strokeWidth * 2;
          ctx.font = `bold ${fontSize}px sans-serif`;
          
          // Draw text background
          const metrics = ctx.measureText(annotation.text);
          const textHeight = fontSize;
          const padding = 4;
          
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
          ctx.fillRect(
            annotation.points[0].x - padding,
            annotation.points[0].y - textHeight - padding,
            metrics.width + padding * 2,
            textHeight + padding * 2
          );
          
          // Draw text
          ctx.fillStyle = annotation.color;
          ctx.fillText(annotation.text, annotation.points[0].x, annotation.points[0].y);
        }
        break;
    }
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCanvasPoint(e);

    if (selectedTool === "text") {
      setTextPosition(point);
      setShowTextInput(true);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([point]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const point = getCanvasPoint(e);

    if (selectedTool === "freehand") {
      setCurrentPoints((prev) => [...prev, point]);
    } else {
      setCurrentPoints((prev) => [prev[0], point]);
    }
  };

  const handleEnd = () => {
    if (!isDrawing || currentPoints.length < 2) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: selectedTool,
      points: currentPoints,
      color: selectedColor,
      strokeWidth,
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setUndoneAnnotations([]);
    setIsDrawing(false);
    setCurrentPoints([]);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim() || !textPosition) return;

    const newAnnotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      type: "text",
      points: [textPosition],
      color: selectedColor,
      strokeWidth,
      text: textInput.trim(),
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setUndoneAnnotations([]);
    setTextInput("");
    setTextPosition(null);
    setShowTextInput(false);
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    const lastAnnotation = annotations[annotations.length - 1];
    setAnnotations((prev) => prev.slice(0, -1));
    setUndoneAnnotations((prev) => [...prev, lastAnnotation]);
  };

  const handleRedo = () => {
    if (undoneAnnotations.length === 0) return;
    const lastUndone = undoneAnnotations[undoneAnnotations.length - 1];
    setUndoneAnnotations((prev) => prev.slice(0, -1));
    setAnnotations((prev) => [...prev, lastUndone]);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Convert canvas to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const file = new File([blob], `annotated-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        onSave(url, file);
        handleClose();
      },
      "image/jpeg",
      0.92
    );
  };

  const handleClose = () => {
    setAnnotations([]);
    setUndoneAnnotations([]);
    setCurrentPoints([]);
    setIsDrawing(false);
    setShowTextInput(false);
    setTextInput("");
    setTextPosition(null);
    setImageLoaded(false);
    onOpenChange(false);
  };

  const tools: { id: Tool; icon: typeof ArrowUp; label: string }[] = [
    { id: "arrow", icon: ArrowUp, label: t("annotation.arrow") },
    { id: "circle", icon: Circle, label: t("annotation.circle") },
    { id: "text", icon: Type, label: t("annotation.text") },
    { id: "freehand", icon: Pencil, label: t("annotation.freehand") },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-border">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            {t("annotation.title")}
          </DialogTitle>
        </DialogHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-muted/50">
          {/* Tool buttons */}
          <div className="flex items-center gap-1 bg-background rounded-lg p-1">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                variant={selectedTool === tool.id ? "default" : "ghost"}
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => setSelectedTool(tool.id)}
                title={tool.label}
              >
                <tool.icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {/* Color picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-2">
                <div
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: selectedColor }}
                />
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedColor === color
                        ? "border-primary ring-2 ring-primary ring-offset-2"
                        : "border-border"
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setSelectedColor(color)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Stroke width */}
          <div className="flex items-center gap-1 bg-background rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm">{strokeWidth}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* Undo/Redo */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              title={t("annotation.undo")}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={handleRedo}
              disabled={undoneAnnotations.length === 0}
              title={t("annotation.redo")}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas area */}
        <div
          ref={containerRef}
          className="relative flex items-center justify-center p-4 bg-black/90 overflow-auto"
          style={{ minHeight: "300px" }}
        >
          {imageLoaded ? (
            <canvas
              ref={canvasRef}
              width={imageDimensions.width}
              height={imageDimensions.height}
              className="border border-border rounded-lg cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          )}

          {/* Text input overlay */}
          {showTextInput && textPosition && (
            <div
              className="absolute z-10 flex items-center gap-2 p-2 bg-background rounded-lg shadow-lg"
              style={{
                left: textPosition.x + 20,
                top: textPosition.y,
              }}
            >
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={t("annotation.enterText")}
                className="w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTextSubmit();
                  if (e.key === "Escape") setShowTextInput(false);
                }}
              />
              <Button size="sm" onClick={handleTextSubmit}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowTextInput(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/50">
          <Button variant="outline" onClick={handleClose}>
            <X className="h-4 w-4 mr-2" />
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4 mr-2" />
            {t("annotation.saveAnnotation")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
