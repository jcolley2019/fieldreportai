import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { description, imageDataUrls } = await req.json();
    console.log("Generating report summary", { 
      descriptionLength: description?.length,
      imageCount: imageDataUrls?.length,
      timestamp: new Date().toISOString() 
    });

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build messages array with text and images
    const content: any[] = [];
    
    if (description && description.trim()) {
      content.push({
        type: "text",
        text: `Field Notes: ${description}`
      });
    }

    if (imageDataUrls && imageDataUrls.length > 0) {
      for (const dataUrl of imageDataUrls) {
        content.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }
    }

    if (content.length === 0) {
      throw new Error("No content provided for summary generation");
    }

    const systemPrompt = `You are a professional field report assistant. Analyze the provided field notes and images to create a clear, structured report.

Format your response EXACTLY as follows:

SUMMARY:
[2-3 sentence overview of the field observations]

KEY POINTS:
• [Main observation 1]
• [Main observation 2]
• [Main observation 3]
• [Add more as needed]

ACTION ITEMS:
• [Action item 1]
• [Action item 2]
• [Add more as needed]

Keep the tone professional and concise. Focus on observable facts and actionable insights.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      
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
      
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log("Summary generated successfully", { timestamp: new Date().toISOString() });

    const summaryText = data.choices?.[0]?.message?.content;
    if (!summaryText) {
      throw new Error("No response from AI");
    }

    return new Response(
      JSON.stringify({ summary: summaryText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in generate-report-summary:", error);
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