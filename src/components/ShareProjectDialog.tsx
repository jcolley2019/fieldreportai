import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link2, Users, Copy, Check, Trash2, Loader2, Mail, Clock, Download, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  projectName: string;
}

interface ShareLink {
  id: string;
  share_token: string;
  expires_at: string;
  allow_download: boolean;
  created_at: string;
  revoked_at: string | null;
}

interface TeamMember {
  id: string;
  member_email: string;
  role: string;
  invited_at: string;
  accepted_at: string | null;
}

export const ShareProjectDialog = ({ open, onOpenChange, reportId, projectName }: ShareProjectDialogProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("link");
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [allowDownload, setAllowDownload] = useState(true);
  const [expirationDays, setExpirationDays] = useState(30);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor" | "admin">("viewer");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchShareData();
    }
  }, [open, reportId]);

  const fetchShareData = async () => {
    setIsLoading(true);
    try {
      const [linksResult, membersResult] = await Promise.all([
        supabase
          .from("project_shares")
          .select("*")
          .eq("report_id", reportId)
          .is("revoked_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("team_members")
          .select("*")
          .eq("report_id", reportId)
          .order("invited_at", { ascending: false }),
      ]);

      if (linksResult.data) setShareLinks(linksResult.data);
      if (membersResult.data) setTeamMembers(membersResult.data);
    } catch (error) {
      console.error("Error fetching share data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const createShareLink = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      const { data, error } = await supabase
        .from("project_shares")
        .insert({
          report_id: reportId,
          user_id: user.id,
          expires_at: expiresAt.toISOString(),
          allow_download: allowDownload,
        })
        .select()
        .single();

      if (error) throw error;

      setShareLinks(prev => [data, ...prev]);
      toast.success(t("share.linkCreated"));
    } catch (error: any) {
      console.error("Error creating share link:", error);
      toast.error(t("share.createError"));
    } finally {
      setIsLoading(false);
    }
  };

  const revokeShareLink = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from("project_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", shareId);

      if (error) throw error;

      setShareLinks(prev => prev.filter(link => link.id !== shareId));
      toast.success(t("share.linkRevoked"));
    } catch (error) {
      console.error("Error revoking share link:", error);
      toast.error(t("share.revokeError"));
    }
  };

  const copyShareLink = async (token: string) => {
    const url = `${window.location.origin}/shared/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success(t("share.linkCopied"));
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  const inviteTeamMember = async () => {
    if (!inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("team_members")
        .insert({
          report_id: reportId,
          owner_id: user.id,
          member_email: inviteEmail.trim().toLowerCase(),
          role: inviteRole,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error(t("share.alreadyInvited"));
        } else {
          throw error;
        }
        return;
      }

      setTeamMembers(prev => [data, ...prev]);
      setInviteEmail("");
      toast.success(t("share.inviteSent"));
    } catch (error: any) {
      console.error("Error inviting team member:", error);
      toast.error(t("share.inviteError"));
    } finally {
      setIsInviting(false);
    }
  };

  const removeTeamMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
      toast.success(t("share.memberRemoved"));
    } catch (error) {
      console.error("Error removing team member:", error);
      toast.error(t("share.removeError"));
    }
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("share.shareProject")}
          </DialogTitle>
          <DialogDescription>{projectName}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="link" className="gap-2">
              <Link2 className="h-4 w-4" />
              {t("share.publicLink")}
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="h-4 w-4" />
              {t("share.teamAccess")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              {t("share.publicLinkDesc")}
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  {t("share.allowDownload")}
                </Label>
                <Switch checked={allowDownload} onCheckedChange={setAllowDownload} />
              </div>

              <div className="flex items-center gap-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t("share.expiresIn")}
                </Label>
                <select
                  className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                >
                  <option value={7}>7 {t("share.days")}</option>
                  <option value={30}>30 {t("share.days")}</option>
                  <option value={90}>90 {t("share.days")}</option>
                </select>
              </div>

              <Button onClick={createShareLink} disabled={isLoading} className="w-full">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Link2 className="h-4 w-4 mr-2" />}
                {t("share.createLink")}
              </Button>
            </div>

            {shareLinks.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>{t("share.activeLinks")}</Label>
                  {shareLinks.map((link) => (
                    <div
                      key={link.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isExpired(link.expires_at) ? "bg-muted opacity-60" : "bg-background"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs truncate max-w-[150px]">
                            ...{link.share_token.slice(-8)}
                          </code>
                          {isExpired(link.expires_at) ? (
                            <Badge variant="destructive" className="text-xs">{t("share.expired")}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {t("share.expiresOn", { date: format(new Date(link.expires_at), "MMM d") })}
                            </Badge>
                          )}
                          {link.allow_download && (
                            <Download className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!isExpired(link.expires_at) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyShareLink(link.share_token)}
                          >
                          {isCopied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => revokeShareLink(link.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="team" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              {t("share.teamAccessDesc")}
            </p>

            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder={t("share.enterEmail")}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && inviteTeamMember()}
                  className="flex-1"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "viewer" | "editor" | "admin")}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={inviteTeamMember} disabled={isInviting || !inviteEmail.trim()}>
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Viewer: read-only · Editor: can add photos &amp; notes · Admin: full edit access
              </p>
            </div>

            {teamMembers.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label>{t("share.teamMembers")}</Label>
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-background"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{member.member_email}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs capitalize">{member.role}</Badge>
                          {member.accepted_at ? (
                            <Badge variant="secondary" className="text-xs">{t("share.accepted")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">{t("share.pending")}</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamMember(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
