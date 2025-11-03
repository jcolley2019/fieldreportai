import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { projectName, customerName, jobNumber, jobDescription, reportType } = await req.json();
    
    if (!projectName || !customerName || !jobNumber || !jobDescription || !reportType) {
      throw new Error('Missing required fields');
    }

    console.log('Generating report:', { reportType, projectName });

    const systemPrompt = reportType === 'daily' 
      ? `You are a professional report writer creating daily construction/field reports. Generate a comprehensive daily report that includes:
- Executive Summary
- Work Completed Today
- Materials Used
- Equipment Used
- Personnel on Site
- Safety Observations
- Weather Conditions
- Issues/Delays
- Plans for Tomorrow

Format the report professionally with clear sections and bullet points.`
      : `You are a professional report writer creating detailed field reports. Generate a comprehensive field report that includes:
- Project Overview
- Site Conditions
- Observations
- Work Performed
- Materials and Equipment
- Quality Control Notes
- Safety Compliance
- Recommendations
- Conclusion

Format the report professionally with clear sections and detailed observations.`;

    const userPrompt = `Generate a ${reportType} report for the following project:

Project Name: ${projectName}
Customer: ${customerName}
Job Number: ${jobNumber}
Description: ${jobDescription}

Please create a detailed, professional report based on this information.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const generatedReport = data.choices[0].message.content;

    console.log('Report generated successfully');

    return new Response(
      JSON.stringify({ report: generatedReport }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Report generation error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
