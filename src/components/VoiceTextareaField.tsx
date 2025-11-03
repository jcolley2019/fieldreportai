import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceTextareaFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}

export const VoiceTextareaField = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  maxLength = 500,
}: VoiceTextareaFieldProps) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleVoiceInput = () => {
    if (!isRecording) {
      setIsRecording(true);
      toast.success(`Recording ${label}...`);
      
      setTimeout(() => {
        setIsRecording(false);
        toast.success("Recording complete");
      }, 2000);
    } else {
      setIsRecording(false);
      toast.success("Recording stopped");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={label.toLowerCase().replace(/\s/g, '-')}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <Textarea
          id={label.toLowerCase().replace(/\s/g, '-')}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          className="min-h-[120px] resize-none bg-card text-foreground pr-14"
          maxLength={maxLength}
        />
        <Button
          type="button"
          onClick={handleVoiceInput}
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          className={`absolute right-2 top-2 ${isRecording ? "animate-pulse" : ""}`}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {value.length} / {maxLength}
        </div>
      </div>
    </div>
  );
};
