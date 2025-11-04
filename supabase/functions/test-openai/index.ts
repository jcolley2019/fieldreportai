import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Testing OpenAI API connection', { timestamp: new Date().toISOString() });

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "API key is working!" if you can read this.' }
        ],
        max_completion_tokens: 50,
      }),
    });

    if (!response.ok) {
      // Sanitized logging - only status code and timestamp, no error details
      console.error('OpenAI API error occurred', { 
        status: response.status,
        timestamp: new Date().toISOString() 
      });
      return new Response(JSON.stringify({ 
        success: false, 
        error: `OpenAI API error: ${response.status}`
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Success logging - no sensitive response content
    console.log('OpenAI API test successful', { 
      timestamp: new Date().toISOString(),
      model: data.model 
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: data.choices[0].message.content,
      model: data.model,
      usage: data.usage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    // Sanitized logging - only error type and timestamp
    console.error('Error in test-openai function', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString() 
    });
    return new Response(JSON.stringify({
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
