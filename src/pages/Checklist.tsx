import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, Mic, MicOff, Loader2 } from "lucide-react";
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
        
        // Stop all tracks
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

  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert blob to base64
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

  const saveChecklist = () => {
    toast.success("Checklist saved!");
    navigate("/");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-3 backdrop-blur-sm border-b border-border">
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

      <main className="p-4 pb-24">
        {/* Recording Section */}
        {!checklist && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Voice Recording</h2>
              <p className="text-muted-foreground">
                Describe the items you need in your checklist
              </p>
            </div>

            <div className="relative">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                size="lg"
                className={`w-24 h-24 rounded-full ${
                  isRecording 
                    ? 'bg-destructive hover:bg-destructive/90 animate-pulse' 
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="h-10 w-10 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-10 w-10" />
                ) : (
                  <Mic className="h-10 w-10" />
                )}
              </Button>
            </div>

            {isRecording && (
              <p className="text-sm text-muted-foreground animate-pulse">
                Listening...
              </p>
            )}

            {isProcessing && (
              <p className="text-sm text-muted-foreground">
                Processing your recording...
              </p>
            )}
          </div>
        )}

        {/* Transcription */}
        {transcription && !isProcessing && (
          <div className="mb-6 p-4 bg-card rounded-lg border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Transcription:</h3>
            <p className="text-foreground">{transcription}</p>
          </div>
        )}

        {/* Checklist */}
        {checklist && !isProcessing && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">{checklist.title}</h2>
              <Button
                onClick={() => {
                  setChecklist(null);
                  setTranscription("");
                }}
                variant="outline"
                size="sm"
              >
                New Recording
              </Button>
            </div>

            <div className="space-y-3">
              {checklist.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  <Checkbox
                    id={`item-${index}`}
                    checked={item.completed}
                    onCheckedChange={() => toggleItem(index)}
                    className="mt-1"
                  />
                  <label
                    htmlFor={`item-${index}`}
                    className={`flex-1 cursor-pointer ${
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

            <div className="flex gap-3">
              <Button
                onClick={saveChecklist}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Save Checklist
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Checklist;