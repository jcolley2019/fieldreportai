import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
          
          // Convert blob to base64
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
                  onChange(data.text);
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
