import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { SettingsButton } from "@/components/SettingsButton";
import { Mic, MicOff, Building2, Hash, User, FileText } from "lucide-react";
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

const NewProject = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      <header className="sticky top-0 z-10 bg-background/80 px-4 py-1 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <BackButton />
          <h1 className="text-lg font-semibold text-foreground flex-1 text-center">{t('newProject.title')}</h1>
          <SettingsButton />
        </div>
      </header>

      <main className="flex min-h-screen flex-col px-4 pb-8 pt-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    {t('newProject.projectName')} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('newProject.projectNamePlaceholder')}
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    {t('newProject.maxCharacters')}
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
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary" />
                    {t('newProject.jobNumber')} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('newProject.jobNumberPlaceholder')}
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    {t('newProject.jobNumberFormat')}
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
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {t('newProject.customerName')} *
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('newProject.customerNamePlaceholder')}
                      className="bg-background text-foreground"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    {t('newProject.maxCharacters')}
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
                  <FormLabel className="text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    {t('newProject.jobDescription')} *
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('newProject.jobDescriptionPlaceholder')}
                      className="min-h-[120px] bg-background text-foreground resize-none"
                      maxLength={500}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-muted-foreground">
                    {field.value.length}/500 {t('newProject.descriptionLength')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Voice Input Instructions and Button */}
            <div className="rounded-xl border-2 border-primary bg-primary/20 p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-foreground mb-4 text-center">{t('newProject.voiceInputTitle')}</h3>
              <p className="text-lg text-foreground font-medium mb-6 text-center leading-relaxed">
                {t('newProject.voiceInputInstructions')}
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
                  <p className="text-lg text-destructive font-bold animate-pulse">{t('newProject.recordingStatus')}</p>
                )}
                {isProcessing && (
                  <p className="text-lg text-primary font-bold">{t('newProject.processingAudio')}</p>
                )}
                {!isRecording && !isProcessing && (
                  <p className="text-lg text-foreground font-bold">{t('newProject.tapToFill')}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-primary py-6 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t('common.continue')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  form.reset();
                  toast.success(t('common.formCleared'));
                }}
                className="w-full py-6 text-base border-2 border-primary font-bold hover:bg-primary/10"
              >
                {t('newProject.clearForm')}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
};

export default NewProject;
