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
  imageDataUrls: z.array(z.string().max(10_000_000)).max(25).optional(),
  imageCaptions: z.array(z.string().max(2000)).max(25).optional(),
  videoContextLines: z.array(z.string().max(500)).max(20).optional(),
  reportType: reportTypeSchema.optional().default('daily'),
  includedDailyReports: z.array(z.string().max(50000)).max(7).optional(),
  includedWeeklyReports: z.array(z.string().max(100000)).max(5).optional(),
  photoDescriptionMode: z.enum(['voice_only', 'ai_enhanced', 'ai_visual']).optional().default('ai_enhanced'),
});

type ReportType = z.infer<typeof reportTypeSchema>;

// Retry configuration
const PRIMARY_MODEL = "google/gemini-3-flash-preview";
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

const getSystemPrompt = (
  reportType: ReportType,
  includedDailyReports?: string[],
  includedWeeklyReports?: string[],
  photoDescriptionMode?: string
): string => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const baseInstructions = `You are an experienced construction site superintendent writing professional field documentation. Your reports are read by project managers, owners, inspectors, and insurance adjusters. Write in clear, professional language using construction industry terminology. Be specific and factual. Never invent details not provided. If information is missing, omit that field entirely rather than writing "Not specified" or "None reported". Today's date is ${today}.`;

  const photoModeInstructions = photoDescriptionMode === 'voice_only'
    ? `Use ONLY the user's exact spoken description. Do not add any AI interpretation.`
    : photoDescriptionMode === 'ai_visual'
    ? `Analyze the image visually AND incorporate the user's spoken notes into a comprehensive professional description.`
    : `Enhance the user's spoken notes into professional descriptions. Stay true to what the user described — do not add observations they did not mention.`;

  if (reportType === 'field') {
    return `${baseInstructions}

Generate a FIELD REPORT using only the sections for which you have actual information. Omit any section where no relevant data was provided.

FIELD REPORT — ${today}

SITE CONDITIONS:
- Weather: [conditions if mentioned]
- Access: [conditions if mentioned]
- Safety Hazards: [any hazards observed — omit if none]

WORK IN PROGRESS:
- [Specific activity — Location on site — Status]

WORKFORCE & EQUIPMENT:
- Crew: [trades and approximate headcount if mentioned]
- Equipment: [specific equipment names if mentioned]

OBSERVATIONS & DEFICIENCIES:
- [Observation] — Priority: [High/Medium/Low]
[Omit this section entirely if no issues observed]

PHOTO LOG:
Photo [N]: [One professional sentence describing what is documented. ${photoModeInstructions}]

REQUIRED ACTIONS:
- [Action] — Responsible: [Party or TBD]
[Omit if no actions required]`;
  }

  if (reportType === 'daily') {
    return `${baseInstructions}

Generate a DAILY CONSTRUCTION REPORT using only the sections for which you have actual information. Omit any section where no relevant data was provided.

DAILY REPORT — ${today}

WEATHER & SITE CONDITIONS:
[Temperature, precipitation, wind — omit if not mentioned]

WORK COMPLETED:
- [Trade/Activity] — [Location] — [Quantity or scope if mentioned]

MATERIALS RECEIVED:
- [Material] — [Qty] — [Supplier if known]
[Omit if not mentioned]

CREW ON SITE:
- [Trade]: [Headcount]
[Omit if not mentioned]

SUBCONTRACTORS ON SITE:
- [Company/Trade]
[Omit if not mentioned]

DELAYS OR ISSUES:
- [Issue] — Cause: [cause] — Impact: [impact]
[Omit entirely if no delays]

SAFETY:
[Toolbox talks, incidents, near misses — omit if nothing to report]

INSPECTIONS:
[Inspector visits, results — omit if none]

PLAN FOR TOMORROW:
- [Specific planned activity]

PHOTOS:
Photo [N]: [${photoModeInstructions}]
[Omit if no photos provided]`;
  }

  if (reportType === 'weekly') {
    const dailyContext = includedDailyReports?.length
      ? `\n\nSynthesize the following ${includedDailyReports.length} daily report(s) into a cohesive weekly summary. Identify patterns, cumulative progress, and recurring issues.`
      : '';

    return `${baseInstructions}${dailyContext}

Generate a WEEKLY PROGRESS REPORT using only the sections for which you have actual information:

WEEKLY REPORT — Week Ending ${today}

EXECUTIVE SUMMARY:
[2-3 sentences: overall progress, top accomplishment, critical issue if any]

WORK COMPLETED THIS WEEK:
- [Trade/Area]: [What was accomplished, quantities if known]

SCHEDULE STATUS:
[On Track / At Risk / Behind — one-line explanation]
[Omit if no schedule information available]

ISSUES & RESOLUTIONS:
- [Issue]: [Resolution or current status]
[Omit entirely if no issues]

SAFETY THIS WEEK:
- Incidents: [Number or "Zero incidents"]
[Omit if nothing to report]

LOOKAHEAD — NEXT WEEK:
- [Priority 1]
- [Priority 2]
- [Priority 3]

OPEN ITEMS REQUIRING ATTENTION:
- [Item] — Owner: [Party] — Due: [Date if known]
[Omit if no open items]`;
  }

  if (reportType === 'monthly') {
    const weeklyContext = includedWeeklyReports?.length
      ? `\n\nAggregate the following ${includedWeeklyReports.length} weekly report(s) into a comprehensive monthly summary for owner and stakeholder review.`
      : '';

    return `${baseInstructions}${weeklyContext}

Generate a MONTHLY PROGRESS REPORT suitable for owner and stakeholder review:

MONTHLY REPORT — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

EXECUTIVE SUMMARY:
[3-4 sentences for an owner audience: project health, key achievements, budget/schedule status, top risk]

PROJECT HEALTH INDICATORS:
- Schedule: [On Track / At Risk / Behind — brief explanation]
- Budget: [On Budget / Over / Under — omit if no data]
- Safety: [Incident-free / Number of incidents]
- Quality: [No issues / Issues noted]

KEY MILESTONES THIS MONTH:
- [Milestone achieved with date if known]

WORK SUMMARY BY WEEK:
- Week 1: [Brief summary]
- Week 2: [Brief summary]
- Week 3: [Brief summary]
- Week 4: [Brief summary]

CHALLENGES & MITIGATIONS:
- [Challenge]: [Action taken or planned]
[Omit if no challenges]

UPCOMING MILESTONES:
- [Next milestone] — Target: [Date if known]

DECISIONS REQUIRED:
- [Decision needed] — Owner: [Party] — By: [Date if known]
[Omit if none]

RECOMMENDATIONS:
- [Specific actionable recommendation]
[Only include if genuinely warranted]`;
  }

  // Site Survey
  return `${baseInstructions}

Generate a SITE SURVEY REPORT using only the sections for which you have actual information:

SITE SURVEY — ${today}

SITE IDENTIFICATION:
- Location: [Address or description]
- Purpose of Survey: [What is being evaluated]

EXISTING CONDITIONS:
- [Element]: [Condition and relevant dimensions if visible]

ACCESS & LOGISTICS:
- Vehicle Access: [Description]
- Staging Areas: [Potential locations]
- Utilities: [Available services observed]

ENVIRONMENTAL FACTORS:
- Drainage: [Observed patterns]
- Vegetation: [Relevant observations]
- Adjacent Properties: [Relevant context]

MEASUREMENTS:
[Key dimensions if provided — omit if none]

CONCERNS & RISKS:
- [Concern] — Potential Impact: [Description]
[Omit if no concerns identified]

RECOMMENDATIONS:
- [Specific actionable recommendation]

PHOTO LOG:
Photo [N]: [${photoModeInstructions}]
[Omit if no photos provided]`;
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
        JSON.stringify({ error: "Invalid input" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { description, imageDataUrls, imageCaptions, videoContextLines, reportType, includedDailyReports, includedWeeklyReports, photoDescriptionMode } = validationResult.data;
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
        const isPhotoDocType = reportType === 'field' || reportType === 'site_survey';
        let captionInstruction: string;
        
        if (isPhotoDocType && photoDescriptionMode === 'voice_only') {
          captionInstruction = `User's spoken descriptions for each photo:\n${captionList}\n\nUse these EXACT descriptions as-is for each photo in the PHOTO DOCUMENTATION section. Do not modify, enhance, or add to them.`;
        } else if (isPhotoDocType && photoDescriptionMode === 'ai_visual') {
          captionInstruction = `User's spoken descriptions for each photo:\n${captionList}\n\nFor the PHOTO DOCUMENTATION section, analyze each image visually AND incorporate these spoken notes to create comprehensive professional descriptions. You may add relevant visual observations beyond what the user mentioned.`;
        } else {
          captionInstruction = `CRITICAL INSTRUCTION - User's spoken descriptions for each photo:\n${captionList}\n\nYou MUST use ONLY these spoken descriptions when writing about the photos. DO NOT add any visual observations from the images that the user did not mention. If the user says "damaged post" do NOT also mention solar panels, roofing materials, or other objects visible in the photo. Stick strictly to what the user described.`;
        }
        
        content.push({
          type: "text",
          text: captionInstruction
        });
      }
    }

    // Add video context — AI cannot see videos but notes give it written context
    if (videoContextLines && videoContextLines.length > 0) {
      content.push({
        type: "text",
        text: `VIDEO RECORDINGS (${videoContextLines.length} video${videoContextLines.length > 1 ? 's' : ''} captured — not visible to AI, include in report as a "Videos Recorded" section with each voice note):\n${videoContextLines.join('\n')}\n\nFor each video, include a placeholder entry in the report under a "VIDEOS RECORDED" section, listing the video number and the user's voice note. The actual video links will be inserted when the report is saved.`
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

    const systemPrompt = getSystemPrompt(reportType, includedDailyReports, includedWeeklyReports, photoDescriptionMode);

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
