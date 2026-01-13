import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const transcriptionSchema = z.object({
  transcription: z.string()
    .trim()
    .min(1, 'Transcription cannot be empty')
    .max(10000, 'Transcription too long (max 10000 characters)')
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1000;

async function callAI(apiKey: string, messages: any[], tools: any[], model: string): Promise<Response> {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "extract_fields" } }
    }),
  });
}

async function callWithRetryAndFallback(
  apiKey: string, 
  messages: any[],
  tools: any[]
): Promise<{ response: Response; modelUsed: string }> {
  // Try primary model
  let response = await callAI(apiKey, messages, tools, PRIMARY_MODEL);
  
  if (response.ok) {
    return { response, modelUsed: PRIMARY_MODEL };
  }
  
  // If rate limited or timeout, retry once after delay
  if (response.status === 429 || response.status === 504 || response.status === 408) {
    console.log(`Primary model ${PRIMARY_MODEL} failed with ${response.status}, retrying after delay...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    
    response = await callAI(apiKey, messages, tools, PRIMARY_MODEL);
    if (response.ok) {
      return { response, modelUsed: PRIMARY_MODEL };
    }
    
    // If still failing, try fallback model
    console.log(`Primary model retry failed, switching to fallback model ${FALLBACK_MODEL}...`);
    response = await callAI(apiKey, messages, tools, FALLBACK_MODEL);
    return { response, modelUsed: FALLBACK_MODEL };
  }
  
  return { response, modelUsed: PRIMARY_MODEL };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validationResult = transcriptionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: validationResult.error.errors 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const { transcription } = validationResult.data;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const messages = [
      { 
        role: 'system', 
        content: 'Extract project details from the user\'s speech. If any field is not mentioned, leave it empty. Be smart about extracting the information even if the user speaks naturally.' 
      },
      { role: 'user', content: transcription }
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "extract_fields",
          description: "Extract project fields from transcription",
          parameters: {
            type: "object",
            properties: {
              projectName: { type: "string", description: "Name of the project" },
              customerName: { type: "string", description: "Name of the customer or client" },
              jobNumber: { type: "string", description: "Job or project number" },
              jobDescription: { type: "string", description: "Description of the job or work" }
            },
            required: ["projectName", "customerName", "jobNumber", "jobDescription"],
            additionalProperties: false
          }
        }
      }
    ];

    const { response, modelUsed } = await callWithRetryAndFallback(LOVABLE_API_KEY, messages, tools);

    if (!response.ok) {
      console.error('AI gateway error occurred', { 
        status: response.status,
        timestamp: new Date().toISOString() 
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
      
      throw new Error('Failed to extract fields from transcription');
    }

    const data = await response.json();
    console.log("AI response received using model:", modelUsed);
    
    // Extract tool call results
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const extractedData = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(extractedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Fallback to empty fields
    return new Response(JSON.stringify({
      projectName: "",
      customerName: "",
      jobNumber: "",
      jobDescription: ""
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in extract-report-fields function', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString() 
    });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
