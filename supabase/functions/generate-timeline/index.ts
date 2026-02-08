import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const requestSchema = z.object({
  projectId: z.string().uuid(),
  imageDataUrls: z.array(z.object({
    url: z.string().max(10_000_000),
    capturedAt: z.string().optional(),
    locationName: z.string().optional(),
  })).max(50),
  projectName: z.string().max(500).optional(),
  customerName: z.string().max(500).optional(),
});

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1000;
const FUNCTION_NAME = "generate-timeline";

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
    body: JSON.stringify({ model, messages }),
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
    
    console.log(`Retry failed, switching to fallback model...`);
    response = await callAI(apiKey, messages, FALLBACK_MODEL);
    return { response, modelUsed: FALLBACK_MODEL, usedFallback: true };
  }
  
  return { response, modelUsed: PRIMARY_MODEL, usedFallback: false };
}

const SYSTEM_PROMPT = `You are an expert construction progress analyst. You will be given a series of project photos in chronological order with their capture dates.

Your task is to create a compelling narrative that tells the story of the project's progress over time. 

Analyze the photos and write a comprehensive progress narrative that includes:

1. **EXECUTIVE SUMMARY** (2-3 sentences)
A high-level overview of what has been accomplished across the timeline.

2. **TIMELINE NARRATIVE**
For each significant phase or date range, describe:
- What work was visible/completed
- Progress made compared to earlier photos
- Any notable changes, challenges, or milestones observed

3. **KEY OBSERVATIONS**
• Major milestones achieved
• Notable changes between time periods
• Quality observations
• Any concerns or areas needing attention

4. **OVERALL PROGRESS ASSESSMENT**
A brief conclusion about the project's trajectory and current state.

Keep the tone professional yet accessible. Focus on observable facts from the photos. If dates are provided, reference them to create a clear chronological narrative.`;

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
    
    const { projectId, imageDataUrls, projectName, customerName } = validationResult.data;
    console.log("Generating timeline narrative", { 
      projectId,
      imageCount: imageDataUrls.length,
      timestamp: new Date().toISOString() 
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (imageDataUrls.length === 0) {
      throw new Error("No images provided for timeline generation");
    }

    // Build context about the images
    const imageContext = imageDataUrls.map((img, index) => {
      let context = `Photo ${index + 1}`;
      if (img.capturedAt) {
        context += ` (Captured: ${new Date(img.capturedAt).toLocaleDateString()})`;
      }
      if (img.locationName) {
        context += ` - Location: ${img.locationName}`;
      }
      return context;
    }).join('\n');

    // Build messages array with images
    const content: any[] = [];
    
    // Add project context
    let projectContext = 'Project Timeline Analysis Request\n\n';
    if (projectName) projectContext += `Project: ${projectName}\n`;
    if (customerName) projectContext += `Customer: ${customerName}\n`;
    projectContext += `\nPhotos in chronological order:\n${imageContext}\n`;
    projectContext += '\nPlease analyze the following photos and create a comprehensive progress narrative:';
    
    content.push({
      type: "text",
      text: projectContext
    });

    // Add images
    for (const img of imageDataUrls) {
      content.push({
        type: "image_url",
        image_url: { url: img.url }
      });
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content }
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
    console.log("Timeline generated successfully using model:", modelUsed);

    const narrative = data.choices?.[0]?.message?.content;
    if (!narrative) {
      throw new Error("No response from AI");
    }

    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ narrative }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in generate-timeline:", error);
    
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
