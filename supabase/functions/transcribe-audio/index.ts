import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.73.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Convert base64 string to Uint8Array safely
function base64ToUint8Array(base64String: string) {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Transcribe-audio function called', { timestamp: new Date().toISOString() });
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured', { timestamp: new Date().toISOString() });
      throw new Error('OpenAI API key not configured');
    }

    const client = new OpenAI({
      apiKey: openAIApiKey,
    });

    // Parse and validate input
    const body = await req.json();
    const { audio } = body;
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Audio data received', { 
      size: `${audio.length} characters (base64)`,
      timestamp: new Date().toISOString() 
    });

    // Convert base64 audio into binary
    console.log('Processing base64 audio data', { timestamp: new Date().toISOString() });
    const binaryAudio = base64ToUint8Array(audio);
    console.log('Binary audio processed', { 
      size: `${binaryAudio.length} bytes`,
      timestamp: new Date().toISOString() 
    });
    
    // Create a File object from the binary data; avoid forcing a specific MIME type
    const blob = new Blob([binaryAudio]);
    const audioFile = new File([blob], 'audio.m4a');

    console.log('Sending to OpenAI API', { timestamp: new Date().toISOString() });
    
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-mini-transcribe',
    });

    console.log('Transcription successful', { timestamp: new Date().toISOString() });

    return new Response(
      JSON.stringify({ text: transcription.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    // Log detailed error information
    console.error('Transcription error occurred', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error?.message,
      response: error?.response?.data,
      timestamp: new Date().toISOString() 
    });
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
