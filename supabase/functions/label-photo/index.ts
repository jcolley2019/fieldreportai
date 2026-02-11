import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - ~7MB max for base64 image
const requestSchema = z.object({
  imageBase64: z.string().min(1, "Image data is required").max(10_000_000, "Image is too large (max ~7MB)"),
  voiceNote: z.string().max(5000).optional(),
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1000;
const FUNCTION_NAME = "label-photo";

// Metrics logging helper
async function logMetrics(params: {
  modelUsed: string;
  usedFallback: boolean;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}) {
  const logEnabled = Deno.env.get('LOG_AI_METRICS') === 'true';
  if (!logEnabled) return;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createClient(supabaseUrl, supabaseKey);
    await supabase.from('ai_metrics').insert({
      function_name: FUNCTION_NAME,
      primary_model: PRIMARY_MODEL,
      model_used: params.modelUsed,
      used_fallback: params.usedFallback,
      latency_ms: params.latencyMs,
      status: params.status,
      error_message: params.errorMessage,
    });
  } catch (error) {
    console.error('Failed to log metrics:', error);
  }
}

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
      max_tokens: 150,
      temperature: 0.3,
    }),
  });
}

async function callWithRetryAndFallback(
  apiKey: string, 
  messages: any[]
): Promise<{ response: Response; modelUsed: string; usedFallback: boolean }> {
  let response = await callAI(apiKey, messages, PRIMARY_MODEL);
  
  if (response.ok) {
    return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
  }
  
  if (response.status === 429 || response.status === 504 || response.status === 408) {
    console.log(`Primary model failed with ${response.status}, retrying...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    response = await callAI(apiKey, messages, PRIMARY_MODEL);
    if (response.ok) {
      return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
    }
    
    console.log(`Switching to fallback model ${FALLBACK_MODEL}...`);
    response = await callAI(apiKey, messages, FALLBACK_MODEL);
    return { response, modelUsed: FALLBACK_MODEL, usedFallback: true };
  }
  
  return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let modelUsed = PRIMARY_MODEL;
  let usedFallback = false;

  try {
    const body = await req.json();
    
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { imageBase64, voiceNote } = validationResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating label for photo...', { hasVoiceNote: !!voiceNote });

    // Choose prompt based on whether a voice note was provided
    const systemPrompt = voiceNote
      ? `You are a field report photo labeling assistant. The user has recorded a voice note describing this photo. 
Your job is to create a refined, professional label based PRIMARILY on the user's spoken description.

CRITICAL RULES:
- Use the user's voice note as the PRIMARY source of information
- You may enhance clarity, grammar, or add minor visual details from the photo that support the user's description
- DO NOT add observations that are outside the scope of what the user described
- DO NOT mention objects or features in the photo that the user did not reference
- Keep the label concise (5-20 words)
- Be professional and factual

The user's voice note: "${voiceNote}"

Respond with ONLY the refined label text, no quotes or additional formatting.`
      : `You are a field report photo labeling assistant. Generate a brief, descriptive label for construction/field work photos. 

Your label should:
- Be concise (5-15 words maximum)
- Describe ONLY the general scene, structure, and work area visible
- Be professional and factual
- Focus on the main subject or work being documented
- Include location details if visible (e.g., "north wall", "roof section")
- DO NOT identify or name specific objects, equipment, brands, or features that are not the primary focus of the work being documented
- DO NOT speculate about items in the background or periphery
- Keep descriptions generic and work-focused (e.g., "Rear exterior of house with patio area" NOT "House with solar panels on roof")

Respond with ONLY the label text, no quotes or additional formatting.`;

    const userContent: any[] = [
      {
        type: 'text',
        text: voiceNote 
          ? 'Refine this voice note into a professional photo label based on the image:'
          : 'Generate a brief descriptive label for this field work photo:'
      },
      {
        type: 'image_url',
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`
        }
      }
    ];

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    const result = await callWithRetryAndFallback(LOVABLE_API_KEY, messages);
    modelUsed = result.modelUsed;
    usedFallback = result.usedFallback;
    const response = result.response;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      await logMetrics({ modelUsed, usedFallback, latencyMs: Date.now() - startTime, status: 'error', errorMessage: `AI gateway error: ${response.status}` });
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      // If AI fails but we have a voice note, use it directly
      if (voiceNote) {
        return new Response(JSON.stringify({ label: voiceNote }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ error: 'Failed to generate label' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    const label = data.choices?.[0]?.message?.content?.trim() || voiceNote || 'Field photo';

    console.log('Generated label using model:', modelUsed, '- Label:', label);

    await logMetrics({ modelUsed, usedFallback, latencyMs: Date.now() - startTime, status: 'success' });

    return new Response(
      JSON.stringify({ label }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error in label-photo function:', error);
    
    await logMetrics({ modelUsed, usedFallback, latencyMs: Date.now() - startTime, status: 'error', errorMessage: error instanceof Error ? error.message : 'Unknown error' });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});