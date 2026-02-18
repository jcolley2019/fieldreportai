import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ProjectRole = "owner" | "editor" | "viewer" | "none";

/**
 * Returns the effective role of the currently authenticated user for a given project.
 *
 * - "owner"  → user_id on the reports row matches auth.uid()
 * - "editor" → team_members row with role = 'editor' or 'admin' and accepted_at IS NOT NULL
 * - "viewer" → team_members row with role = 'viewer' and accepted_at IS NOT NULL
 * - "none"   → no access
 *
 * Unaccepted invites are treated as "none" until the user accepts.
 */
export const useProjectRole = (projectId: string | undefined) => {
  const [role, setRole] = useState<ProjectRole>("none");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const check = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setRole("none"); return; }

        // Check ownership first
        const { data: report } = await supabase
          .from("reports")
          .select("user_id")
          .eq("id", projectId)
          .maybeSingle();

        if (report?.user_id === user.id) {
          setRole("owner");
          return;
        }

        // Check team membership (accepted only)
        const { data: member } = await supabase
          .from("team_members")
          .select("role, accepted_at")
          .eq("report_id", projectId)
          .or(`member_user_id.eq.${user.id},member_email.eq.${user.email}`)
          .not("accepted_at", "is", null)
          .maybeSingle();

        if (!member) { setRole("none"); return; }

        if (member.role === "admin" || member.role === "editor") {
          setRole("editor");
        } else {
          setRole("viewer");
        }
      } catch (err) {
        console.error("useProjectRole error:", err);
        setRole("none");
      } finally {
        setLoading(false);
      }
    };

    check();
  }, [projectId]);

  const canEdit = role === "owner" || role === "editor";
  const canManage = role === "owner"; // delete, share, export

  return { role, loading, canEdit, canManage };
};
