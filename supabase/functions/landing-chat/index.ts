import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a friendly and helpful AI assistant for Field Report AI, a construction field reporting application. Your name is "Field" and you help potential customers learn about the product.

## About Field Report AI
Field Report AI is a powerful tool that helps construction teams create professional field reports 10x faster using AI. The app captures photos, videos, and voice notes, then instantly turns them into professional reports and structured checklists.

## Key Features
1. **AI Field Report Generator** - Daily reports, progress updates, and safety docs generated instantly from voice notes and media
2. **AI Checklist Creator** - Converts voice notes into structured, actionable tasks with automatic organization
3. **Media Capture** - Photos, videos, and voice notes with auto-transcription and intelligent tagging
4. **Collaboration Tools** - Share links, comments, PDF export, and real-time team updates
5. **Project Workspace** - Organize reports and media by job with secure cloud storage
6. **Smart Task Management** - AI analyzes reports and automatically suggests follow-up tasks, deadlines, and priorities

## How It Works
1. **Capture** - Take photos, videos, or voice notes on-site
2. **Generate** - AI creates professional reports and checklists
3. **Share** - Distribute instantly to your team

## Pricing Plans
- **Free Plan** ($0/month) - 3 reports/month, basic AI features, single user
- **Pro Plan** ($25/month or $240/year - save 20%) - Unlimited reports, advanced AI, priority support, custom templates
- **Team Plan** ($75/month or $720/year - save 20%) - Everything in Pro, up to 10 users, team collaboration, admin dashboard
- **Enterprise** (Custom pricing) - Unlimited users, SSO, API access, custom integrations, dedicated support

## Key Benefits
- 10x faster report creation
- 95% time saved on documentation
- 100% accurate AI transcription
- Works offline - capture media and voice notes offline, reports generate when you reconnect
- Bank-level encryption and SOC 2 Type II compliance
- Export to PDF, Word Doc, or share via link

## FAQs You Can Reference
- AI analyzes voice notes, photos, and videos to extract key information and generates professional reports
- Pro and Enterprise users can customize report templates
- Data is secured with bank-level encryption and SOC 2 Type II compliance
- Works offline - sync when reconnected
- 100% accuracy with clear audio, handles construction terminology
- Export to PDF, Word, or share via link (Enterprise gets API access)

## Guidelines for Responses
- Be friendly, helpful, and concise
- Focus on solving the customer's documentation pain points
- Highlight time savings and efficiency benefits
- If asked about competitors, focus on Field Report AI's strengths without disparaging others
- For complex enterprise needs, suggest they contact sales or book a demo
- Keep responses under 150 words unless more detail is specifically requested
- Use bullet points for lists to improve readability
- If you don't know something specific, suggest they sign up for a free trial or contact support`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [] } = await req.json();

    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    console.log('Processing chat message:', { 
      messageLength: message.length, 
      historyCount: conversationHistory.length,
      timestamp: new Date().toISOString() 
    });

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorStatus = response.status;
      console.error('AI API error', { status: errorStatus, timestamp: new Date().toISOString() });
      
      if (errorStatus === 429) {
        return new Response(
          JSON.stringify({ error: 'Too many requests. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${errorStatus}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that request. Please try again.";

    console.log('Chat response generated', { 
      replyLength: reply.length, 
      timestamp: new Date().toISOString() 
    });

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in landing-chat function', { 
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      timestamp: new Date().toISOString() 
    });
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An error occurred processing your request' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
