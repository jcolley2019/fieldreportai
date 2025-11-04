import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const transcriptionSchema = z.object({
  transcription: z.string()
    .trim()
    .min(1, 'Transcription cannot be empty')
    .max(10000, 'Transcription too long (max 10000 characters)')
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { 
            role: 'system', 
            content: 'Extract project details from the user\'s speech. Return a JSON object with projectName, customerName, jobNumber, and jobDescription fields. If any field is not mentioned, leave it empty. Be smart about extracting the information even if the user speaks naturally.' 
          },
          { role: 'user', content: transcription }
        ],
        max_completion_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      // Sanitized logging - only status code and timestamp
      console.error('OpenAI API error occurred', { 
        status: response.status,
        timestamp: new Date().toISOString() 
      });
      throw new Error('Failed to extract fields from transcription');
    }

    const data = await response.json();
    const extractedData = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Sanitized logging - only error type and timestamp, no user data
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
