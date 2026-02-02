import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, User, Building2, X, Save } from "lucide-react";
import { ImageCropDialog } from "@/components/ImageCropDialog";


const Onboarding = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [tempAvatarUrl, setTempAvatarUrl] = useState<string>("");
  const [tempLogoUrl, setTempLogoUrl] = useState<string>("");
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [showLogoCrop, setShowLogoCrop] = useState(false);
  const [errors, setErrors] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    avatar: "",
    logo: "",
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, []);

  const checkAuthAndLoadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Load existing profile data
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, company_name, avatar_url, company_logo_url")
      .eq("id", user.id)
      .maybeSingle();

    if (profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (profile.company_name) setCompanyName(profile.company_name);
      if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
      if (profile.company_logo_url) setLogoPreview(profile.company_logo_url);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: "File size must be less than 5MB" }));
        toast({
          title: t('onboarding.errors.fileTooLarge'),
          description: t('onboarding.errors.avatarSize'),
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, avatar: "File must be an image" }));
        toast({
          title: t('onboarding.errors.invalidFileType'),
          description: t('onboarding.errors.uploadImageFile'),
          variant: "destructive",
        });
        return;
      }

      setErrors(prev => ({ ...prev, avatar: "" }));
      const url = URL.createObjectURL(file);
      setTempAvatarUrl(url);
      setShowAvatarCrop(true);
    }
  };

  const handleAvatarCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(croppedBlob));
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview("");
    setTempAvatarUrl("");
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, logo: "File size must be less than 5MB" }));
        toast({
          title: t('onboarding.errors.fileTooLarge'),
          description: t('onboarding.errors.logoSize'),
          variant: "destructive",
        });
        return;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, logo: "File must be an image" }));
        toast({
          title: t('onboarding.errors.invalidFileType'),
          description: t('onboarding.errors.uploadImageFile'),
          variant: "destructive",
        });
        return;
      }

      setErrors(prev => ({ ...prev, logo: "" }));
      const url = URL.createObjectURL(file);
      setTempLogoUrl(url);
      setShowLogoCrop(true);
    }
  };

  const handleLogoCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], "logo.jpg", { type: "image/jpeg" });
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(croppedBlob));
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setTempLogoUrl("");
  };

  const uploadFile = async (file: File, bucket: string, userId: string, setUploadingState: (val: boolean) => void) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    try {
      setUploadingState(true);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      throw new Error(error.message || `Failed to upload ${bucket === 'avatars' ? 'avatar' : 'logo'}`);
    } finally {
      setUploadingState(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const newErrors = {
      firstName: firstName.trim() ? "" : "First name is required",
      lastName: lastName.trim() ? "" : "Last name is required",
      companyName: companyName.trim() ? "" : "Company name is required",
      avatar: "",
      logo: "",
    };

    setErrors(newErrors);

    if (Object.values(newErrors).some(error => error)) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let avatarUrl = "";
      let logoUrl = "";

      // Upload avatar if selected
      if (avatarFile) {
        try {
          avatarUrl = await uploadFile(avatarFile, "avatars", user.id, setUploadingAvatar);
        } catch (error: any) {
          throw new Error(`Avatar upload failed: ${error.message}`);
        }
      }

      // Upload logo if selected
      if (logoFile) {
        try {
          logoUrl = await uploadFile(logoFile, "company-logos", user.id, setUploadingLogo);
        } catch (error: any) {
          throw new Error(`Logo upload failed: ${error.message}`);
        }
      }

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          company_name: companyName.trim(),
          avatar_url: avatarUrl || null,
          company_logo_url: logoUrl || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Navigate directly without toast for smoother flow
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      
      let errorMessage = "Failed to complete setup";
      
      if (error.message.includes("Avatar upload")) {
        errorMessage = error.message;
      } else if (error.message.includes("Logo upload")) {
        errorMessage = error.message;
      } else if (error.message.includes("policy")) {
        errorMessage = "Permission error. Please try logging out and back in.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: t('onboarding.errors.setupFailed'),
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndCompleteLater = async () => {
    setSavingProgress(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      let avatarUrl = avatarPreview;
      let logoUrl = logoPreview;

      // Upload avatar if a new file was selected (not an existing URL)
      if (avatarFile) {
        try {
          avatarUrl = await uploadFile(avatarFile, "avatars", user.id, setUploadingAvatar);
        } catch (error: any) {
          console.error("Avatar upload error:", error);
        }
      }

      // Upload logo if a new file was selected (not an existing URL)
      if (logoFile) {
        try {
          logoUrl = await uploadFile(logoFile, "company-logos", user.id, setUploadingLogo);
        } catch (error: any) {
          console.error("Logo upload error:", error);
        }
      }

      // Save partial progress
      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          company_name: companyName.trim() || null,
          avatar_url: avatarUrl || null,
          company_logo_url: logoUrl || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Set flag to prevent redirect loop back to onboarding
      localStorage.setItem('skipOnboarding', 'true');

      // Navigate directly without toast for smoother flow
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Save progress error:", error);
      toast({
        title: t('onboarding.errors.setupFailed'),
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    } finally {
      setSavingProgress(false);
    }
  };

  return (
    <div className="dark min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4">

      <Card className="w-full max-w-2xl bg-card border-border animate-fade-in">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl text-foreground">{t('onboarding.welcome')}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {t('onboarding.setupProfile')}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSaveAndCompleteLater();
              }}
              disabled={savingProgress}
              className="flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {savingProgress ? t('common.saving') : t('onboarding.completeLater')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">{t('onboarding.firstName')} *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (errors.firstName) setErrors(prev => ({ ...prev, firstName: "" }));
                  }}
                  required
                  placeholder="John"
                  className={errors.firstName ? "border-destructive" : ""}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive mt-1">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">{t('onboarding.lastName')} *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (errors.lastName) setErrors(prev => ({ ...prev, lastName: "" }));
                  }}
                  required
                  placeholder="Doe"
                  className={errors.lastName ? "border-destructive" : ""}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive mt-1">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyName">{t('onboarding.companyName')} *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (errors.companyName) setErrors(prev => ({ ...prev, companyName: "" }));
                }}
                required
                placeholder="Your Company Inc."
                className={errors.companyName ? "border-destructive" : ""}
              />
              {errors.companyName && (
                <p className="text-sm text-destructive mt-1">{errors.companyName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>{t('onboarding.profilePicture')}</Label>
                <div className="flex flex-col items-center gap-3">
                  {avatarPreview ? (
                    <div className="relative">
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-24 h-24 rounded-full object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                        aria-label="Remove avatar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                      <User className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <Label
                    htmlFor="avatar"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingAvatar ? t('common.uploading') : avatarPreview ? t('onboarding.changePhoto') : t('onboarding.uploadPhoto')}
                  </Label>
                  {errors.avatar && (
                    <p className="text-sm text-destructive">{errors.avatar}</p>
                  )}
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar || loading}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('onboarding.companyLogo')}</Label>
                <div className="flex flex-col items-center gap-3">
                  {logoPreview ? (
                    <div className="relative">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-24 h-24 rounded-lg object-cover border-2 border-border"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90 transition-colors"
                        aria-label="Remove logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center border-2 border-border">
                      <Building2 className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <Label
                    htmlFor="logo"
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    {uploadingLogo ? t('common.uploading') : logoPreview ? t('onboarding.changeLogo') : t('onboarding.uploadLogo')}
                  </Label>
                  {errors.logo && (
                    <p className="text-sm text-destructive">{errors.logo}</p>
                  )}
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={uploadingLogo || loading}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading || uploadingAvatar || uploadingLogo}>
              {loading ? t('common.settingUp') : uploadingAvatar ? t('common.uploadingAvatar') : uploadingLogo ? t('common.uploadingLogo') : t('onboarding.completeSetup')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ImageCropDialog
        open={showAvatarCrop}
        imageUrl={tempAvatarUrl}
        onClose={() => setShowAvatarCrop(false)}
        onCropComplete={handleAvatarCropComplete}
        aspectRatio={1}
        cropShape="round"
      />

      <ImageCropDialog
        open={showLogoCrop}
        imageUrl={tempLogoUrl}
        onClose={() => setShowLogoCrop(false)}
        onCropComplete={handleLogoCropComplete}
        aspectRatio={1}
        cropShape="rect"
      />
    </div>
  );
};

export default Onboarding;
