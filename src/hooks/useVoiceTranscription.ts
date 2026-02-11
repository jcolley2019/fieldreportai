import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useVoiceTranscription = (onTranscribed: (text: string) => void) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getSupportedMimeType = () => {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm';
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        setRecordingTime(0);

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        if (audioBlob.size < 100) {
          toast.error("Recording too short");
          return;
        }

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(audioBlob);
          });

          const base64Data = await base64Promise;
          const { data, error } = await supabase.functions.invoke('transcribe-audio', {
            body: { audio: base64Data, mimeType: audioBlob.type }
          });

          if (error) throw error;
          if (data?.text) {
            onTranscribed(data.text);
            toast.success("Transcription added");
          } else {
            toast.error("No transcription received");
          }
        } catch (err) {
          console.error("Transcription error:", err);
          toast.error("Failed to transcribe audio");
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error("Mic error:", err);
      toast.error("Could not access microphone");
    }
  }, [onTranscribed]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return { isRecording, isTranscribing, recordingTime, formatTime, startRecording, stopRecording };
};
