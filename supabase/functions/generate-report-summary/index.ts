import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const reportTypeSchema = z.enum(['field', 'daily', 'weekly', 'monthly', 'site_survey']);

const requestSchema = z.object({
  description: z.string().max(50000).optional(),
  imageDataUrls: z.array(z.string().max(10_000_000)).max(20).optional(),
  imageCaptions: z.array(z.string().max(2000)).max(20).optional(),
  reportType: reportTypeSchema.optional().default('daily'),
  includedDailyReports: z.array(z.string().max(50000)).max(7).optional(),
  includedWeeklyReports: z.array(z.string().max(100000)).max(5).optional(),
});

type ReportType = z.infer<typeof reportTypeSchema>;

// Retry configuration
const PRIMARY_MODEL = "google/gemini-2.5-flash-lite";
const FALLBACK_MODEL = "google/gemini-2.5-flash";
const RETRY_DELAY_MS = 1000;
const FUNCTION_NAME = "generate-report-summary";

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

const getSystemPrompt = (reportType: ReportType, includedDailyReports?: string[], includedWeeklyReports?: string[]): string => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const baseInstructions = `You are a professional field report assistant. Analyze the provided field notes and images to create a clear, structured report. Today's date is ${today}.`;
  
  // Field Report - Quick jobsite documentation
  if (reportType === 'field') {
    return `${baseInstructions}

Format your response EXACTLY as follows for a FIELD REPORT:

SITE CONDITIONS:
• Weather: [Current weather conditions]
• Ground: [Soil/ground conditions - dry, wet, muddy, etc.]
• Access: [Site access conditions and any restrictions]
• Safety: [Any safety concerns or hazards observed]

WORK OBSERVED:
• [Specific work activity observed]
• [Another activity observed]
• [Add more as needed]

PERSONNEL & EQUIPMENT:
• Workers on site: [Number and trades if visible]
• Equipment in use: [List of equipment/machinery observed]

ISSUES FOUND:
• [Issue or concern 1] - [Severity: Low/Medium/High]
• [Issue or concern 2] - [Severity: Low/Medium/High]
• [Add more as needed, or "No issues observed" if none]

PHOTOS DOCUMENTED:
[Brief description of what the photos capture]

FOLLOW-UP REQUIRED:
• [Action needed and responsible party]
• [Add more as needed, or "None" if not applicable]

Keep the tone professional and concise. Focus on observable facts and field conditions.`;
  }
  
  if (reportType === 'daily') {
    return `${baseInstructions}

Format your response EXACTLY as follows for a DAILY REPORT:

DATE & WEATHER:
[Always include today's date: ${today}. Include weather conditions if mentioned by the user, otherwise state "Weather: Not specified"]

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
  
  if (reportType === 'monthly') {
    const weeklyContext = includedWeeklyReports?.length 
      ? `\n\nYou have been provided with ${includedWeeklyReports.length} weekly report(s) to synthesize. Aggregate this information into a comprehensive monthly overview.`
      : '';
    
    return `${baseInstructions}${weeklyContext}

Format your response EXACTLY as follows for a MONTHLY REPORT:

EXECUTIVE SUMMARY:
[3-4 sentence high-level summary of the month's progress, major achievements, and overall project status]

MONTHLY METRICS:
• Work Days: [Total work days this month]
• Completion: [Overall progress percentage or milestone status]
• Budget Status: [On budget / Over / Under if mentioned]
• Schedule: [On track / Behind / Ahead]

KEY MILESTONES ACHIEVED:
• [Major milestone 1]
• [Major milestone 2]
• [Add more as needed]

PROGRESS SUMMARY BY WEEK:
• Week 1: [Brief summary]
• Week 2: [Brief summary]
• Week 3: [Brief summary]
• Week 4: [Brief summary]

CUMULATIVE ACCOMPLISHMENTS:
• [Significant accomplishment 1]
• [Significant accomplishment 2]
• [Add more as needed]

CHALLENGES & LESSONS LEARNED:
• [Challenge]: [Resolution and lesson learned]
• [Add more as needed]

RESOURCE SUMMARY:
• Total Personnel Hours: [If available]
• Major Materials Consumed: [List]
• Equipment Utilization: [Summary]

SAFETY RECORD:
• Incidents: [Number or "None"]
• Near Misses: [Number or "None"]
• Safety Observations: [Summary]

NEXT MONTH OUTLOOK:
• Key Objectives: [List 3-5 main goals]
• Anticipated Challenges: [List any foreseen issues]
• Resource Needs: [Any additional resources required]

RECOMMENDATIONS:
• [Recommendation 1]
• [Recommendation 2]
• [Add more as needed]

Keep the tone executive and comprehensive. Provide a clear picture of the month's activities and forward-looking insights.`;
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
    
    const { description, imageDataUrls, imageCaptions, reportType, includedDailyReports, includedWeeklyReports } = validationResult.data;
    console.log("Generating report summary", { 
      descriptionLength: description?.length,
      imageCount: imageDataUrls?.length,
      captionCount: imageCaptions?.length,
      reportType,
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
    
    // Add included weekly reports content for monthly reports
    if (reportType === 'monthly' && includedWeeklyReports?.length) {
      content.push({
        type: "text",
        text: `Previous Weekly Reports to summarize:\n\n${includedWeeklyReports.map((report: string, index: number) => `--- Weekly Report ${index + 1} ---\n${report}`).join('\n\n')}`
      });
    }
    
    if (description && description.trim()) {
      content.push({
        type: "text",
        text: `Field Notes: ${description}`
      });
    }

    // Add per-photo voice notes/captions as context
    if (imageCaptions && imageCaptions.length > 0) {
      const captionList = imageCaptions
        .map((caption, i) => caption ? `Photo ${i + 1}: ${caption}` : null)
        .filter(Boolean)
        .join('\n');
      
      if (captionList) {
        content.push({
          type: "text",
          text: `CRITICAL INSTRUCTION - User's spoken descriptions for each photo:\n${captionList}\n\nYou MUST use ONLY these spoken descriptions when writing about the photos. DO NOT add any visual observations from the images that the user did not mention. If the user says "damaged post" do NOT also mention solar panels, roofing materials, or other objects visible in the photo. Stick strictly to what the user described.`
        });
      }
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

    const systemPrompt = getSystemPrompt(reportType, includedDailyReports, includedWeeklyReports);

    const messages = [
      { role: 'system', content: systemPrompt },
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
    console.log("Summary generated successfully using model:", modelUsed, { reportType, timestamp: new Date().toISOString() });

    const summaryText = data.choices?.[0]?.message?.content;
    if (!summaryText) {
      throw new Error("No response from AI");
    }

    await logMetrics({
      modelUsed,
      usedFallback,
      latencyMs: Date.now() - startTime,
      status: 'success',
    });

    return new Response(
      JSON.stringify({ summary: summaryText }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error("Error in generate-report-summary:", error);
    
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
