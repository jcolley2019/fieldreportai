import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface EmailCaptureFormProps {
  source: "pricing_page" | "landing_page" | "newsletter";
  placeholder?: string;
  buttonText?: string;
  className?: string;
}

export const EmailCaptureForm = ({ 
  source, 
  placeholder = "Enter your email",
  buttonText = "Get Started",
  className = ""
}: EmailCaptureFormProps) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.functions.invoke("capture-lead", {
        body: {
          email,
          source,
          sequence: source === "newsletter" ? "newsletter" : "welcome",
        },
      });

      if (error) throw error;

      // Send to Zapier webhook for Google Sheets
      try {
        const zapierWebhookUrl = "https://hooks.zapier.com/hooks/catch/25475428/uzgnzrz/";
        await fetch(zapierWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          mode: "no-cors",
          body: JSON.stringify({
            email,
            source,
            type: "lead_capture",
            timestamp: new Date().toISOString(),
            sequence: source === "newsletter" ? "newsletter" : "welcome",
          }),
        });
      } catch (zapierError) {
        console.error("Zapier webhook failed:", zapierError);
        // Don't throw - we still want to show success if lead was captured
      }

      toast.success("Thanks! Check your email for next steps.");
      setEmail("");
    } catch (error: any) {
      console.error("Error capturing lead:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className}`}>
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        className="flex-1"
        disabled={loading}
      />
      <Button type="submit" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Sending...
          </>
        ) : (
          buttonText
        )}
      </Button>
    </form>
  );
};
