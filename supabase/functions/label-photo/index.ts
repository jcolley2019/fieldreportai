import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - ~7MB max for base64 image
const requestSchema = z.object({
  imageBase64: z.string().min(1, "Image data is required").max(10_000_000, "Image is too large (max ~7MB)"),
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1000;

async function callAI(apiKey: string, messages: any[], model: string): Promise<Response> {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 100,
      temperature: 0.3,
    }),
  });
}

async function callWithRetryAndFallback(
  apiKey: string, 
  messages: any[]
): Promise<{ response: Response; modelUsed: string }> {
  // Try primary model
  let response = await callAI(apiKey, messages, PRIMARY_MODEL);
  
  if (response.ok) {
    return { response, modelUsed: PRIMARY_MODEL };
  }
  
  // If rate limited or timeout, retry once after delay
  if (response.status === 429 || response.status === 504 || response.status === 408) {
    console.log(`Primary model ${PRIMARY_MODEL} failed with ${response.status}, retrying after delay...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    response = await callAI(apiKey, messages, PRIMARY_MODEL);
    if (response.ok) {
      return { response, modelUsed: PRIMARY_MODEL };
    }
    
    // If still failing, try fallback model
    console.log(`Primary model retry failed, switching to fallback model ${FALLBACK_MODEL}...`);
    response = await callAI(apiKey, messages, FALLBACK_MODEL);
    return { response, modelUsed: FALLBACK_MODEL };
  }
  
  return { response, modelUsed: PRIMARY_MODEL };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { imageBase64 } = validationResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating label for photo...');

    const messages = [
      {
        role: 'system',
        content: `You are a field report photo labeling assistant. Generate a brief, descriptive label for construction/field work photos. 
        
Your label should:
- Be concise (5-15 words maximum)
- Describe what's visible in the photo
- Be professional and factual
- Focus on the main subject or work being documented
- Include location details if visible (e.g., "north wall", "roof section")

Examples of good labels:
- "Electrical panel installation in basement utility room"
- "Foundation concrete pour, section A complete"
- "HVAC ductwork routing through ceiling joists"
- "Water damage on south wall near window frame"
- "Completed drywall installation in master bedroom"

Respond with ONLY the label text, no quotes or additional formatting.`
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Generate a brief descriptive label for this field work photo:'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
            }
          }
        ]
      }
    ];

    const { response, modelUsed } = await callWithRetryAndFallback(LOVABLE_API_KEY, messages);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to generate label' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const label = data.choices?.[0]?.message?.content?.trim() || 'Field photo';

    console.log('Generated label using model:', modelUsed, '- Label:', label);

    return new Response(
      JSON.stringify({ label }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in label-photo function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
