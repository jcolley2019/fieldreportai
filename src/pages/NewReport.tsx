import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// Comprehensive validation schema
const reportSchema = z.object({
  projectName: z.string()
    .trim()
    .min(1, "Project name is required")
    .max(100, "Project name must be less than 100 characters"),
  customerName: z.string()
    .trim()
    .min(1, "Customer name is required")
    .max(100, "Customer name must be less than 100 characters"),
  jobNumber: z.string()
    .trim()
    .min(1, "Job number is required")
    .max(50, "Job number must be less than 50 characters")
    .regex(/^[A-Za-z0-9-_]+$/, "Job number can only contain letters, numbers, hyphens, and underscores"),
  jobDescription: z.string()
    .trim()
    .min(1, "Job description is required")
    .max(500, "Job description must be less than 500 characters"),
});

type ReportFormData = z.infer<typeof reportSchema>;

const NewReport = () => {
  const navigate = useNavigate();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      projectName: "",
      customerName: "",
      jobNumber: "",
      jobDescription: "",
    },
  });

  const { setValue } = form;
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

                // Fill in the form fields with validation
                if (extractedData.projectName) setValue("projectName", extractedData.projectName);
                if (extractedData.customerName) setValue("customerName", extractedData.customerName);
                if (extractedData.jobNumber) setValue("jobNumber", extractedData.jobNumber);
                if (extractedData.jobDescription) setValue("jobDescription", extractedData.jobDescription);

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

  const onSubmit = async (data: ReportFormData) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create a report");
        navigate("/auth");
        return;
      }

      const { error } = await supabase
        .from('reports')
        .insert([{
          user_id: user.id,
          project_name: data.projectName,
          customer_name: data.customerName,
          job_number: data.jobNumber,
          job_description: data.jobDescription
        }]);

      if (error) throw error;
      
      toast.success("Report saved successfully");
      navigate("/capture-screen");
    } catch (error) {
      console.error("Error saving report:", error);
      toast.error("Failed to save report");
    }
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
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Project Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter project name"
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Maximum 100 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Customer Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter customer name"
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Maximum 100 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Job Number *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter job number (e.g., JOB-2025-001)"
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    Letters, numbers, hyphens, and underscores only (max 50 chars)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jobDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground">Job Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter job description"
                      className="min-h-[120px] bg-background text-foreground resize-none"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    {field.value.length}/500 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Voice Input Instructions and Button */}
            <div className="rounded-xl border-2 border-primary/30 bg-primary/10 p-6">
              <h3 className="text-lg font-semibold text-foreground mb-3 text-center">Quick Voice Input</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center leading-relaxed">
                Tap the microphone to dictate your Project Name, Customer Name, Job Number, and Job Description. 
                This information will be included in your Field Reports and Checklists.
              </p>
              
              <div className="flex flex-col items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={handleGlobalVoiceInput}
                  disabled={isProcessing}
                  className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                    isRecording 
                      ? 'bg-destructive text-white animate-pulse shadow-lg shadow-destructive/50' 
                      : isProcessing
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/30'
                  }`}
                >
                  {isRecording ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </button>
                {isRecording && (
                  <p className="text-base text-destructive font-semibold animate-pulse">Recording... tap to stop</p>
                )}
                {isProcessing && (
                  <p className="text-base text-primary font-semibold">Processing audio...</p>
                )}
                {!isRecording && !isProcessing && (
                  <p className="text-base text-foreground font-semibold">Tap to fill form with voice</p>
                )}
              </div>
            </div>

            {/* Continue Button */}
            <div className="mt-8">
              <Button
                type="submit"
                className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
};

export default NewReport;

