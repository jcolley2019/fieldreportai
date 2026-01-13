import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const reportTypeSchema = z.enum(['daily', 'weekly', 'site_survey']);

const requestSchema = z.object({
  description: z.string().max(50000).optional(),
  imageDataUrls: z.array(z.string().max(10_000_000)).max(20).optional(), // Max 20 images
  reportType: reportTypeSchema.optional().default('daily'),
  includedDailyReports: z.array(z.string().max(50000)).max(7).optional(), // Max 7 daily reports for weekly
});

type ReportType = z.infer<typeof reportTypeSchema>;

const getSystemPrompt = (reportType: ReportType, includedDailyReports?: string[]): string => {
  const baseInstructions = "You are a professional field report assistant. Analyze the provided field notes and images to create a clear, structured report.";
  
  if (reportType === 'daily') {
    return `${baseInstructions}

Format your response EXACTLY as follows for a DAILY REPORT:

DATE & WEATHER:
[Date and weather conditions if mentioned, otherwise state "Not specified"]

WORK COMPLETED TODAY:
• [Specific task or activity completed]
• [Another task completed]
• [Add more as needed]

MATERIALS USED:
• [Material and quantity if mentioned]
• [Add more as needed, or "None specified" if not mentioned]

PERSONNEL ON SITE:
[Number and roles if mentioned, otherwise "Not specified"]

ISSUES/DELAYS:
• [Any problems encountered]
• [Add more as needed, or "None reported" if no issues]

TOMORROW'S PLAN:
• [Planned activities for next day]
• [Add more as needed]

NOTES:
[Any additional observations or comments]

Keep the tone professional and concise. Focus on observable facts and specific details.`;
  }
  
  if (reportType === 'weekly') {
    const dailyContext = includedDailyReports?.length 
      ? `\n\nYou have been provided with ${includedDailyReports.length} daily report(s) to summarize. Synthesize this information into a cohesive weekly overview.`
      : '';
    
    return `${baseInstructions}${dailyContext}

Format your response EXACTLY as follows for a WEEKLY REPORT:

WEEK OVERVIEW:
[2-3 sentence summary of the week's progress and overall status]

KEY ACCOMPLISHMENTS:
• [Major milestone or achievement 1]
• [Major milestone or achievement 2]
• [Add more as needed]

PROGRESS BY AREA:
[Break down progress by work area or phase]
• Area 1: [Status and progress]
• Area 2: [Status and progress]
• [Add more as needed]

CHALLENGES & RESOLUTIONS:
• [Challenge faced]: [How it was resolved or current status]
• [Add more as needed, or "No significant challenges" if none]

RESOURCE UTILIZATION:
• Personnel: [Summary of workforce]
• Materials: [Summary of materials used]
• Equipment: [Summary of equipment if mentioned]

SCHEDULE STATUS:
[On track / Behind / Ahead] - [Brief explanation]

NEXT WEEK'S PRIORITIES:
1. [Priority task 1]
2. [Priority task 2]
3. [Add more as needed]

SAFETY & COMPLIANCE:
[Any safety incidents or compliance notes, or "No incidents reported"]

Keep the tone professional and comprehensive. Provide a clear picture of the week's activities.`;
  }
  
  // Site Survey
  return `${baseInstructions}

Format your response EXACTLY as follows for a SITE SURVEY:

SITE INFORMATION:
• Location: [Site location/address if mentioned]
• Date of Survey: [Date if mentioned]
• Surveyor: [Name if mentioned]

SITE CONDITIONS:
• Terrain: [Description of ground conditions, slope, etc.]
• Access: [Description of site access points and conditions]
• Utilities: [Available utilities or infrastructure]
• Existing Structures: [Any existing buildings or structures]

ENVIRONMENTAL OBSERVATIONS:
• Vegetation: [Description of plant life, trees, etc.]
• Drainage: [Water flow, drainage patterns]
• Soil Conditions: [Visible soil characteristics]
• Weather Impact: [Signs of weather-related issues]

MEASUREMENTS & DIMENSIONS:
[Key measurements if provided, or "See attached photos for reference"]

POTENTIAL CONCERNS:
• [Concern 1 and potential impact]
• [Concern 2 and potential impact]
• [Add more as needed, or "No significant concerns identified"]

RECOMMENDATIONS:
• [Recommendation 1]
• [Recommendation 2]
• [Add more as needed]

REQUIRED FOLLOW-UP:
• [Follow-up action needed]
• [Add more as needed]

PHOTO DOCUMENTATION:
[Brief description of what the photos capture]

Keep the tone professional and thorough. Document all relevant site characteristics.`;
};

serve(async (req) => {
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
    
    const { description, imageDataUrls, reportType, includedDailyReports } = validationResult.data;
    console.log("Generating report summary", { 
      descriptionLength: description?.length,
      imageCount: imageDataUrls?.length,
      reportType,
      includedDailyReportsCount: includedDailyReports?.length,
      timestamp: new Date().toISOString() 
    });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build messages array with text and images
    const content: any[] = [];
    
    // Add included daily reports content for weekly reports
    if (reportType === 'weekly' && includedDailyReports?.length) {
      content.push({
        type: "text",
        text: `Previous Daily Reports to summarize:\n\n${includedDailyReports.map((report: string, index: number) => `--- Daily Report ${index + 1} ---\n${report}`).join('\n\n')}`
      });
    }
    
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

    const systemPrompt = getSystemPrompt(reportType, includedDailyReports);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content }
        ],
      }),
    });

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
    console.log("Summary generated successfully", { reportType, timestamp: new Date().toISOString() });

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
