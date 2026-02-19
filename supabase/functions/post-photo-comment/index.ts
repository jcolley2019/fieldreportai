import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  share_token: z.string().trim().min(32).max(128),
  media_id: z.string().uuid(),
  commenter_name: z.string().trim().min(1, "Name required").max(100, "Name too long"),
  comment_text: z.string().trim().min(1, "Comment required").max(1000, "Comment too long (max 1000 chars)"),
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: result.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { share_token, media_id, commenter_name, comment_text } = result.data;

    // Validate the share token is active and not expired — also fetch owner info
    const { data: share, error: shareError } = await supabase
      .from("project_shares")
      .select("id, report_id, expires_at, revoked_at, user_id")
      .eq("share_token", share_token)
      .is("revoked_at", null)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Invalid or revoked share link" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate media_id belongs to this report and get report + owner details in parallel
    const [mediaResult, reportResult, ownerResult] = await Promise.all([
      supabase
        .from("media")
        .select("id")
        .eq("id", media_id)
        .eq("report_id", share.report_id)
        .single(),
      supabase
        .from("reports")
        .select("project_name, customer_name")
        .eq("id", share.report_id)
        .single(),
      supabase.auth.admin.getUserById(share.user_id),
    ]);

    if (mediaResult.error || !mediaResult.data) {
      return new Response(
        JSON.stringify({ error: "Media item not found in this project" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the comment
    const { data: comment, error: insertError } = await supabase
      .from("photo_comments")
      .insert({
        media_id,
        share_token,
        commenter_name: commenter_name.trim(),
        comment_text: comment_text.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      throw insertError;
    }

    // Send notification email to the project owner (fire-and-forget)
    const ownerEmail = ownerResult.data?.user?.email;
    const projectName = reportResult.data?.project_name ?? "Your project";
    const customerName = reportResult.data?.customer_name;
    const shareUrl = `https://fieldreportai.lovable.app/shared/${share_token}`;

    if (ownerEmail && RESEND_API_KEY) {
      const safeCommenterName = escapeHtml(commenter_name.trim());
      const safeCommentText = escapeHtml(comment_text.trim());
      const safeProjectName = escapeHtml(projectName);
      const safeCustomerName = customerName ? escapeHtml(customerName) : null;

      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border-top: 4px solid #007bff;">
            <div style="display: flex; align-items: center; margin-bottom: 24px;">
              <span style="font-size: 28px; margin-right: 12px;">💬</span>
              <h2 style="color: #1a1a1a; margin: 0; font-size: 22px;">New Comment on Your Project</h2>
            </div>
            <p style="color: #555; margin: 0 0 16px 0; font-size: 15px;">
              <strong>${safeCommenterName}</strong> left a comment on a photo in 
              <strong>${safeProjectName}</strong>${safeCustomerName ? ` (${safeCustomerName})` : ""}.
            </p>
            <div style="background: #f8f9fa; border-left: 4px solid #007bff; border-radius: 4px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.6; font-style: italic;">"${safeCommentText}"</p>
              <p style="margin: 12px 0 0 0; color: #888; font-size: 13px;">— ${safeCommenterName}</p>
            </div>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${shareUrl}" 
                 style="display: inline-block; background-color: #007bff; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px;">
                View Project Gallery
              </a>
            </div>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                You're receiving this because someone commented on your shared Field Report AI gallery.
              </p>
            </div>
          </div>
        </div>
      `;

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Field Report AI <onboarding@resend.dev>",
          to: [ownerEmail],
          subject: `💬 New comment on "${projectName}" from ${commenter_name.trim()}`,
          html: emailHtml,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          console.error("Failed to send comment notification email:", err);
        } else {
          console.log("Comment notification email sent to:", ownerEmail);
        }
      }).catch((err) => {
        console.error("Comment notification email error:", err);
      });
    }

    return new Response(JSON.stringify({ comment }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("post-photo-comment error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to post comment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
