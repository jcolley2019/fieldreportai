import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { images, description } = await req.json();
    console.log("Generating checklist with", images?.length || 0, "images and description:", description?.substring(0, 100));

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    // Build the content array with text and images
    const content: any[] = [
      {
        type: "text",
        text: `Analyze the provided images and description to create a detailed, actionable checklist. 
        
Description: ${description || "No description provided"}

Create a checklist with the following structure:
- Title: A clear, descriptive title for the checklist
- Items: Array of checklist items, each with:
  - text: Clear, actionable task description
  - priority: "high", "medium", or "low"
  - category: The category this task belongs to (e.g., "Safety", "Equipment", "Documentation", "Quality Control")
  - completed: false (default)

Ensure tasks are:
1. Specific and actionable
2. Organized by priority and category
3. Relevant to construction/field work
4. Based on what you see in the images and the description provided

Return ONLY valid JSON with this exact structure:
{
  "title": "string",
  "items": [
    {
      "text": "string",
      "priority": "high" | "medium" | "low",
      "category": "string",
      "completed": false
    }
  ]
}`
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

    console.log("Calling OpenAI with", content.length, "content items");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: content
          }
        ],
        max_completion_tokens: 2000,
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
    console.log("OpenAI response received");

    const aiResponse = data.choices?.[0]?.message?.content;
    if (!aiResponse) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response from AI
    let checklist;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/) || 
                       aiResponse.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : aiResponse;
      checklist = JSON.parse(jsonString.trim());
      console.log("Successfully parsed checklist with", checklist.items?.length || 0, "items");
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError, "Response:", aiResponse);
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(
      JSON.stringify({ checklist }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
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
