import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB - Resend's limit

interface SendExportEmailRequest {
  recipientEmail: string;
  recipientName?: string;
  senderName: string;
  subject?: string;
  message?: string;
  fileData?: string; // Base64 encoded file
  fileName?: string;
  fileSize?: number;
  downloadUrl?: string; // For large files
}

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
    }: SendExportEmailRequest = await req.json();

    console.log("Sending export email to:", recipientEmail);
    console.log("File size:", fileSize);
    console.log("Has download URL:", !!downloadUrl);

    // Determine if we should send as attachment or download link
    const useAttachment = fileData && fileSize && fileSize <= MAX_ATTACHMENT_SIZE;

    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Field Report Export</h2>
        <p>Hi${recipientName ? ` ${recipientName}` : ''},</p>
        <p>${senderName} has shared a field report export with you.</p>
        ${message ? `<p style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;"><em>${message}</em></p>` : ''}
    `;

    if (useAttachment && fileData && fileName) {
      emailHtml += `
        <p>The export file is attached to this email.</p>
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          This file was exported from Field Report AI
        </p>
      `;
    } else if (downloadUrl) {
      emailHtml += `
        <p>Your export file is ready to download. Click the button below to download:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${downloadUrl}" 
             style="display: inline-block; background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Download Export File
          </a>
        </div>
        <p style="color: #666; font-size: 14px;">
          <strong>Note:</strong> This download link will expire in 7 days for security reasons.
        </p>
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
          This file was exported from Field Report AI
        </p>
      `;
    }

    emailHtml += `</div>`;

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
