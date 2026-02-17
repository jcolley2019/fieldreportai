import { useState, useRef, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Pencil, 
  Circle, 
  ArrowRight, 
  Type, 
  Undo2, 
  Redo2, 
  Trash2, 
  Download,
  MousePointer2
} from "lucide-react";
import { cn } from "@/lib/utils";

type ToolType = "select" | "pencil" | "arrow" | "circle" | "text";

interface AnnotationElement {
  id: string;
  type: "pencil" | "arrow" | "circle" | "text";
  color: string;
  strokeWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  radius?: number;
  text?: string;
  fontSize?: number;
}

interface PhotoAnnotationDialogProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string;
  onSave?: (annotatedImageBlob: Blob) => void;
}

const COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#000000" },
];

export const PhotoAnnotationDialog = ({
  open,
  onClose,
  imageUrl,
  onSave,
}: PhotoAnnotationDialogProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<ToolType>("pencil");
  const [color, setColor] = useState("#ef4444");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 0, y: 0 });
  
  const [elements, setElements] = useState<AnnotationElement[]>([]);
  const [history, setHistory] = useState<AnnotationElement[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<AnnotationElement | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [draggingElementId, setDraggingElementId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Load image and set canvas size
  useEffect(() => {
    if (!imageUrl || !open) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setLoadedImage(img);
      
      // Calculate canvas size to fit container while maintaining aspect ratio
      const maxWidth = Math.min(window.innerWidth - 100, 900);
      const maxHeight = Math.min(window.innerHeight - 300, 600);
      
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      setCanvasSize({ width, height });
    };
    img.src = imageUrl;
  }, [imageUrl, open]);

  // Redraw canvas when elements change
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !loadedImage) return;

    // Clear and draw base image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

    // Draw all elements
    const allElements = currentElement ? [...elements, currentElement] : elements;
    
    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (el.type) {
        case "pencil":
          if (el.points && el.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            el.points.forEach((point) => ctx.lineTo(point.x, point.y));
            ctx.stroke();
            
            // Selection indicator for pencil
            if (el.id === selectedElementId) {
              const xs = el.points.map(p => p.x);
              const ys = el.points.map(p => p.y);
              const minX = Math.min(...xs) - 6;
              const minY = Math.min(...ys) - 6;
              const maxX = Math.max(...xs) + 6;
              const maxY = Math.max(...ys) + 6;
              ctx.save();
              ctx.strokeStyle = "#3b82f6";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
              ctx.restore();
            }
          }
          break;

        case "arrow":
          if (el.startX !== undefined && el.startY !== undefined && 
              el.endX !== undefined && el.endY !== undefined) {
            const headLength = Math.max(15, el.strokeWidth * 4);
            const angle = Math.atan2(el.endY - el.startY, el.endX - el.startX);
            
            ctx.beginPath();
            ctx.moveTo(el.startX, el.startY);
            ctx.lineTo(el.endX, el.endY);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(el.endX, el.endY);
            ctx.lineTo(
              el.endX - headLength * Math.cos(angle - Math.PI / 6),
              el.endY - headLength * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
              el.endX - headLength * Math.cos(angle + Math.PI / 6),
              el.endY - headLength * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fill();
            // Selection indicator for arrow
            if (el.id === selectedElementId) {
              ctx.save();
              ctx.strokeStyle = "#3b82f6";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(el.startX, el.startY, 6, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(el.endX, el.endY, 6, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.restore();
            }
          }
          break;

        case "circle":
          if (el.startX !== undefined && el.startY !== undefined && el.radius !== undefined) {
            ctx.beginPath();
            ctx.arc(el.startX, el.startY, el.radius, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Selection indicator for circle
            if (el.id === selectedElementId) {
              ctx.save();
              ctx.strokeStyle = "#3b82f6";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.arc(el.startX, el.startY, el.radius + 6, 0, 2 * Math.PI);
              ctx.stroke();
              ctx.restore();
            }
          }
          break;

        case "text":
          if (el.startX !== undefined && el.startY !== undefined && el.text) {
            ctx.font = `bold ${el.fontSize || 24}px system-ui`;
            ctx.fillText(el.text, el.startX, el.startY);
            
            // Draw selection border around selected text
            if (el.id === selectedElementId) {
              const metrics = ctx.measureText(el.text);
              const textHeight = (el.fontSize || 24);
              const padding = 4;
              ctx.save();
              ctx.strokeStyle = "#3b82f6";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 4]);
              ctx.strokeRect(
                el.startX - padding,
                el.startY - textHeight + padding,
                metrics.width + padding * 2,
                textHeight + padding * 2
              );
              ctx.restore();
            }
          }
          break;
      }
    });
  }, [elements, currentElement, loadedImage, selectedElementId]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool === "select") {
      const { x, y } = getCanvasCoordinates(e);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      
      // Hit-test all elements (reverse order for top-most first)
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        
        if (el.type === "text" && el.startX !== undefined && el.startY !== undefined && el.text && ctx) {
          ctx.font = `bold ${el.fontSize || 24}px system-ui`;
          const metrics = ctx.measureText(el.text);
          const textHeight = el.fontSize || 24;
          if (x >= el.startX && x <= el.startX + metrics.width && y >= el.startY - textHeight && y <= el.startY) {
            setDraggingElementId(el.id);
            setSelectedElementId(el.id);
            setDragOffset({ x: x - el.startX, y: y - el.startY });
            return;
          }
        }
        
        if (el.type === "circle" && el.startX !== undefined && el.startY !== undefined && el.radius !== undefined) {
          const dx = x - el.startX;
          const dy = y - el.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // Hit if within the circle or near its edge
          if (dist <= el.radius + 10) {
            setDraggingElementId(el.id);
            setSelectedElementId(el.id);
            setDragOffset({ x: x - el.startX, y: y - el.startY });
            return;
          }
        }
        
        if (el.type === "arrow" && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
          // Hit-test: distance from point to line segment
          const lineLenSq = (el.endX - el.startX) ** 2 + (el.endY - el.startY) ** 2;
          let t = lineLenSq === 0 ? 0 : Math.max(0, Math.min(1, ((x - el.startX) * (el.endX - el.startX) + (y - el.startY) * (el.endY - el.startY)) / lineLenSq));
          const projX = el.startX + t * (el.endX - el.startX);
          const projY = el.startY + t * (el.endY - el.startY);
          const distToLine = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
          if (distToLine <= 15) {
            setDraggingElementId(el.id);
            setSelectedElementId(el.id);
            setDragOffset({ x: x - el.startX, y: y - el.startY });
            return;
          }
        }
        
        if (el.type === "pencil" && el.points && el.points.length > 0) {
          // Hit-test: check distance to any point in the path
          const hit = el.points.some(p => Math.sqrt((x - p.x) ** 2 + (y - p.y) ** 2) <= 15);
          if (hit) {
            setDraggingElementId(el.id);
            setSelectedElementId(el.id);
            setDragOffset({ x, y });
            return;
          }
        }
      }
      // Clicked empty area — deselect
      setSelectedElementId(null);
      setDraggingElementId(null);
      return;
    }
    
    const { x, y } = getCanvasCoordinates(e);

    if (tool === "text") {
      setTextPosition({ x, y });
      setShowTextInput(true);
      return;
    }

    setIsDrawing(true);

    const newElement: AnnotationElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: tool,
      color,
      strokeWidth,
      startX: x,
      startY: y,
      endX: x,
      endY: y,
      points: tool === "pencil" ? [{ x, y }] : undefined,
      radius: 0,
    };

    setCurrentElement(newElement);
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    // Handle dragging a selected element
    if (draggingElementId) {
      const { x, y } = getCanvasCoordinates(e);
      setElements(prev => prev.map(el => {
        if (el.id !== draggingElementId) return el;
        
        if (el.type === "arrow" && el.startX !== undefined && el.startY !== undefined && el.endX !== undefined && el.endY !== undefined) {
          const dx = x - dragOffset.x - el.startX;
          const dy = y - dragOffset.y - el.startY;
          return { ...el, startX: el.startX + dx, startY: el.startY + dy, endX: el.endX + dx, endY: el.endY + dy };
        }
        
        if (el.type === "pencil" && el.points) {
          const dx = x - dragOffset.x;
          const dy = y - dragOffset.y;
          return { ...el, points: el.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        }
        
        // text and circle use startX/startY
        return { ...el, startX: x - dragOffset.x, startY: y - dragOffset.y };
      }));
      // Update drag offset for pencil (delta-based)
      if (elements.find(el => el.id === draggingElementId)?.type === "pencil") {
        setDragOffset({ x, y });
      }
      return;
    }

    if (!isDrawing || !currentElement) return;

    const { x, y } = getCanvasCoordinates(e);

    if (currentElement.type === "pencil") {
      setCurrentElement({
        ...currentElement,
        points: [...(currentElement.points || []), { x, y }],
      });
    } else if (currentElement.type === "arrow") {
      setCurrentElement({
        ...currentElement,
        endX: x,
        endY: y,
      });
    } else if (currentElement.type === "circle") {
      const dx = x - (currentElement.startX || 0);
      const dy = y - (currentElement.startY || 0);
      setCurrentElement({
        ...currentElement,
        radius: Math.sqrt(dx * dx + dy * dy),
      });
    }
  };

  const handlePointerUp = () => {
    // Commit drag move to history
    if (draggingElementId) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...elements]);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setDraggingElementId(null);
      return;
    }

    if (!isDrawing || !currentElement) return;

    setIsDrawing(false);
    
    const newElements = [...elements, currentElement];
    setElements(newElements);
    
    // Update history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    setCurrentElement(null);
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) {
      setShowTextInput(false);
      return;
    }

    const newElement: AnnotationElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: "text",
      color,
      strokeWidth,
      fontSize,
      startX: textPosition.x,
      startY: textPosition.y,
      text: textInput,
    };

    const newElements = [...elements, newElement];
    setElements(newElements);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);

    setTextInput("");
    setShowTextInput(false);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setElements(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setElements(history[historyIndex + 1]);
    }
  };

  const handleClear = () => {
    setElements([]);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onSave?.(blob);
        onClose();
      }
    }, "image/png");
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `annotated-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto overflow-hidden">
        <DialogHeader>
          <DialogTitle>Annotate Photo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Tool Selection */}
            <ToggleGroup type="single" value={tool} onValueChange={(v) => v && setTool(v as ToolType)}>
              <ToggleGroupItem value="select" aria-label="Select">
                <MousePointer2 className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="pencil" aria-label="Pencil">
                <Pencil className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="arrow" aria-label="Arrow">
                <ArrowRight className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="circle" aria-label="Circle">
                <Circle className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem value="text" aria-label="Text">
                <Type className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>

            {/* Color Picker */}
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-transform",
                    color === c.value ? "border-primary scale-110" : "border-border"
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            {/* Stroke Width */}
            <div className="flex items-center gap-2 min-w-[120px]">
              <Label className="text-xs whitespace-nowrap">Size</Label>
              <Slider
                value={[strokeWidth]}
                onValueChange={(v) => setStrokeWidth(v[0])}
                min={1}
                max={10}
                step={1}
                className="w-20"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndex <= 0}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleRedo} disabled={historyIndex >= history.length - 1}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Canvas Container */}
          <div
            ref={containerRef}
            className="relative bg-muted rounded-lg overflow-hidden flex items-center justify-center"
            style={{ minHeight: "300px" }}
          >
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className={`touch-none ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />

            {/* Text Input Overlay */}
            {showTextInput && (
              <div
                className="absolute z-10"
                style={{
                  left: `${(textPosition.x / canvasSize.width) * 100}%`,
                  top: `${(textPosition.y / canvasSize.height) * 100}%`,
                }}
              >
                <div className="flex gap-1 bg-card p-2 rounded-lg shadow-lg border border-border">
                  <Input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Enter text..."
                    className="w-40 h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTextSubmit();
                      if (e.key === "Escape") setShowTextInput(false);
                    }}
                  />
                  <Button size="sm" onClick={handleTextSubmit}>Add</Button>
                </div>
              </div>
            )}
          </div>

          {/* Font size for text tool */}
          {tool === "text" && (
            <div className="flex items-center gap-2">
              <Label className="text-sm">Font Size: {fontSize}px</Label>
              <Slider
                value={[fontSize]}
                onValueChange={(v) => setFontSize(v[0])}
                min={12}
                max={72}
                step={2}
                className="w-40"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleSave}>
            Save Annotation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
