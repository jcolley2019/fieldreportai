import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface VoiceInputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export const VoiceInputField = ({
  label,
  value,
  onChange,
  placeholder,
  required = false,
}: VoiceInputFieldProps) => {
  const [isRecording, setIsRecording] = useState(false);

  const handleVoiceInput = () => {
    if (!isRecording) {
      // Start recording
      setIsRecording(true);
      toast.success(`Recording ${label}...`);
      
      // Simulate voice input (in production, this would use actual speech-to-text)
      setTimeout(() => {
        setIsRecording(false);
        toast.success("Recording complete");
        // This is a placeholder - in production, you'd integrate actual speech recognition
      }, 2000);
    } else {
      // Stop recording
      setIsRecording(false);
      toast.success("Recording stopped");
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={label.toLowerCase().replace(/\s/g, '-')}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="flex gap-2">
        <Input
          id={label.toLowerCase().replace(/\s/g, '-')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-card text-foreground"
        />
        <Button
          type="button"
          onClick={handleVoiceInput}
          variant={isRecording ? "destructive" : "outline"}
          size="icon"
          className={isRecording ? "animate-pulse" : ""}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
