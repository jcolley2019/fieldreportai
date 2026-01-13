import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  context: z.string().min(1, "Context is required").max(10000, "Context is too long"),
  projectName: z.string().max(200).optional(),
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = "google/gemini-2.5-flash";
const RETRY_DELAY_MS = 1000;
const FUNCTION_NAME = "suggest-tasks";

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

async function callAI(apiKey: string, messages: any[], tools: any[], model: string): Promise<Response> {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "suggest_tasks" } }
    }),
  });
}

async function callWithRetryAndFallback(
  apiKey: string, 
  messages: any[], 
  tools: any[]
): Promise<{ response: Response; modelUsed: string; usedFallback: boolean }> {
  // Try primary model
  let response = await callAI(apiKey, messages, tools, PRIMARY_MODEL);
  
  if (response.ok) {
    return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
  }
  
  // If rate limited or timeout, retry once after delay
  if (response.status === 429 || response.status === 504 || response.status === 408) {
    console.log(`Primary model ${PRIMARY_MODEL} failed with ${response.status}, retrying after delay...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    response = await callAI(apiKey, messages, tools, PRIMARY_MODEL);
    if (response.ok) {
      return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
    }
    
    // If still failing, try fallback model
    console.log(`Primary model retry failed, switching to fallback model ${FALLBACK_MODEL}...`);
    response = await callAI(apiKey, messages, tools, FALLBACK_MODEL);
    return { response, modelUsed: FALLBACK_MODEL, usedFallback: true };
  }
  
  return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
}

serve(async (req) => {
  // Handle CORS preflight requests
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
    
    const { context, projectName } = validationResult.data;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Generating task suggestions for project:", projectName);

    const systemPrompt = `You are a helpful project management assistant that extracts and suggests actionable tasks. 
When given context (which may be transcribed speech), identify and extract specific tasks mentioned.
Each task should be specific, actionable, and have a clear priority level based on urgency words used.
If the context sounds like a spoken task list, extract each task mentioned.
If the context is more general, suggest 3-5 practical tasks that would help progress the work.`;

    const userPrompt = `Based on this context, extract or suggest actionable tasks:
Project Name: ${projectName || 'General'}
Context: ${context}

If this sounds like someone dictating tasks, extract each task they mentioned.
Otherwise, generate practical, specific tasks that would help with this project.
Assign priority based on urgency indicators (words like "urgent", "asap", "important" = high; "when possible", "later" = low; otherwise = medium).`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "suggest_tasks",
          description: "Return 3-5 actionable task suggestions.",
          parameters: {
            type: "object",
            properties: {
              suggestions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short, actionable task title" },
                    description: { type: "string", description: "Brief description of what needs to be done" },
                    priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority level" }
                  },
                  required: ["title", "priority"],
                  additionalProperties: false
                }
              }
            },
            required: ["suggestions"],
            additionalProperties: false
          }
        }
      }
    ];

    const result = await callWithRetryAndFallback(LOVABLE_API_KEY, messages, tools);
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
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received using model:", modelUsed);
    
    // Extract tool call results
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const suggestions = JSON.parse(toolCall.function.arguments);
      
      await logMetrics({
        modelUsed,
        usedFallback,
        latencyMs: Date.now() - startTime,
        status: 'success',
      });
      
      return new Response(JSON.stringify(suggestions), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    // Fallback if no tool call
    return new Response(JSON.stringify({ suggestions: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in suggest-tasks function:", error);
    
    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
    
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
