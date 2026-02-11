import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import OpenAI from "https://esm.sh/openai@4.73.1";
import { toFile } from "https://esm.sh/openai@4.73.1/uploads";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema - 25MB max for audio files
const requestSchema = z.object({
  audio: z.string().min(1, "Audio data is required").max(35_000_000, "Audio file is too large (max 25MB)"),
  mimeType: z.string().max(100).optional(),
});

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
    
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error.flatten());
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validationResult.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { audio, mimeType } = validationResult.data;

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
    
    // Determine the content type for the file
    const contentType = mimeType || 'audio/webm';
    
    // Use OpenAI's toFile helper to create a proper file from binary data
    const audioFile = await toFile(bytes, `recording.${extension}`, { type: contentType });
    
    console.log('Audio file created', { 
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
      contentType,
      timestamp: new Date().toISOString() 
    });

    console.log('Sending to OpenAI Whisper API', { timestamp: new Date().toISOString() });
    
    const transcription = await client.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
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
