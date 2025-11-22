import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
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

  return (
    <div className="dark min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-background p-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex h-12 w-12 shrink-0 items-center justify-center text-foreground"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-foreground">
          Settings
        </h1>
        <div className="h-12 w-12 shrink-0"></div>
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
