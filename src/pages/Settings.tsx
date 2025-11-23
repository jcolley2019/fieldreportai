import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  User,
  ChevronRight,
  CloudOff,
  Mic,
  Bell,
  Moon,
  HelpCircle,
  MessageSquare,
  Info,
  Shield,
  Camera,
  Building2,
  Save,
  Smartphone,
  Copy,
  Check,
  Palette,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  companyName: z.string().optional(),
  email: z.string().email(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

const Settings = () => {
  const navigate = useNavigate();
  const [offlineMode, setOfflineMode] = useState(true);
  const [autoRecord, setAutoRecord] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [mfaSecret, setMfaSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState<string>("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [emailTemplateColor, setEmailTemplateColor] = useState("#007bff");
  const [emailTemplateMessage, setEmailTemplateMessage] = useState("");

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      form.setValue("email", user.email || "");

      // Check MFA status
      const factors = user.factors || [];
      setMfaEnabled(factors.some(factor => factor.status === 'verified'));

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        form.setValue("firstName", profile.first_name || "");
        form.setValue("lastName", profile.last_name || "");
        form.setValue("companyName", profile.company_name || "");
        setAvatarUrl(profile.avatar_url);
        setCompanyLogoUrl(profile.company_logo_url);
        setCurrentPlan(profile.current_plan);
        setEmailTemplateColor(profile.email_template_color || "#007bff");
        setEmailTemplateMessage(profile.email_template_message || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Failed to load profile");
    }
  };

  const uploadImage = async (
    file: File,
    bucket: string,
    onSuccess: (url: string) => void
  ) => {
    if (!userId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      
      onSuccess(data.publicUrl);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadImage(file, "avatars", async (url) => {
      setAvatarUrl(url);
      await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
    });
  };

  const handleCompanyLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadImage(file, "company-logos", async (url) => {
      setCompanyLogoUrl(url);
      await supabase
        .from("profiles")
        .update({ company_logo_url: url })
        .eq("id", userId);
    });
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: values.firstName,
          last_name: values.lastName,
          company_name: values.companyName,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    }
  };

  const handleEnable2FA = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
      });

      if (error) throw error;

      if (data) {
        setQrCode(data.totp.qr_code);
        setMfaSecret(data.totp.secret);
        setShowMfaDialog(true);
      }
    } catch (error: any) {
      console.error("Error enabling 2FA:", error);
      toast.error(error.message || "Failed to enable 2FA");
    }
  };

  const handleVerify2FA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error("No TOTP factor found");

      const { data, error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verifyCode,
      });

      if (error) throw error;

      setMfaEnabled(true);
      setShowMfaDialog(false);
      setVerifyCode("");
      toast.success("2FA enabled successfully");
      await loadProfile();
    } catch (error: any) {
      console.error("Error verifying 2FA:", error);
      toast.error(error.message || "Invalid code. Please try again.");
    }
  };

  const handleDisable2FA = async () => {
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data?.totp?.[0];
      if (!totpFactor) throw new Error("No TOTP factor found");

      const { error } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (error) throw error;

      setMfaEnabled(false);
      toast.success("2FA disabled successfully");
      await loadProfile();
    } catch (error: any) {
      console.error("Error disabling 2FA:", error);
      toast.error(error.message || "Failed to disable 2FA");
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(mfaSecret);
    setCopiedSecret(true);
    toast.success("Secret copied to clipboard");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const onPasswordSubmit = async (values: PasswordFormValues) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: values.newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      passwordForm.reset();
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const handleManageCloud = () => {
    toast.success("Opening cloud connections...");
  };

  const handleSaveEmailTemplate = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          email_template_color: emailTemplateColor,
          email_template_message: emailTemplateMessage,
        })
        .eq("id", userId);

      if (error) throw error;

      toast.success("Email template saved successfully");
    } catch (error) {
      console.error("Error saving email template:", error);
      toast.error("Failed to save email template");
    }
  };

  const isPremiumOrEnterprise = currentPlan === 'premium' || currentPlan === 'enterprise';

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background p-4 pb-2">
        <BackButton />
        <h1 className="flex-1 text-center text-lg font-bold text-foreground">
          Settings
        </h1>
        <div className="w-[80px]"></div>
      </header>

      <main className="flex-grow pb-8">
        {/* Profile Form Section */}
        <div className="bg-background px-4 py-6">
          <h2 className="mb-6 text-xl font-bold text-foreground">Profile Settings</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Profile Picture */}
              <div className="space-y-2">
                <Label className="text-foreground">Profile Picture</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="bg-primary/20">
                      <User className="h-10 w-10 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      disabled={uploading}
                      className="border-primary text-foreground hover:bg-primary/10"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload Photo"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* First Name */}
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">First Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your first name"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Last Name */}
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Last Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your last name"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email (Read-only) */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        disabled
                        className="bg-muted text-muted-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Name */}
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Company Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your company name"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Logo */}
              <div className="space-y-2">
                <Label className="text-foreground">Company Logo</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 rounded-lg">
                    <AvatarImage src={companyLogoUrl || undefined} className="object-contain" />
                    <AvatarFallback className="rounded-lg bg-primary/20">
                      <Building2 className="h-10 w-10 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleCompanyLogoUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById("logo-upload")?.click()}
                      disabled={uploading}
                      className="border-primary text-foreground hover:bg-primary/10"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload Logo"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </Button>
            </form>
          </Form>
        </div>

        {/* Password Change Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <h2 className="mb-6 text-xl font-bold text-foreground">Change Password</h2>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
              {/* Current Password */}
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Current Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter current password"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* New Password */}
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">New Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter new password"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Confirm Password */}
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirm new password"
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Update Password Button */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Shield className="mr-2 h-4 w-4" />
                Update Password
              </Button>
            </form>
          </Form>
        </div>

        {/* Email Branding Section - Premium/Enterprise Only */}
        {isPremiumOrEnterprise && (
          <div className="bg-background px-4 py-6 border-t border-border">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Email Template Branding
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                Customize the appearance of emails sent from your account with your company branding.
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Brand Color */}
              <div className="space-y-2">
                <Label className="text-foreground">Brand Color</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={emailTemplateColor}
                    onChange={(e) => setEmailTemplateColor(e.target.value)}
                    className="h-10 w-20 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={emailTemplateColor}
                    onChange={(e) => setEmailTemplateColor(e.target.value)}
                    placeholder="#007bff"
                    className="bg-background text-foreground flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This color will be used for buttons and accents in your emails
                </p>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <Label className="text-foreground">Custom Footer Message</Label>
                <Input
                  value={emailTemplateMessage}
                  onChange={(e) => setEmailTemplateMessage(e.target.value)}
                  placeholder="Thank you for using our services"
                  className="bg-background text-foreground"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  Optional message to include at the bottom of your emails ({emailTemplateMessage.length}/200 characters)
                </p>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-foreground">Email Preview</Label>
                <div className="border border-border rounded-lg p-4 bg-muted/20">
                  <div className="bg-white p-6 rounded shadow-sm max-w-md mx-auto">
                    <div className="flex items-center gap-3 mb-4">
                      {companyLogoUrl && (
                        <img src={companyLogoUrl} alt="Company Logo" className="h-10 w-auto object-contain" />
                      )}
                      <div className="text-sm text-gray-600">
                        {form.watch("companyName") || "Your Company"}
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Field Report Export</h3>
                    <p className="text-sm text-gray-600 mb-4">Your export is ready</p>
                    <button
                      style={{ backgroundColor: emailTemplateColor }}
                      className="text-white px-6 py-2 rounded font-medium text-sm"
                    >
                      Download Export
                    </button>
                    {emailTemplateMessage && (
                      <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-200">
                        {emailTemplateMessage}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveEmailTemplate}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                Save Email Template
              </Button>
            </div>
          </div>
        )}

        {/* Two-Factor Authentication Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <h2 className="mb-4 text-xl font-bold text-foreground">Two-Factor Authentication</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            Add an extra layer of security to your account by requiring a verification code from your authenticator app.
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Smartphone className="h-5 w-5 text-foreground" />
              <div>
                <p className="text-base font-medium text-foreground">
                  {mfaEnabled ? "2FA Enabled" : "2FA Disabled"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled ? "Your account is protected" : "Enhance your account security"}
                </p>
              </div>
            </div>
            <Button
              onClick={mfaEnabled ? handleDisable2FA : handleEnable2FA}
              variant={mfaEnabled ? "destructive" : "default"}
              className={mfaEnabled ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
            >
              {mfaEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>

        {/* 2FA Setup Dialog */}
        <Dialog open={showMfaDialog} onOpenChange={setShowMfaDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle className="text-foreground">Set Up Two-Factor Authentication</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Scan the QR code with your authenticator app or enter the secret key manually.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* QR Code */}
              {qrCode && (
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>
              )}

              {/* Secret Key */}
              {mfaSecret && (
                <div className="space-y-2">
                  <Label className="text-foreground">Secret Key</Label>
                  <div className="flex gap-2">
                    <Input
                      value={mfaSecret}
                      readOnly
                      className="bg-muted text-foreground font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCopySecret}
                      className="border-primary text-foreground hover:bg-primary/10"
                    >
                      {copiedSecret ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Use this key if you can't scan the QR code
                  </p>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="space-y-2">
                <Label className="text-foreground">Verification Code</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="bg-background text-foreground"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerify2FA}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={verifyCode.length !== 6}
              >
                Verify and Enable 2FA
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cloud Connections Section */}
        <div className="bg-background px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-foreground">
                Manage Cloud Connections
              </h2>
              <p className="text-sm text-muted-foreground">
                Link or unlink your cloud storage accounts to sync your data
                automatically.
              </p>
            </div>
            <Button
              onClick={handleManageCloud}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Manage
            </Button>
          </div>
        </div>

        {/* DATA & CAPTURE Section */}
        <div className="px-4 pt-4">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Data & Capture
          </h3>

          {/* Offline Mode Toggle */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <CloudOff className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Offline Mode
              </span>
            </div>
            <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
          </div>

          {/* Auto Record Toggle */}
          <div className="flex flex-col gap-2 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Mic className="h-5 w-5 text-foreground" />
                <span className="text-base font-medium text-foreground">
                  Auto Record
                </span>
              </div>
              <Switch checked={autoRecord} onCheckedChange={setAutoRecord} />
            </div>
            <p className="pl-9 text-sm text-muted-foreground">
              Automatically record audio when taking photos or videos.
            </p>
          </div>
        </div>

        {/* GENERAL Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            General
          </h3>

          {/* Notifications */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Notifications
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Appearance */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Moon className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Appearance
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* SUPPORT & FEEDBACK Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Support & Feedback
          </h3>

          {/* Help Center */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <HelpCircle className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Help Center
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Send Feedback */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <MessageSquare className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Send Feedback
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* ABOUT Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            About
          </h3>

          {/* About Fieldwork */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Info className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                About Fieldwork
              </span>
            </div>
            <span className="text-sm text-muted-foreground">v2.1.0</span>
          </div>

          {/* Privacy Policy */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                Privacy Policy
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Log Out Button */}
        <div className="px-4 pt-8">
          <button
            onClick={handleLogout}
            className="w-full py-3 text-center text-base font-medium text-destructive hover:underline"
          >
            Log Out
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
