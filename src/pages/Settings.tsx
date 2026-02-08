import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { GlassNavbar, NavbarLeft, NavbarCenter, NavbarRight, NavbarTitle } from "@/components/GlassNavbar";
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
  Languages,
  BarChart3,
  CreditCard,
  Crown,
  Sparkles,
  Zap,
  Timer,
  MapPin,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const { t, i18n } = useTranslation();
  const [offlineMode, setOfflineMode] = useState(true);
  
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [showMfaDialog, setShowMfaDialog] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [mfaSecret, setMfaSecret] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState<string>("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailTemplateColor, setEmailTemplateColor] = useState("#007bff");
  const [emailTemplateMessage, setEmailTemplateMessage] = useState("");
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [idleTimeoutMinutes, setIdleTimeoutMinutes] = useState<number | null>(null);
  const [gpsStampingEnabled, setGpsStampingEnabled] = useState(false);

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
        .select("*, idle_timeout_minutes, gps_stamping_enabled")
        .eq("id", user.id)
        .single();

      if (profile) {
        form.setValue("firstName", profile.first_name || "");
        form.setValue("lastName", profile.last_name || "");
        form.setValue("companyName", profile.company_name || "");
        setAvatarUrl(profile.avatar_url);
        setCompanyLogoUrl(profile.company_logo_url);
        setLetterheadUrl(profile.letterhead_url);
        setCurrentPlan(profile.current_plan);
        setEmailTemplateColor(profile.email_template_color || "#007bff");
        setEmailTemplateMessage(profile.email_template_message || "");
        setIdleTimeoutMinutes(profile.idle_timeout_minutes);
        setGpsStampingEnabled(profile.gps_stamping_enabled || false);
        
        // Set language from profile
        if (profile.preferred_language) {
          setSelectedLanguage(profile.preferred_language);
          i18n.changeLanguage(profile.preferred_language);
        }
      }

      // Check admin role
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      setIsAdmin(!!adminRole);
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

  const handleLetterheadUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if user has Premium or Enterprise plan
    if (currentPlan !== 'premium' && currentPlan !== 'enterprise') {
      toast.error("Letterhead upload is only available for Premium and Enterprise plans");
      return;
    }

    await uploadImage(file, "letterheads", async (url) => {
      setLetterheadUrl(url);
      await supabase
        .from("profiles")
        .update({ letterhead_url: url })
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

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        if (error.message?.includes('No Stripe customer found')) {
          toast.error("No active subscription found. Please subscribe to a plan first.");
          navigate("/pricing");
          return;
        }
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast.error("Failed to open subscription management. Please try again.");
    } finally {
      setIsLoadingPortal(false);
    }
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

  const handleLanguageChange = async (language: string) => {
    if (!userId) return;

    try {
      setSelectedLanguage(language);
      i18n.changeLanguage(language);

      const { error } = await supabase
        .from("profiles")
        .update({ preferred_language: language })
        .eq("id", userId);

      if (error) throw error;

      toast.success(language === 'en' ? 'Language updated successfully' : 'Idioma actualizado exitosamente');
    } catch (error) {
      console.error("Error updating language:", error);
      toast.error(language === 'en' ? 'Failed to update language' : 'Error al actualizar el idioma');
    }
  };

  const handleIdleTimeoutChange = async (value: string) => {
    if (!userId) return;

    const minutes = value === "disabled" ? 0 : value === "default" ? null : parseInt(value);
    
    try {
      setIdleTimeoutMinutes(minutes);

      const { error } = await supabase
        .from("profiles")
        .update({ idle_timeout_minutes: minutes })
        .eq("id", userId);

      if (error) throw error;

      const message = minutes === 0 
        ? "Auto-logout disabled" 
        : minutes === null 
          ? "Auto-logout set to 15 minutes (default)"
          : `Auto-logout set to ${minutes} minutes`;
      toast.success(message);
    } catch (error) {
      console.error("Error updating idle timeout:", error);
      toast.error("Failed to update idle timeout setting");
    }
  };

  const getIdleTimeoutValue = () => {
    if (idleTimeoutMinutes === 0) return "disabled";
    if (idleTimeoutMinutes === null) return "default";
    return idleTimeoutMinutes.toString();
  };

  const isPremiumOrEnterprise = currentPlan === 'premium' || currentPlan === 'enterprise';

  return (
    <div className="dark min-h-screen bg-background">
      {/* Glass Navbar */}
      <GlassNavbar fixed={false}>
        <NavbarLeft>
          <BackButton />
        </NavbarLeft>
        <NavbarCenter>
          <NavbarTitle>{t('settings.title')}</NavbarTitle>
        </NavbarCenter>
        <NavbarRight>
          <div className="w-10" />
        </NavbarRight>
      </GlassNavbar>

      <main className="flex-grow pb-8 animate-fade-in">
        {/* Profile Form Section */}
        <div className="bg-background px-4 py-6">
          <h2 className="mb-6 text-xl font-bold text-foreground">{t('settings.profile')}</h2>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Profile Picture */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.profilePicture')}</Label>
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
                      {uploading ? t('common.uploading') : t('onboarding.uploadPhoto')}
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
                    <FormLabel className="text-foreground">{t('settings.firstName')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('settings.firstName')}
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
                    <FormLabel className="text-foreground">{t('settings.lastName')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('settings.lastName')}
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
                    <FormLabel className="text-foreground">{t('auth.emailAddress')}</FormLabel>
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
                    <FormLabel className="text-foreground">{t('settings.companyName')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('settings.companyName')}
                        className="bg-background text-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Logo */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.companyLogo')}</Label>
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
                      {uploading ? t('common.uploading') : t('onboarding.uploadLogo')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Letterhead Upload - Premium/Enterprise Only */}
              {(currentPlan === 'premium' || currentPlan === 'enterprise') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">{t('settings.companyLetterhead')}</Label>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                      {currentPlan === 'premium' ? t('settings.premiumFeature') : t('settings.enterpriseFeature')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {t('settings.letterheadDesc')}
                  </p>
                  <div className="flex items-center gap-4">
                    {letterheadUrl && (
                      <Avatar className="h-20 w-full max-w-[160px] rounded-lg">
                        <AvatarImage src={letterheadUrl} className="object-contain" />
                      </Avatar>
                    )}
                    <div className="flex-1">
                      <Input
                        id="letterhead-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleLetterheadUpload}
                        disabled={uploading}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("letterhead-upload")?.click()}
                        disabled={uploading}
                        className="border-primary text-foreground hover:bg-primary/10"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {uploading ? t('common.uploading') : letterheadUrl ? t('settings.changeLetterhead') : t('settings.uploadLetterhead')}
                      </Button>
                      {letterheadUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={async () => {
                            setLetterheadUrl(null);
                            await supabase
                              .from("profiles")
                              .update({ letterhead_url: null })
                              .eq("id", userId);
                            toast.success(t('settings.letterheadRemoved'));
                          }}
                          className="ml-2 text-destructive hover:text-destructive"
                        >
                          {t('settings.remove')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Save Button */}
              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="mr-2 h-4 w-4" />
                {t('settings.saveChanges')}
              </Button>
            </form>
          </Form>
        </div>

        {/* Password Change Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <h2 className="mb-6 text-xl font-bold text-foreground">{t('settings.changePassword')}</h2>
          
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
              {/* Current Password */}
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">{t('settings.currentPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('settings.currentPassword')}
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
                    <FormLabel className="text-foreground">{t('settings.newPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('settings.newPassword')}
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
                    <FormLabel className="text-foreground">{t('settings.confirmPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t('settings.confirmPassword')}
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
                {t('settings.updatePassword')}
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
                {t('settings.emailBranding')}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {t('settings.emailBrandingDesc')}
              </p>
            </div>
            
            <div className="space-y-6">
              {/* Brand Color */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.brandColor')}</Label>
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
                  {t('settings.brandColorDesc')}
                </p>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.customFooter')}</Label>
                <Input
                  value={emailTemplateMessage}
                  onChange={(e) => setEmailTemplateMessage(e.target.value)}
                  placeholder={t('settings.customFooterPlaceholder')}
                  className="bg-background text-foreground"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.customFooterDesc')} ({emailTemplateMessage.length}/200 {t('newProject.descriptionLength')})
                </p>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.emailPreview')}</Label>
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('settings.emailPreviewTitle')}</h3>
                    <p className="text-sm text-gray-600 mb-4">{t('settings.emailPreviewDesc')}</p>
                    <button
                      style={{ backgroundColor: emailTemplateColor }}
                      className="text-white px-6 py-2 rounded font-medium text-sm"
                    >
                      {t('settings.emailPreviewButton')}
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
                {t('settings.saveEmailTemplate')}
              </Button>
            </div>
          </div>
        )}

        {/* Two-Factor Authentication Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <h2 className="mb-4 text-xl font-bold text-foreground">{t('settings.twoFactorAuth')}</h2>
          <p className="mb-6 text-sm text-muted-foreground">
            {t('settings.twoFactorDesc')}
          </p>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Smartphone className="h-5 w-5 text-foreground" />
              <div>
                <p className="text-base font-medium text-foreground">
                  {mfaEnabled ? t('settings.twoFactorEnabled') : t('settings.twoFactorDisabled')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled ? t('settings.accountProtected') : t('settings.enhanceSecurity')}
                </p>
              </div>
            </div>
            <Button
              onClick={mfaEnabled ? handleDisable2FA : handleEnable2FA}
              variant={mfaEnabled ? "destructive" : "default"}
              className={mfaEnabled ? "" : "bg-primary text-primary-foreground hover:bg-primary/90"}
            >
              {mfaEnabled ? t('settings.disable2FA') : t('settings.enable2FA')}
            </Button>
          </div>
        </div>

        {/* 2FA Setup Dialog */}
        <Dialog open={showMfaDialog} onOpenChange={setShowMfaDialog}>
          <DialogContent className="bg-background">
            <DialogHeader>
              <DialogTitle className="text-foreground">{t('settings.setup2FA')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t('settings.setup2FADesc')}
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
                  <Label className="text-foreground">{t('settings.secretKey')}</Label>
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
                    {t('settings.secretKeyDesc')}
                  </p>
                </div>
              )}

              {/* Verification Code Input */}
              <div className="space-y-2">
                <Label className="text-foreground">{t('settings.verificationCode')}</Label>
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('settings.verificationCodePlaceholder')}
                  className="bg-background text-foreground"
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings.verificationCodeDesc')}
                </p>
              </div>

              {/* Verify Button */}
              <Button
                onClick={handleVerify2FA}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={verifyCode.length !== 6}
              >
                {t('settings.verifyEnable2FA')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Session Timeout Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Session Timeout
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Automatically log out after a period of inactivity for security.
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-base font-medium text-foreground">
                  Auto-logout Timer
                </p>
                <p className="text-sm text-muted-foreground">
                  {idleTimeoutMinutes === 0 
                    ? "Disabled - you will stay logged in" 
                    : idleTimeoutMinutes === null 
                      ? "15 minutes of inactivity (default)"
                      : `${idleTimeoutMinutes} minutes of inactivity`}
                </p>
              </div>
            </div>
            <Select value={getIdleTimeoutValue()} onValueChange={handleIdleTimeoutChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select timeout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="default">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subscription Management Section */}
        <div className="bg-background px-4 py-6 border-t border-border">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-foreground" />
                <h2 className="text-lg font-bold text-foreground">
                  {t('settings.subscription') || 'Subscription'}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('settings.subscriptionDesc') || 'Manage your subscription, update payment method, or change plans.'}
              </p>
              {/* Current Plan Badge */}
              {currentPlan && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">Current plan:</span>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    currentPlan === 'premium' 
                      ? 'bg-amber-500/20 text-amber-400' 
                      : currentPlan === 'pro' 
                        ? 'bg-primary/20 text-primary'
                        : currentPlan === 'trial'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-muted text-muted-foreground'
                  }`}>
                    {currentPlan === 'premium' && <Crown className="h-3 w-3" />}
                    {currentPlan === 'pro' && <Sparkles className="h-3 w-3" />}
                    {currentPlan === 'trial' && <Zap className="h-3 w-3" />}
                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {(currentPlan === 'pro' || currentPlan === 'premium') && (
                <Button
                  onClick={handleManageSubscription}
                  disabled={isLoadingPortal}
                  className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isLoadingPortal ? "Loading..." : (t('settings.manageSubscription') || 'Manage Plan')}
                </Button>
              )}
              {(!currentPlan || currentPlan === 'trial' || currentPlan === 'basic') && (
                <Button
                  onClick={() => navigate("/pricing")}
                  className="shrink-0 bg-gradient-to-r from-primary to-primary/80"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  {t('dashboard.upgradeNow') || 'Upgrade Now'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Cloud Connections Section */}
        <div className="bg-background px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-bold text-foreground">
                {t('settings.cloudConnections')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('settings.cloudConnectionsDesc')}
              </p>
            </div>
            <Button
              onClick={handleManageCloud}
              className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {t('settings.manage')}
            </Button>
          </div>
        </div>

        {/* DATA & CAPTURE Section */}
        <div className="px-4 pt-4">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.dataCapture')}
          </h3>

          {/* Offline Mode Toggle */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <CloudOff className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.offlineMode')}
              </span>
            </div>
            <Switch checked={offlineMode} onCheckedChange={setOfflineMode} />
          </div>

          {/* GPS Stamping Toggle */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-4">
                <MapPin className="h-5 w-5 text-foreground" />
                <span className="text-base font-medium text-foreground">
                  {t('settings.gpsStamping')}
                </span>
              </div>
              <p className="text-xs text-muted-foreground ml-9">
                {t('settings.gpsStampingDesc')}
              </p>
            </div>
            <Switch 
              checked={gpsStampingEnabled} 
              onCheckedChange={async (checked) => {
                setGpsStampingEnabled(checked);
                if (userId) {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ gps_stamping_enabled: checked })
                    .eq("id", userId);
                  if (error) {
                    toast.error(t('settings.saveError'));
                    setGpsStampingEnabled(!checked); // Revert on error
                  } else {
                    toast.success(t('settings.gpsSaved'));
                  }
                }
              }}
            />
          </div>

        </div>

        {/* LANGUAGE Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.language')}
          </h3>

          {/* Language Selector */}
          <div className="flex flex-col gap-2 border-b border-border py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Languages className="h-5 w-5 text-foreground" />
                <span className="text-base font-medium text-foreground">
                  {t('settings.selectLanguage')}
                </span>
              </div>
            </div>
            <div className="flex gap-2 pl-9">
              <Button
                variant={selectedLanguage === 'en' ? 'default' : 'outline'}
                onClick={() => handleLanguageChange('en')}
                className="flex-1"
              >
                {t('settings.english')}
              </Button>
              <Button
                variant={selectedLanguage === 'es' ? 'default' : 'outline'}
                onClick={() => handleLanguageChange('es')}
                className="flex-1"
              >
                {t('settings.spanish')}
              </Button>
            </div>
          </div>
        </div>

        {/* GENERAL Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.general')}
          </h3>

          {/* Notifications */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.notifications')}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Appearance */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Moon className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.appearance')}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* SUPPORT & FEEDBACK Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.supportFeedback')}
          </h3>

          {/* Help Center */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <HelpCircle className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.helpCenter')}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Send Feedback */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <MessageSquare className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.sendFeedback')}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* ADMIN Section - Only visible to admins */}
        {isAdmin && (
          <div className="px-4 pt-6">
            <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </h3>

            {/* AI Metrics Dashboard */}
            <button 
              onClick={() => navigate('/admin/metrics')}
              className="flex w-full items-center justify-between border-b border-border py-4"
            >
              <div className="flex items-center gap-4">
                <BarChart3 className="h-5 w-5 text-foreground" />
                <div className="flex flex-col items-start">
                  <span className="text-base font-medium text-foreground">
                    AI Metrics Dashboard
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Monitor AI performance and fallback rates
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* ABOUT Section */}
        <div className="px-4 pt-6">
          <h3 className="pb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('settings.about')}
          </h3>

          {/* About Fieldwork */}
          <div className="flex items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Info className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.aboutFieldwork')}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">v2.1.0</span>
          </div>

          {/* Privacy Policy */}
          <button className="flex w-full items-center justify-between border-b border-border py-4">
            <div className="flex items-center gap-4">
              <Shield className="h-5 w-5 text-foreground" />
              <span className="text-base font-medium text-foreground">
                {t('settings.privacyPolicy')}
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
            {t('settings.logOut')}
          </button>
        </div>
      </main>
    </div>
  );
};

export default Settings;
