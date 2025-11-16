import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Mic, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  text: string;
  completed: boolean;
}

interface ChecklistData {
  title: string;
  items: ChecklistItem[];
}

const Checklist = () => {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [transcription, setTranscription] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started");
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success("Recording stopped");
    }
  };

  const handleVoiceRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;
        const base64Data = base64Audio.split(',')[1];

        const { data, error } = await supabase.functions.invoke('generate-checklist', {
          body: { audio: base64Data }
        });

        if (error) {
          console.error('Error:', error);
          toast.error("Failed to generate checklist");
          setIsProcessing(false);
          return;
        }

        console.log('Response:', data);
        setTranscription(data.transcription);
        setChecklist(data.checklist);
        toast.success("Checklist generated!");
        setIsProcessing(false);
      };
    } catch (error) {
      console.error('Error processing audio:', error);
      toast.error("Failed to process audio");
      setIsProcessing(false);
    }
  };

  const toggleItem = (index: number) => {
    if (!checklist) return;
    
    const newItems = [...checklist.items];
    newItems[index] = {
      ...newItems[index],
      completed: !newItems[index].completed
    };
    
    setChecklist({
      ...checklist,
      items: newItems
    });
  };

  const clearChecklist = () => {
    setChecklist(null);
    setTranscription("");
  };

  const saveChecklist = () => {
    toast.success("Checklist saved!");
    navigate("/");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Create Checklist</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-36">
        {/* Project Info Pills */}
        <div className="flex flex-wrap gap-2 pb-4">
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">Project: Alpha Site</p>
          </div>
          <div className="flex h-7 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-secondary px-3">
            <p className="text-xs font-medium text-muted-foreground">Job #12345</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">
            Record your voice to create a checklist using AI
          </p>
        </div>

        {/* Voice Recording Button */}
        <div className="mb-6 flex justify-center">
          <Button
            onClick={handleVoiceRecord}
            disabled={isProcessing}
            size="icon"
            className={`h-32 w-32 rounded-full bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-lg ${
              isRecording ? 'animate-pulse ring-4 ring-[#1DA1F2]/30' : ''
            }`}
          >
            {isProcessing ? (
              <Loader2 className="h-12 w-12 animate-spin" />
            ) : (
              <Mic className="h-12 w-12" />
            )}
          </Button>
        </div>

        {isRecording && (
          <p className="text-center text-sm text-muted-foreground mb-6 animate-pulse">
            Recording...
          </p>
        )}

        {isProcessing && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            Processing your recording...
          </p>
        )}

        {/* Transcription Preview */}
        {transcription && (
          <div className="mb-6 p-4 bg-card rounded-lg border border-border">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-medium text-muted-foreground">Transcription</h3>
            </div>
            <p className="text-sm text-foreground">{transcription}</p>
          </div>
        )}

        {/* Checklist Preview */}
        {checklist && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">{checklist.title}</h2>
              <Button
                onClick={clearChecklist}
                variant="ghost"
                size="icon"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </Button>
            </div>

            {/* Checklist Items */}
            <div className="space-y-2">
              {checklist.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border"
                >
                  <Checkbox
                    id={`item-${index}`}
                    checked={item.completed}
                    onCheckedChange={() => toggleItem(index)}
                    className="mt-0.5"
                  />
                  <label
                    htmlFor={`item-${index}`}
                    className={`flex-1 text-sm cursor-pointer ${
                      item.completed 
                        ? 'line-through text-muted-foreground' 
                        : 'text-foreground'
                    }`}
                  >
                    {item.text}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Actions */}
      {checklist && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 px-4 py-4 backdrop-blur-sm border-t border-border">
          <Button
            onClick={saveChecklist}
            className="h-12 w-full rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Save Checklist
          </Button>
        </div>
      )}
    </div>
  );
};

export default Checklist;