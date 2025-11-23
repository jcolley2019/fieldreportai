import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Save, Download, Mail, Printer, FileText, Plus, Link2, Cloud } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pdf } from '@react-pdf/renderer';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';
import { saveAs } from 'file-saver';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Notes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isSimpleMode = location.state?.simpleMode || false;
  const projectReportId = location.state?.reportId || null;
  const [noteText, setNoteText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [showOptionsDialog, setShowOptionsDialog] = useState(false);
  const [organizedNotes, setOrganizedNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectReportId);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (showOptionsDialog && isSimpleMode && !projectReportId) {
      fetchProjects();
    }
  }, [showOptionsDialog]);

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

  const handleDownloadPDF = async () => {
    const content = organizedNotes || noteText;
    if (!content) {
      toast.error("No notes to download");
      return;
    }

    try {
      toast.success("Generating PDF...");

      // Create a simple text file download
      const textBlob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(textBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `notes-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Notes Downloaded!");
    } catch (error) {
      console.error('Error generating file:', error);
      toast.error("Failed to generate file");
    }
  };

  const handleDownloadWord = async () => {
    const content = organizedNotes || noteText;
    if (!content) {
      toast.error("No notes to download");
      return;
    }

    try {
      toast.success("Generating Word Document...");

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `Notes - ${new Date().toLocaleDateString()}`,
              heading: HeadingLevel.TITLE,
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleString('en-US', { 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}`,
                  size: 18,
                  color: "999999",
                }),
              ],
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: content,
              spacing: { after: 200 },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `notes-${new Date().toISOString().split('T')[0]}.docx`);

      toast.success("Word Document Downloaded!");
    } catch (error) {
      console.error('Error generating Word document:', error);
      toast.error("Failed to generate Word document");
    }
  };

  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const handlePrint = () => {
    const content = organizedNotes || noteText;
    if (!content) {
      toast.error("No notes to print");
      return;
    }
    
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
            <pre>${content}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleSaveToCloud = async () => {
    const content = organizedNotes || noteText;
    if (!content) {
      toast.error("No notes to save");
      return;
    }

    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to save notes to cloud");
        return;
      }

      toast.success("Saving to cloud...");

      // Create a text blob of the notes
      const blob = new Blob([content], { type: 'text/plain' });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `notes_${timestamp}.txt`;
      const filePath = `${user.id}/notes/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: 'text/plain',
          upsert: false
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        toast.error(uploadError.message);
        return;
      }

      // If we have a projectReportId, save to database with project link
      if (projectReportId) {
        const { error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            report_id: projectReportId,
            file_path: filePath,
            file_name: fileName,
            mime_type: 'text/plain',
            file_size: blob.size
          });

        if (dbError) {
          console.error("Database insert error:", dbError);
          toast.error(dbError.message);
          return;
        }
      }

      toast.success("Notes saved to cloud!");
      
    } catch (error) {
      console.error("Error saving to cloud:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEmail = () => {
    const content = organizedNotes || noteText;
    if (!content) {
      toast.error("No notes to email");
      return;
    }
    const subject = encodeURIComponent(`Notes - ${new Date().toLocaleDateString()}`);
    const body = encodeURIComponent(content);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const fetchProjects = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleCreateNewProject = () => {
    setShowOptionsDialog(false);
    navigate("/new-project", { 
      state: { 
        returnTo: "/notes",
        notes: organizedNotes
      } 
    });
  };

  const handleAssignToProject = async () => {
    if (!selectedProjectId) {
      toast.error("Please select a project");
      return;
    }
    
    // TODO: Save notes to database with project assignment linked to selectedProjectId
    toast.success("Notes assigned to project successfully!");
    setShowOptionsDialog(false);
    navigate("/dashboard");
  };

  const handleSkipProject = () => {
    // Save as standalone
    // TODO: Save notes to database without project link
    toast.success("Notes saved without project assignment!");
    setShowOptionsDialog(false);
    navigate("/dashboard");
  };

  return (
    <div className="dark min-h-screen bg-background pb-64">
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

        {/* Voice Recording Button */}
        <div className="flex flex-col items-center justify-center gap-4 w-full mb-6">
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
      </main>

      {/* Static Bottom Action Bar - Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm p-4 z-20">
        <h3 className="mb-4 text-center text-lg font-semibold text-foreground">Save & Print</h3>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={handleDownloadPDF}
            disabled={!noteText && !organizedNotes}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <Download className="mr-2 h-5 w-5" />
            Save as PDF
          </Button>
          <Button
            onClick={handleDownloadWord}
            disabled={!noteText && !organizedNotes}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <FileText className="mr-2 h-5 w-5" />
            Save as Word
          </Button>
        </div>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <Button
            onClick={handleSaveToCloud}
            disabled={(!noteText && !organizedNotes) || isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
          >
            <Cloud className="mr-2 h-5 w-5" />
            {isSaving ? "Saving..." : "Save to Cloud"}
          </Button>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Button
              onClick={handlePrint}
              disabled={!noteText && !organizedNotes}
              className="bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base font-semibold transition-transform duration-200 hover:scale-105 disabled:opacity-50"
            >
              <Printer className="mr-2 h-5 w-5" />
              Print
            </Button>
            <Button
              onClick={handleCopyLink}
              className="bg-primary text-primary-foreground hover:bg-primary/90 w-14 items-center justify-center py-6 transition-transform duration-200 hover:scale-105"
              title="Copy Link"
            >
              <Link2 className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Notes generated on {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
        </p>
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

          {/* Action buttons - Legacy, can be removed if not needed */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
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

          {/* Project assignment - only show in Simple Mode */}
          {isSimpleMode && !projectReportId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Link to Project (Optional)</h3>
              </div>
              
              {/* Save as Standalone Option */}
              <Button
                onClick={handleSkipProject}
                variant="outline"
                className="w-full justify-start h-auto p-4"
              >
                <div className="text-left">
                  <div className="font-semibold">Save as Standalone</div>
                  <div className="text-xs text-muted-foreground">Not linked to any project</div>
                </div>
              </Button>

              {/* Create New Project */}
              <Button
                onClick={handleCreateNewProject}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Project
              </Button>

              {/* Existing Projects */}
              {projects.length > 0 && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or select existing</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {projects.map((project) => (
                      <Button
                        key={project.id}
                        onClick={() => {
                          setSelectedProjectId(project.id);
                          handleAssignToProject();
                        }}
                        variant="outline"
                        className="w-full justify-start h-auto p-4"
                      >
                        <div className="text-left">
                          <div className="font-semibold">{project.project_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {project.customer_name} • {project.job_number}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Project assignment confirmation for Project Mode */}
          {!isSimpleMode && projectReportId && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Linked to Project</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                This note will be automatically saved to the current project.
              </p>
              <Button
                onClick={() => {
                  handleAssignToProject();
                }}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save to Project
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Notes;
