import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB - Resend's limit

// Input validation schema
const requestSchema = z.object({
  recipientEmail: z.string().email("Invalid recipient email").max(255),
  recipientName: z.string().max(100).optional(),
  senderName: z.string().min(1, "Sender name is required").max(100),
  subject: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  fileData: z.string().max(35_000_000).optional(), // ~25MB base64
  fileName: z.string().max(255).optional(),
  fileSize: z.number().max(MAX_ATTACHMENT_SIZE).optional(),
  downloadUrl: z.string().url().max(2000).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    // Get user profile for branding
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_name, company_logo_url, email_template_color, email_template_message, current_plan")
      .eq("id", user.id)
      .single();

    const isPremiumOrEnterprise = profile?.current_plan === 'premium' || profile?.current_plan === 'enterprise';
    const brandColor = isPremiumOrEnterprise && profile?.email_template_color ? profile.email_template_color : "#007bff";
    const customMessage = isPremiumOrEnterprise && profile?.email_template_message ? profile.email_template_message : "";
    const companyName = profile?.company_name || "Field Report AI";
    const companyLogoUrl = isPremiumOrEnterprise && profile?.company_logo_url ? profile.company_logo_url : null;

    const body = await req.json();
    
    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { 
      recipientEmail, 
      recipientName,
      senderName,
      subject,
      message,
      fileData,
      fileName,
      fileSize,
      downloadUrl 
    } = validationResult.data;

    console.log("Sending export email to:", recipientEmail);
    console.log("File size:", fileSize);
    console.log("Has download URL:", !!downloadUrl);
    console.log("Using custom branding:", isPremiumOrEnterprise);

    // Determine if we should send as attachment or download link
    const useAttachment = fileData && fileSize && fileSize <= MAX_ATTACHMENT_SIZE;

    let emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${companyLogoUrl ? `
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="${companyLogoUrl}" alt="${companyName}" style="max-height: 60px; width: auto;" />
          </div>
        ` : ''}
        <div style="background: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #1a1a1a; margin: 0 0 10px 0; font-size: 24px;">Field Report Export</h2>
          <p style="color: #666; margin: 0 0 5px 0;">Hi${recipientName ? ` ${recipientName}` : ''},</p>
          <p style="color: #666; margin: 0 0 20px 0;">${senderName} from ${companyName} has shared a field report export with you.</p>
          ${message ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${brandColor};"><p style="margin: 0; color: #333; font-style: italic;">${message}</p></div>` : ''}
    `;

    if (useAttachment && fileData && fileName) {
      emailHtml += `
        <p style="color: #666; margin: 0 0 20px 0;">The export file is attached to this email.</p>
      `;
    } else if (downloadUrl) {
      emailHtml += `
        <p style="color: #666; margin: 0 0 20px 0;">Your export file is ready to download. Click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${downloadUrl}" 
             style="display: inline-block; background-color: ${brandColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Download Export File
          </a>
        </div>
        <p style="color: #999; font-size: 13px; margin: 0;">
          <strong>Note:</strong> This download link will expire in 7 days for security reasons.
        </p>
      `;
    }

    emailHtml += `
          ${customMessage ? `
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
              <p style="color: #666; font-size: 14px; margin: 0;">${customMessage}</p>
            </div>
          ` : ''}
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e5e5; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              This file was exported from Field Report AI
            </p>
          </div>
        </div>
      </div>
    `;

    // Prepare email request for Resend API
    const emailPayload: any = {
      from: "Field Report AI <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: subject || "Field Report Export",
      html: emailHtml,
    };

    // Add attachment if file is small enough
    if (useAttachment && fileData && fileName) {
      emailPayload.attachments = [{
        filename: fileName,
        content: fileData,
      }];
    }

    // Send email using Resend API directly
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const emailData = await emailResponse.json();

    console.log("Email sent successfully:", emailData);

    return new Response(JSON.stringify({ 
      success: true, 
      id: emailData.id,
      usedAttachment: useAttachment 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-export-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
