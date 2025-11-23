import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EnterpriseSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EnterpriseSalesDialog = ({ open, onOpenChange }: EnterpriseSalesDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    companySize: "",
    licenseQuantity: "",
    integrationsNeeded: [] as string[],
    customFormatting: "",
    customFeatures: "",
  });

  const integrationOptions = [
    "Salesforce",
    "Q360",
    "DTools",
    "Other CRM",
    "Custom Integration",
  ];

  const handleIntegrationToggle = (integration: string) => {
    setFormData(prev => ({
      ...prev,
      integrationsNeeded: prev.integrationsNeeded.includes(integration)
        ? prev.integrationsNeeded.filter(i => i !== integration)
        : [...prev.integrationsNeeded, integration]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.email || !formData.company) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // Submit inquiry and capture lead in one call
      const { error } = await supabase.functions.invoke("send-enterprise-sales-inquiry", {
        body: {
          name: formData.name,
          email: formData.email,
          company: formData.company,
          companySize: formData.companySize,
          licenseQuantity: formData.licenseQuantity,
          integrationsNeeded: formData.integrationsNeeded.join(", "),
          customFormatting: formData.customFormatting,
          customFeatures: formData.customFeatures,
        },
      });

      if (error) throw error;

      toast.success("Your inquiry has been sent successfully!");
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        email: "",
        company: "",
        companySize: "",
        licenseQuantity: "",
        integrationsNeeded: [],
        customFormatting: "",
        customFeatures: "",
      });
    } catch (error: any) {
      console.error("Error sending inquiry:", error);
      toast.error("Failed to send inquiry. Please try again or email us directly at jcolley2019@gmail.com");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">Enterprise Plan Inquiry</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Tell us about your needs and we'll get back to you with a custom quote
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@company.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company Name *</Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Your Company Inc."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companySize">Company Size</Label>
              <Select value={formData.companySize} onValueChange={(value) => setFormData({ ...formData, companySize: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select company size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="500+">500+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="licenseQuantity">Number of Licenses Needed</Label>
              <Input
                id="licenseQuantity"
                type="number"
                value={formData.licenseQuantity}
                onChange={(e) => setFormData({ ...formData, licenseQuantity: e.target.value })}
                placeholder="e.g., 25"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Integrations Needed</Label>
            <div className="grid grid-cols-2 gap-2">
              {integrationOptions.map((integration) => (
                <div key={integration} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`integration-${integration}`}
                    checked={formData.integrationsNeeded.includes(integration)}
                    onChange={() => handleIntegrationToggle(integration)}
                    className="rounded border-border"
                  />
                  <label
                    htmlFor={`integration-${integration}`}
                    className="text-sm text-foreground cursor-pointer"
                  >
                    {integration}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customFormatting">Custom Formatting Requirements</Label>
            <Textarea
              id="customFormatting"
              value={formData.customFormatting}
              onChange={(e) => setFormData({ ...formData, customFormatting: e.target.value })}
              placeholder="Describe any custom branding, templates, or formatting needs..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customFeatures">Custom Feature Requests</Label>
            <Textarea
              id="customFeatures"
              value={formData.customFeatures}
              onChange={(e) => setFormData({ ...formData, customFeatures: e.target.value })}
              placeholder="Describe any specific features or capabilities you need..."
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Submit Inquiry"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
