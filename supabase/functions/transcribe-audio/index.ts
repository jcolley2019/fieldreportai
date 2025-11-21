import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.73.1";
import { toFile } from "https://esm.sh/openai@4.73.1/uploads";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { audio, mimeType } = body;
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Audio data received', { 
      base64Length: audio.length,
      estimatedSizeKB: (audio.length * 0.75 / 1024).toFixed(2),
      mimeType: mimeType || 'not provided',
      timestamp: new Date().toISOString() 
    });

    // Decode base64 to binary using Deno's built-in atob
    console.log('Decoding base64 to binary', { timestamp: new Date().toISOString() });
    
    // Use TextEncoder/Decoder for proper binary handling
    const binaryString = atob(audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('Binary audio processed', { 
      byteLength: bytes.length,
      sizeKB: (bytes.length / 1024).toFixed(2),
      timestamp: new Date().toISOString() 
    });
    
    // Determine file extension based on MIME type
    let extension = 'webm';
    if (mimeType?.includes('mp4')) extension = 'mp4';
    else if (mimeType?.includes('mpeg')) extension = 'mp3';
    else if (mimeType?.includes('wav')) extension = 'wav';
    
    // Use OpenAI's toFile helper to create a proper file from binary data
    const audioFile = await toFile(bytes, `recording.${extension}`);
    
    console.log('Audio file created', { 
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
      timestamp: new Date().toISOString() 
    });

    console.log('Sending to OpenAI Whisper API', { timestamp: new Date().toISOString() });
    
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
    const openAiMessage = error?.response?.data?.error?.message;
    const fallbackMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorMessage = openAiMessage || fallbackMessage;

    console.error('Transcription error occurred', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      message: fallbackMessage,
      openAiMessage,
      response: error?.response?.data,
      timestamp: new Date().toISOString() 
    });
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
