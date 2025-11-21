import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.73.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768) {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
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

    // Process audio in chunks
    console.log('Processing base64 audio data', { timestamp: new Date().toISOString() });
    const binaryAudio = processBase64Chunks(audio);
    console.log('Binary audio processed', { 
      size: `${binaryAudio.length} bytes`,
      timestamp: new Date().toISOString() 
    });
    
    // Create a File object from the binary data
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    const audioFile = new File([blob], 'audio.webm', { type: 'audio/webm' });

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
