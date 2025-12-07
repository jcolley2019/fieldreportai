import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SALES_EMAIL = Deno.env.get("SALES_EMAIL") || "jcolley2019@gmail.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const requestSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  company: z.string().min(1, "Company is required").max(200),
  companySize: z.string().max(50).optional(),
  licenseQuantity: z.string().max(50).optional(),
  integrationsNeeded: z.string().max(500).optional(),
  customFormatting: z.string().max(500).optional(),
  customFeatures: z.string().max(2000).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.flatten() }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    const {
      name,
      email,
      company,
      companySize,
      licenseQuantity,
      integrationsNeeded,
      customFormatting,
      customFeatures,
    } = validationResult.data;

    // Create Supabase client with service role for lead capture
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Save lead to database with enterprise_nurture sequence
    const { error: leadError } = await supabase
      .from('leads')
      .upsert(
        {
          email,
          name,
          company,
          source: 'enterprise_inquiry',
          active_sequences: ['enterprise_nurture'],
        },
        { onConflict: 'email' }
      );

    if (leadError) {
      console.error("Error saving lead:", leadError);
      // Don't fail the request if lead capture fails
    }

    // Send email to sales team using Resend API directly
    const salesEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Field Report AI <onboarding@resend.dev>",
        to: [SALES_EMAIL],
        reply_to: email,
        subject: `Enterprise Plan Inquiry from ${company}`,
        html: `
          <h1>New Enterprise Plan Inquiry</h1>
          <h2>Contact Information</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Company:</strong> ${company}</p>
          
          <h2>Company Details</h2>
          <p><strong>Company Size:</strong> ${companySize || "Not specified"}</p>
          <p><strong>Number of Licenses:</strong> ${licenseQuantity || "Not specified"}</p>
          
          <h2>Integration Requirements</h2>
          <p>${integrationsNeeded || "None specified"}</p>
          
          <h2>Custom Formatting Requirements</h2>
          <p>${customFormatting || "None specified"}</p>
          
          <h2>Custom Feature Requests</h2>
          <p>${customFeatures || "None specified"}</p>
          
          <hr style="margin: 30px 0;" />
          <p style="color: #666; font-size: 12px;">
            This inquiry was submitted through the Field Report AI pricing page.
          </p>
        `,
      }),
    });

    if (!salesEmailResponse.ok) {
      const error = await salesEmailResponse.json();
      throw new Error(error.message || "Failed to send sales email");
    }

    // Send confirmation email to customer
    const customerEmailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Field Report AI <onboarding@resend.dev>",
        to: [email],
        subject: "We received your Enterprise Plan inquiry",
        html: `
          <h1>Thank you for your interest, ${name}!</h1>
          <p>We have received your inquiry about our Enterprise Plan for <strong>${company}</strong>.</p>
          <p>Our sales team will review your requirements and get back to you within 1-2 business days with a custom quote and next steps.</p>
          
          <h2>Your Submitted Information</h2>
          <p><strong>Company Size:</strong> ${companySize || "Not specified"}</p>
          <p><strong>Licenses Needed:</strong> ${licenseQuantity || "Not specified"}</p>
          <p><strong>Integrations:</strong> ${integrationsNeeded || "None specified"}</p>
          
          <p>If you have any questions in the meantime, feel free to reply to this email.</p>
          
          <p>Best regards,<br>
          The Field Report AI Team</p>
        `,
      }),
    });

    if (!customerEmailResponse.ok) {
      const error = await customerEmailResponse.json();
      console.error("Failed to send customer email:", error);
      // Continue even if customer email fails
    }

    const salesData = await salesEmailResponse.json();
    const customerData = customerEmailResponse.ok ? await customerEmailResponse.json() : null;

    console.log("Sales inquiry emails sent successfully");

    return new Response(
      JSON.stringify({ 
        success: true,
        salesEmailId: salesData.id,
        customerEmailId: customerData?.id,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-enterprise-sales-inquiry function:", error);
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
