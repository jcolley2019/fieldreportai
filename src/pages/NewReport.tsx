import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { VoiceInputField } from "@/components/VoiceInputField";
import { VoiceTextareaField } from "@/components/VoiceTextareaField";

const NewReport = () => {
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const handleContinue = () => {
    if (!projectName.trim() || !customerName.trim() || !jobNumber.trim() || !jobDescription.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    toast.success("Report details saved");
    navigate("/field-update");
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

