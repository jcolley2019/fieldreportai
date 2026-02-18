import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  share_token: z.string().trim().min(32).max(128),
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
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { share_token } = result.data;

    // Validate share token
    const { data: share, error: shareError } = await supabase
      .from("project_shares")
      .select("id, expires_at, revoked_at")
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

    // Fetch all comments for this share token
    const { data: comments, error: fetchError } = await supabase
      .from("photo_comments")
      .select("id, media_id, commenter_name, comment_text, created_at")
      .eq("share_token", share_token)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    return new Response(JSON.stringify({ comments: comments || [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("get-photo-comments error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to fetch comments" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
