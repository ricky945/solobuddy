import { corsHeaders, handleCors } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from Supabase secrets
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('[generate-text] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Transform message content for OpenAI format (handle images)
    const transformContent = (content: any): any => {
      if (typeof content === 'string') return content;
      
      if (Array.isArray(content)) {
        return content.map((part: any) => {
          if (part.type === 'text') {
            return { type: 'text', text: part.text };
          }
          if (part.type === 'image' && part.image) {
            const base64 = part.image.startsWith('data:') 
              ? part.image 
              : `data:image/jpeg;base64,${part.image}`;
            return {
              type: 'image_url',
              image_url: { url: base64 }
            };
          }
          if (part.type === 'image_url') return part;
          return part;
        });
      }
      
      return content;
    };

    // Add system message for audio tour generation
    const systemMessage = {
      role: 'system',
      content: `You are an expert audio tour narrator. CRITICAL RULES:
1. Write EXACTLY the word count requested or MORE (if asked for 3000 words, write 3000+ words)
2. Return ONLY plain text narration - NO JSON, NO formatting, NO structure labels
3. Count words as you write - never stop early
4. Include many detailed stories, facts, descriptions, and anecdotes
5. Never summarize or abbreviate`
    };
    
    const openaiMessages = [
      systemMessage,
      ...messages.map((m: any) => ({
        role: m.role || 'user',
        content: transformContent(m.content)
      }))
    ];

    // Check if request contains images for model selection
    const hasImages = messages.some((m: any) => {
      if (Array.isArray(m.content)) {
        return m.content.some((part: any) => part.type === 'image' || part.type === 'image_url');
      }
      return false;
    });

    // Use gpt-4o for better instruction following on word count requirements
    // gpt-4o-mini often generates content that's too short
    const model = 'gpt-4o';
    console.log(`[generate-text] Using model: ${model}, hasImages: ${hasImages}`);

    // Calculate max_tokens based on expected content length
    // For audio tours: 20 min = ~3000 words, 40 min = ~6000 words, 60 min = ~9000 words
    // Each word is roughly 1.3 tokens, plus JSON structure overhead
    // gpt-4o supports up to 16K output tokens
    const maxTokens = 16000;
    
    console.log(`[generate-text] Request max_tokens: ${maxTokens}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'SoloBuddy/1.0 (Supabase Edge Function)',
      },
      body: JSON.stringify({
        model,
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-text] OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const completion = data.choices?.[0]?.message?.content || '';
    const finishReason = data.choices?.[0]?.finish_reason || 'unknown';
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    console.log(`[generate-text] Success!`);
    console.log(`[generate-text] - Response length: ${completion.length} chars`);
    console.log(`[generate-text] - Finish reason: ${finishReason}`);
    console.log(`[generate-text] - Tokens used: ${promptTokens} prompt + ${completionTokens} completion = ${promptTokens + completionTokens} total`);
    
    // Warn if generation was cut short
    if (finishReason === 'length') {
      console.warn(`[generate-text] WARNING: Response was truncated due to max_tokens limit!`);
    }

    return new Response(
      JSON.stringify({ completion }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-text] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});



