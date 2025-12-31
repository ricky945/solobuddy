import { corsHeaders, handleCors } from '../_shared/cors.ts';

// Helper function to convert ArrayBuffer to base64 without stack overflow
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // Process in chunks to avoid stack overflow
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { text, voice = 'alloy' } = await req.json();

    console.log(`[generate-tts] Received request, text length: ${text?.length || 0}`);

    if (!text || typeof text !== 'string') {
      console.error('[generate-tts] Invalid text input');
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from Supabase secrets
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    console.log(`[generate-tts] API key configured: ${apiKey ? 'Yes (' + apiKey.substring(0, 10) + '...)' : 'No'}`);
    
    if (!apiKey) {
      console.error('[generate-tts] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OpenAI TTS API has a 4096 character limit per request
    // Client should chunk text appropriately (max 3400 chars per chunk)
    // This is a safety net - if we're truncating here, the client has a bug
    const maxLength = 4000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;
    
    if (text.length > maxLength) {
      console.warn(`[generate-tts] WARNING: Text was truncated from ${text.length} to ${maxLength} chars - client should chunk text properly`);
    }

    console.log(`[generate-tts] Generating audio for ${truncatedText.length} characters, voice: ${voice}`);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'SoloBuddy/1.0 (Supabase Edge Function)',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: truncatedText,
        voice: voice,
        response_format: 'mp3',
      }),
    });

    console.log(`[generate-tts] OpenAI response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-tts] OpenAI TTS error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `TTS generation failed: ${response.status} - ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get audio as ArrayBuffer and convert to base64 using chunked method
    const audioBuffer = await response.arrayBuffer();
    console.log(`[generate-tts] Received audio buffer: ${audioBuffer.byteLength} bytes`);
    
    const base64Audio = arrayBufferToBase64(audioBuffer);
    console.log(`[generate-tts] Base64 encoded, length: ${base64Audio.length}`);

    console.log(`[generate-tts] Success, audio size: ${audioBuffer.byteLength} bytes`);

    return new Response(
      JSON.stringify({ 
        audio: base64Audio,
        format: 'mp3',
        size: audioBuffer.byteLength
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-tts] Error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'TTS generation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

