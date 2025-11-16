import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const { audio } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Processing audio data...');
    const binaryAudio = processBase64Chunks(audio);
    
    // Transcribe audio using Lovable AI
    const formData = new FormData();
    const blob = new Blob([binaryAudio], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Transcribing audio...');
    const transcribeResponse = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: formData,
    });

    if (!transcribeResponse.ok) {
      const errorText = await transcribeResponse.text();
      console.error('Transcription error:', errorText);
      throw new Error(`Transcription failed: ${errorText}`);
    }

    const transcription = await transcribeResponse.json();
    const transcribedText = transcription.text;
    console.log('Transcribed text:', transcribedText);

    // Generate checklist using Lovable AI
    console.log('Generating checklist from transcription...');
    const checklistResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates structured checklists from user input. Extract actionable items and organize them into a clear checklist format. Return the checklist as a JSON array of objects with "text" and "completed" (always false) properties.'
          },
          {
            role: 'user',
            content: `Create a checklist from the following description: "${transcribedText}"`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_checklist",
              description: "Create a structured checklist from the user's description",
              parameters: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "A brief title for the checklist"
                  },
                  items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        text: { type: "string" },
                        completed: { type: "boolean" }
                      },
                      required: ["text", "completed"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["title", "items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_checklist" } }
      }),
    });

    if (!checklistResponse.ok) {
      const errorText = await checklistResponse.text();
      console.error('Checklist generation error:', errorText);
      throw new Error(`Checklist generation failed: ${errorText}`);
    }

    const checklistData = await checklistResponse.json();
    console.log('AI response:', JSON.stringify(checklistData));

    const toolCall = checklistData.choices[0].message.tool_calls[0];
    const checklistResult = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        transcription: transcribedText,
        checklist: checklistResult
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});