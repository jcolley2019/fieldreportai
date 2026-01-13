import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const requestSchema = z.object({
  images: z.array(z.string().max(10_000_000)).max(20).optional(),
  description: z.string().max(5000).optional(),
});

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-pro";
const RETRY_DELAY_MS = 1000;

async function callAI(apiKey: string, messages: any[], tools: any[], model: string): Promise<Response> {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: { type: "function", function: { name: "create_checklist" } }
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
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { images, description } = validationResult.data;
    console.log("Generating checklist with", images?.length || 0, "images and description:", description?.substring(0, 100));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build the content array with text and images
    const content: any[] = [
      {
        type: "text",
        text: `Analyze the provided images and description to create a detailed, actionable checklist. 
        
Description: ${description || "No description provided"}

Create a checklist with specific, actionable tasks organized by priority and category.
Ensure tasks are relevant to construction/field work and based on what you see in the images and the description provided.`
      }
    ];

    // Add images if provided
    if (images && images.length > 0) {
      for (const imageData of images) {
        // Remove data URL prefix if present
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        content.push({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${base64Data}`
          }
        });
      }
    }

    console.log("Calling AI gateway with", content.length, "content items");

    const messages = [
      {
        role: "user",
        content: content
      }
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "create_checklist",
          description: "Create a structured checklist with title and items",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string", description: "A clear, descriptive title for the checklist" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "Clear, actionable task description" },
                    priority: { type: "string", enum: ["high", "medium", "low"], description: "Task priority level" },
                    category: { type: "string", description: "Category like Safety, Equipment, Documentation, Quality Control" },
                    completed: { type: "boolean", description: "Whether the task is completed (default false)" }
                  },
                  required: ["text", "priority", "category"],
                  additionalProperties: false
                }
              }
            },
            required: ["title", "items"],
            additionalProperties: false
          }
        }
      }
    ];

    const { response, modelUsed } = await callWithRetryAndFallback(LOVABLE_API_KEY, messages, tools);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
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

    // Extract tool call results
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const checklist = JSON.parse(toolCall.function.arguments);
      // Ensure completed is false for all items
      if (checklist.items) {
        checklist.items = checklist.items.map((item: any) => ({
          ...item,
          completed: false
        }));
      }
      console.log("Successfully parsed checklist with", checklist.items?.length || 0, "items");
      return new Response(
        JSON.stringify({ checklist }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fallback if no tool call
    throw new Error("Failed to generate checklist");
  } catch (error) {
    console.error("Error in generate-checklist:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
