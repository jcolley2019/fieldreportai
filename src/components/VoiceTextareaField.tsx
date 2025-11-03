import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleVoiceInput = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            
            if (base64Audio) {
              toast.info("Transcribing audio...");
              
              try {
                const { data, error } = await supabase.functions.invoke('transcribe-audio', {
                  body: { audio: base64Audio }
                });

                if (error) throw error;

                if (data?.text) {
                  const newText = value ? value + " " + data.text : data.text;
                  onChange(newText.slice(0, maxLength));
                  toast.success("Transcription complete");
                } else {
                  throw new Error("No transcription returned");
                }
              } catch (error) {
                console.error('Transcription error:', error);
                toast.error("Failed to transcribe audio");
              }
            }
          };

          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        toast.success(`Recording ${label}...`);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error("Failed to access microphone");
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
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
