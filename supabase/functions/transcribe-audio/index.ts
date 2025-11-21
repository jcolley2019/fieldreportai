import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const audioSchema = z.object({
  audio: z.string()
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid base64 format')
    .max(10485760, 'Audio file too large (max 10MB base64)'),
});

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

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error.message?.includes('429') || error.status === 429;
      const isLastAttempt = attempt === maxRetries - 1;
      
      if (!isRateLimit || isLastAttempt) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`, {
        timestamp: new Date().toISOString()
      });
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries reached');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Transcribe-audio function called', { timestamp: new Date().toISOString() });
    
    // Parse and validate input
    const body = await req.json();
    console.log('Request received, validating input', { timestamp: new Date().toISOString() });
    
    const validatedData = audioSchema.parse(body);
    const { audio } = validatedData;
    
    console.log('Audio data validated', { 
      size: `${audio.length} characters (base64)`,
      timestamp: new Date().toISOString() 
    });
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY not configured', { timestamp: new Date().toISOString() });
      throw new Error('OpenAI API key not configured');
    }

    // Process audio in chunks
    console.log('Processing base64 audio data', { timestamp: new Date().toISOString() });
    const binaryAudio = processBase64Chunks(audio);
    console.log('Binary audio processed', { 
      size: `${binaryAudio.length} bytes`,
      timestamp: new Date().toISOString() 
    });
    
    // Prepare form data
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    console.log('Sending to OpenAI Whisper API', { timestamp: new Date().toISOString() });
    
    // Send to OpenAI with retry logic
    const result = await retryWithBackoff(async () => {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        console.error('OpenAI API error occurred', { 
          status: response.status,
          timestamp: new Date().toISOString() 
        });
        
        // Handle specific error cases
        if (response.status === 429) {
          const error: any = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      return await response.json();
    });

    console.log('Transcription successful', { timestamp: new Date().toISOString() });

    return new Response(
      JSON.stringify({ text: result.text }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      // Sanitized logging for validation errors
      console.error('Input validation failed', { 
        errorCount: error.errors.length,
        timestamp: new Date().toISOString() 
      });
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: error.errors.map(e => e.message).join(', ')
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sanitized logging for general errors
    console.error('Transcription error occurred', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
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
