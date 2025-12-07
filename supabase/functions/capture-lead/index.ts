import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const leadSourceSchema = z.enum([
  'pricing_page',
  'landing_page',
  'newsletter',
  'trial_signup'
]);

const sequenceSchema = z.enum(['welcome', 'trial', 'newsletter']);

const requestSchema = z.object({
  email: z.string().email("Invalid email address").max(255),
  name: z.string().max(100).optional(),
  source: leadSourceSchema,
  sequence: sequenceSchema.optional().default('welcome'),
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
    
    const { email, name, source, sequence } = validationResult.data;

    // Create Supabase client with service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if lead already exists
    const { data: existingLead, error: checkError } = await supabase
      .from('leads')
      .select('id, active_sequences, subscribed')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    let leadId: string;

    if (existingLead) {
      // Update existing lead - add sequence if not already active
      const updatedSequences = existingLead.active_sequences || [];
      if (!updatedSequences.includes(sequence)) {
        updatedSequences.push(sequence);
      }

      const { data, error: updateError } = await supabase
        .from('leads')
        .update({ 
          active_sequences: updatedSequences,
          subscribed: true, // Re-subscribe if they opted back in
          ...(name && { name }) // Update name if provided
        })
        .eq('email', email)
        .select('id')
        .single();

      if (updateError) throw updateError;
      leadId = data.id;
    } else {
      // Create new lead
      const { data, error: insertError } = await supabase
        .from('leads')
        .insert({
          email,
          name,
          source,
          active_sequences: [sequence],
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      leadId = data.id;
    }

    // Send welcome email based on sequence type
    let emailSubject = "";
    let emailContent = "";

    switch (sequence) {
      case "newsletter":
        emailSubject = "Thanks for subscribing to Field Report AI";
        emailContent = `
          <h1>Welcome to Field Report AI!</h1>
          <p>Thanks for subscribing to our newsletter. You'll receive updates about:</p>
          <ul>
            <li>New features and product updates</li>
            <li>Tips for better field reporting</li>
            <li>Industry best practices</li>
            <li>Exclusive offers and early access</li>
          </ul>
          <p>Stay tuned for great content!</p>
          <p>Best regards,<br>The Field Report AI Team</p>
        `;
        break;
      
      case "trial":
        emailSubject = "Start your 14-day free trial";
        emailContent = `
          <h1>Welcome to Field Report AI!</h1>
          <p>Your 14-day free trial is ready. Here's what you can do:</p>
          <ul>
            <li>Create unlimited reports and checklists</li>
            <li>Capture photos and videos</li>
            <li>Use AI-powered insights</li>
            <li>Collaborate with your team</li>
          </ul>
          <p><a href="https://app.fieldreportai.com/auth" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Get Started Now</a></p>
          <p>Need help? Reply to this email anytime.</p>
          <p>Best regards,<br>The Field Report AI Team</p>
        `;
        break;
      
      default: // welcome
        emailSubject = "Welcome to Field Report AI";
        emailContent = `
          <h1>Thanks for your interest in Field Report AI!</h1>
          <p>We're excited to help you streamline your field reporting process.</p>
          <p>Start your free 14-day trial today and experience:</p>
          <ul>
            <li>✨ AI-powered report generation</li>
            <li>📸 Advanced photo and video capture</li>
            <li>✅ Smart checklists</li>
            <li>🤝 Team collaboration</li>
          </ul>
          <p><a href="https://app.fieldreportai.com/auth" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Start Free Trial</a></p>
          <p>Best regards,<br>The Field Report AI Team</p>
        `;
    }

    // Send welcome email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Field Report AI <onboarding@resend.dev>",
        to: [email],
        subject: emailSubject,
        html: emailContent,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.json();
      console.error("Failed to send email:", error);
      // Don't fail the request if email fails
    } else {
      // Log the sent email
      const emailData = await emailResponse.json();
      await supabase
        .from('email_sequence_log')
        .insert({
          lead_id: leadId,
          sequence_type: sequence,
          email_subject: emailSubject,
        });
    }

    console.log("Lead captured successfully:", { email, source, sequence });

    return new Response(
      JSON.stringify({ success: true, leadId }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in capture-lead function:", error);
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
