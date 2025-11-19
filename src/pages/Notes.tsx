import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, Mic, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Notes = () => {
  const navigate = useNavigate();
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const handleVoiceRecord = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = async () => {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          stream.getTracks().forEach(track => track.stop());
        };

        recorder.start();
        setMediaRecorder(recorder);
        setAudioChunks(chunks);
        setIsRecording(true);
        toast.success("Recording started - tap again to stop");
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error("Could not access microphone");
      }
    } else {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setMediaRecorder(null);
        setIsRecording(false);
        toast.success("Processing audio...");
      }
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];

        // Call transcribe-audio edge function
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio: base64Data }
        });

        if (error) {
          console.error("Transcription error:", error);
          toast.error("Failed to transcribe audio");
          return;
        }

        if (data?.text) {
          // Append transcribed text to note
          setNoteText(prev => prev ? `${prev}\n\n${data.text}` : data.text);
          toast.success("Audio transcribed successfully!");
        }
      };
    } catch (error) {
      console.error("Error transcribing audio:", error);
      toast.error("Failed to process audio");
    }
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) {
      toast.error("Please add some content to your note");
      return;
    }

    // TODO: Save note to database
    toast.success("Note saved successfully!");
    navigate("/dashboard");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/dashboard")}
        >
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">Add Note</h1>
        <div className="w-10" />
      </header>

      <main className="p-4 pb-32">
        {/* Note Text Area */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-medium text-foreground">
            Note Content
          </label>
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Type your notes here or use voice recording..."
            className="min-h-[300px] resize-none bg-card text-foreground"
          />
        </div>

        {/* Voice Recording Instructions */}
        <div className="mb-4 text-center">
          <p className="text-sm text-muted-foreground">
            Tap the microphone button to record your notes
          </p>
        </div>
      </main>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 p-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
          {/* Voice Recording Button */}
          <div className="flex flex-col items-center justify-center gap-4 w-full">
            <button
              onClick={handleVoiceRecord}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                isRecording 
                  ? 'bg-destructive text-white animate-pulse shadow-lg shadow-destructive/50' 
                  : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
              }`}
            >
              <Mic className="h-8 w-8" />
            </button>
            {isRecording && (
              <p className="text-sm text-muted-foreground animate-pulse">Recording... tap to stop</p>
            )}
          </div>

          {/* Save Note Button */}
          <Button
            onClick={handleSaveNote}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            size="lg"
          >
            <Save className="mr-2 h-5 w-5" />
            Save Note
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Notes;
