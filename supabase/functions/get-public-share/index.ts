import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const requestSchema = z.object({
  token: z.string().min(32).max(128),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { token } = requestSchema.parse(await req.json());

    // Find the share link
    const { data: share, error: shareError } = await supabaseClient
      .from("project_shares")
      .select("*, reports(*)")
      .eq("share_token", token)
      .is("revoked_at", null)
      .single();

    if (shareError || !share) {
      return new Response(
        JSON.stringify({ error: "Share link not found or has been revoked" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if expired
    if (new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log share access for audit trail
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";
    await supabaseClient
      .from("share_access_log")
      .insert({
        share_id: share.id,
        ip_address: ip.split(",")[0].trim(),
        user_agent: userAgent.substring(0, 500),
      });

    const report = share.reports;
    const reportId = share.report_id;

    // Fetch all project content
    const [mediaResult, notesResult, checklistsResult, tasksResult] = await Promise.all([
      supabaseClient
        .from("media")
        .select("*")
        .eq("report_id", reportId)
        .order("captured_at", { ascending: true }),
      supabaseClient
        .from("notes")
        .select("*")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false }),
      supabaseClient
        .from("checklists")
        .select("*, checklist_items(*)")
        .eq("report_id", reportId),
      supabaseClient
        .from("tasks")
        .select("*")
        .eq("report_id", reportId)
        .order("created_at", { ascending: false }),
    ]);

    // Generate signed URLs for media (valid for 1 hour)
    const mediaWithUrls = await Promise.all(
      (mediaResult.data || []).map(async (item) => {
        const { data: signedData } = await supabaseClient.storage
          .from("media")
          .createSignedUrl(item.file_path, 3600);
        return {
          ...item,
          signedUrl: signedData?.signedUrl || null,
        };
      })
    );

    // Get owner profile for branding
    const { data: ownerProfile } = await supabaseClient
      .from("profiles")
      .select("company_name, company_logo_url, first_name, last_name")
      .eq("id", share.user_id)
      .single();

    return new Response(
      JSON.stringify({
        project: {
          project_name: report.project_name,
          customer_name: report.customer_name,
          job_number: report.job_number,
          job_description: report.job_description,
          created_at: report.created_at,
        },
        media: mediaWithUrls,
        notes: notesResult.data || [],
        checklists: checklistsResult.data || [],
        tasks: tasksResult.data || [],
        owner: ownerProfile,
        allowDownload: share.allow_download,
        expiresAt: share.expires_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in get-public-share:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
