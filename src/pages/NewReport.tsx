import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { VoiceInputField } from "@/components/VoiceInputField";
import { VoiceTextareaField } from "@/components/VoiceTextareaField";
import { supabase } from "@/integrations/supabase/client";

const NewReport = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleGlobalVoiceInput = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          setIsProcessing(true);
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result?.toString().split(',')[1];
            
            if (base64Audio) {
              try {
                // Transcribe audio
                const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
                  body: { audio: base64Audio }
                });

                if (transcribeError) throw transcribeError;

                toast.success("Transcription complete, extracting fields...");

                // Extract fields using AI
                const { data: extractedData, error: extractError } = await supabase.functions.invoke('extract-report-fields', {
                  body: { transcription: transcribeData.text }
                });

                if (extractError) throw extractError;

                // Fill in the form fields
                if (extractedData.projectName) setProjectName(extractedData.projectName);
                if (extractedData.customerName) setCustomerName(extractedData.customerName);
                if (extractedData.jobNumber) setJobNumber(extractedData.jobNumber);
                if (extractedData.jobDescription) setJobDescription(extractedData.jobDescription);

                toast.success("Form fields filled successfully!");
              } catch (error) {
                console.error('Error processing audio:', error);
                toast.error("Failed to process audio");
              }
            }
            
            setIsProcessing(false);
          };

          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        toast.success("Recording started... Speak naturally about your project");
      } catch (error) {
        console.error('Error accessing microphone:', error);
        toast.error("Failed to access microphone");
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        toast.info("Processing your recording...");
      }
    }
  };

  const handleContinue = () => {
    if (!projectName.trim() || !customerName.trim() || !jobNumber.trim() || !jobDescription.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success("Report details saved");
    // In production, you would save this data and navigate to the next step
    // For now, we'll just show success
  };

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-4 bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">New Report</h1>
      </header>

      <main className="flex min-h-screen flex-col px-4 pb-8 pt-4">
        {/* Global Voice Input Button */}
        <div className="mb-6 flex justify-center">
          <Button
            onClick={handleGlobalVoiceInput}
            disabled={isProcessing}
            variant={isRecording ? "destructive" : "default"}
            size="lg"
            className={`gap-2 ${isRecording ? "animate-pulse" : ""}`}
          >
            {isRecording ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop Recording
              </>
            ) : isProcessing ? (
              <>
                Processing...
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Fill Form with Voice
              </>
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <VoiceInputField
            label="Project Name"
            value={projectName}
            onChange={setProjectName}
            placeholder="Enter project name"
            required
          />

          <VoiceInputField
            label="Customer Name"
            value={customerName}
            onChange={setCustomerName}
            placeholder="Enter customer name"
            required
          />

          <VoiceInputField
            label="Job Number"
            value={jobNumber}
            onChange={setJobNumber}
            placeholder="Enter job number"
            required
          />

          <VoiceTextareaField
            label="Job Description"
            value={jobDescription}
            onChange={setJobDescription}
            placeholder="Enter job description"
            required
            maxLength={500}
          />
        </div>

        {/* Continue Button */}
        <div className="mt-8">
          <Button
            onClick={handleContinue}
            className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Continue
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NewReport;

