import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Check, X, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

interface PendingInvite {
  id: string;
  report_id: string;
  role: string;
  invited_at: string | null;
  project_name?: string;
  owner_email?: string;
}

interface PendingInvitesModalProps {
  userId: string;
  userEmail: string;
}

export const PendingInvitesModal = ({ userId, userEmail }: PendingInvitesModalProps) => {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [open, setOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !userEmail) return;
    fetchPendingInvites();
  }, [userId, userEmail]);

  const fetchPendingInvites = async () => {
    // Fetch pending invites matching this user's email or user_id
    const { data, error } = await supabase
      .from("team_members")
      .select("id, report_id, role, invited_at, member_user_id")
      .or(`member_user_id.eq.${userId},member_email.eq.${userEmail}`)
      .is("accepted_at", null);

    if (error) {
      console.error("Error fetching pending invites:", error);
      return;
    }

    if (!data || data.length === 0) return;

    // Enrich with project names
    const enriched = await Promise.all(
      data.map(async (inv) => {
        const { data: report } = await supabase
          .from("reports")
          .select("project_name, customer_name")
          .eq("id", inv.report_id)
          .maybeSingle();

        return {
          ...inv,
          project_name: report
            ? `${report.project_name}${report.customer_name ? ` · ${report.customer_name}` : ""}`
            : "Unknown project",
        };
      })
    );

    setInvites(enriched);
    if (enriched.length > 0) setOpen(true);
  };

  const handleAccept = async (invite: PendingInvite) => {
    setProcessingId(invite.id);
    try {
      const { error } = await supabase
        .from("team_members")
        .update({
          accepted_at: new Date().toISOString(),
          member_user_id: userId,
        })
        .eq("id", invite.id);

      if (error) throw error;

      toast.success(`Joined "${invite.project_name}" as ${invite.role}`);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (invites.length <= 1) setOpen(false);
    } catch (err) {
      console.error("Error accepting invite:", err);
      toast.error("Failed to accept invitation. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (invite: PendingInvite) => {
    setProcessingId(invite.id);
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", invite.id);

      if (error) throw error;

      toast.success("Invitation declined");
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      if (invites.length <= 1) setOpen(false);
    } catch (err) {
      console.error("Error declining invite:", err);
      toast.error("Failed to decline invitation. Please try again.");
    } finally {
      setProcessingId(null);
    }
  };

  const roleColor = (role: string) => {
    if (role === "admin") return "destructive";
    if (role === "editor") return "default";
    return "secondary";
  };

  if (invites.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Project Invitation{invites.length > 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            You have {invites.length} pending project invitation
            {invites.length > 1 ? "s" : ""}. Accept to gain access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {invites.map((invite, idx) => (
            <div key={invite.id}>
              {idx > 0 && <Separator className="mb-3" />}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 flex-shrink-0">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {invite.project_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={roleColor(invite.role) as any} className="text-xs capitalize">
                        {invite.role}
                      </Badge>
                      {invite.invited_at && (
                        <span className="text-xs text-muted-foreground">
                          Invited{" "}
                          {new Date(invite.invited_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleAccept(invite)}
                    disabled={processingId === invite.id}
                  >
                    {processingId === invite.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1.5"
                    onClick={() => handleDecline(invite)}
                    disabled={processingId === invite.id}
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
