import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  noteText: z.string().min(1, "Note text is required").max(50000, "Note text is too long"),
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = "google/gemini-2.5-flash";
const RETRY_DELAY_MS = 1000;
const FUNCTION_NAME = "generate-note-summary";

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
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not configured for metrics logging');
      return;
    }

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
    body: JSON.stringify({ model, messages }),
  });
}

async function callWithRetryAndFallback(
  apiKey: string, 
  messages: any[]
): Promise<{ response: Response; modelUsed: string; usedFallback: boolean }> {
  // Try primary model
  let response = await callAI(apiKey, messages, PRIMARY_MODEL);
  
  if (response.ok) {
    return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
  }
  
  // If rate limited or timeout, retry once after delay
  if (response.status === 429 || response.status === 504 || response.status === 408) {
    console.log(`Primary model ${PRIMARY_MODEL} failed with ${response.status}, retrying after delay...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    response = await callAI(apiKey, messages, PRIMARY_MODEL);
    if (response.ok) {
      return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
    }
    
    // If still failing, try fallback model
    console.log(`Primary model retry failed, switching to fallback model ${FALLBACK_MODEL}...`);
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
    
    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { noteText } = validationResult.data;
    console.log("Generating note summary for text of length:", noteText.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a professional note organizer. Your task is to analyze transcribed voice notes and create a well-structured, professional summary.

Format your response as follows:
1. SUMMARY: A brief 2-3 sentence overview of the notes
2. KEY POINTS: 5-7 bullet points highlighting the main topics or action items
3. FULL NOTES: The original transcription, organized chronologically and cleaned up for readability

Keep the tone professional but conversational. Preserve important details while removing filler words and repetitions.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Please organize and summarize these voice notes:\n\n${noteText}` }
    ];

    const result = await callWithRetryAndFallback(LOVABLE_API_KEY, messages);
    modelUsed = result.modelUsed;
    usedFallback = result.usedFallback;
    const response = result.response;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      await logMetrics({
        modelUsed,
        usedFallback,
        latencyMs: Date.now() - startTime,
        status: 'error',
        errorMessage: `AI gateway error: ${response.status}`,
      });
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("AI response received using model:", modelUsed);

    const organizedNotes = data.choices?.[0]?.message?.content;
    if (!organizedNotes) {
      throw new Error("No response from AI");
    }

    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ organizedNotes }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in generate-note-summary:", error);
    
    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
