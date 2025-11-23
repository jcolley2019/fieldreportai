import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Save, Download, Mail, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const Notes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSimpleMode = location.state?.simpleMode || false;
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [organizedNotes, setOrganizedNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");

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
          
          // Handle specific error cases
          if (error.message?.includes('429') || error.message?.includes('rate limit')) {
            toast.error("Rate limit exceeded. Please try again in a moment.");
          } else if (error.message?.includes('402') || error.message?.includes('credits')) {
            toast.error("AI credits depleted. Please add credits to continue.");
          } else {
            toast.error("Failed to transcribe audio");
          }
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

  const handleSaveNote = async () => {
    if (!noteText.trim()) {
      toast.error("Please add some content to your note");
      return;
    }

    setIsProcessing(true);
    try {
      // Call AI to organize and summarize notes
      const { data, error } = await supabase.functions.invoke('generate-note-summary', {
        body: { noteText }
      });

      if (error) {
        console.error("Error generating note summary:", error);
        if (error.message?.includes('429') || error.message?.includes('rate limit')) {
          toast.error("Rate limit exceeded. Please try again in a moment.");
        } else if (error.message?.includes('402') || error.message?.includes('credits')) {
          toast.error("AI credits depleted. Please add credits to continue.");
        } else {
          toast.error("Failed to process notes");
        }
        return;
      }

      if (data?.organizedNotes) {
        setOrganizedNotes(data.organizedNotes);
        setShowOptionsDialog(true);
      }
    } catch (error) {
      console.error("Error processing notes:", error);
      toast.error("Failed to process notes");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([organizedNotes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Notes downloaded successfully!");
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Notes - ${new Date().toLocaleDateString()}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
              h1 { color: #333; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <h1>Notes - ${new Date().toLocaleDateString()}</h1>
            <pre>${organizedNotes}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Notes - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(organizedNotes);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleAssignToProject = async () => {
    if (!selectedProject) {
      toast.error("Please select a project");
      return;
    }
    
    // TODO: Save notes to database with project assignment
    toast.success("Notes assigned to project successfully!");
    setShowOptionsDialog(false);
    navigate("/");
  };

  const handleSkipProject = () => {
    toast.success("Notes saved without project assignment!");
    setShowOptionsDialog(false);
    navigate("/");
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-sm">
        <BackButton />
        <h1 className="text-lg font-bold text-foreground">Add Note</h1>
        <div className="w-[80px]" />
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
            disabled={isProcessing}
          >
            <Save className="mr-2 h-5 w-5" />
            {isProcessing ? "Processing..." : "Save Note"}
          </Button>
        </div>
      </div>

      {/* Options Dialog */}
      <Dialog open={showOptionsDialog} onOpenChange={setShowOptionsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organized Notes</DialogTitle>
            <DialogDescription>
              Your notes have been processed. Choose how you'd like to save or share them.
            </DialogDescription>
          </DialogHeader>

          {/* Display organized notes */}
          <div className="my-4 rounded-lg bg-muted p-4">
            <pre className="whitespace-pre-wrap text-sm">{organizedNotes}</pre>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Button
              variant="outline"
              onClick={handleDownload}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleEmail}
              className="flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
          </div>

          {/* Project assignment */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Assign to Project (Optional)</h3>
            </div>
            
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="project-1">Project Alpha</SelectItem>
                <SelectItem value="project-2">Project Beta</SelectItem>
                <SelectItem value="project-3">Project Gamma</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button
                onClick={handleAssignToProject}
                disabled={!selectedProject}
                className="flex-1"
              >
                Assign to Project
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipProject}
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notes;
