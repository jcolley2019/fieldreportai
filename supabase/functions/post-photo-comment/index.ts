import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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

    // Validate the share token is active and not expired
    const { data: share, error: shareError } = await supabase
      .from("project_shares")
      .select("id, report_id, expires_at, revoked_at")
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

    // Validate media_id belongs to this report
    const { data: mediaItem, error: mediaError } = await supabase
      .from("media")
      .select("id")
      .eq("id", media_id)
      .eq("report_id", share.report_id)
      .single();

    if (mediaError || !mediaItem) {
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
