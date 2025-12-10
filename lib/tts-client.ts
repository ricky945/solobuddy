export async function generateTTS({
  text,
  voice = "alloy",
  speed = 1.0,
}: {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number;
}): Promise<{ success: boolean; audioData: string; mimeType: string }> {
  console.log("[Client TTS] Generating audio, text length:", text.length);

  try {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    if (!apiKey) {
      console.error("[Client TTS] OpenAI API key not configured");
      throw new Error("OpenAI API key not configured");
    }

    const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: voice,
        speed: speed,
      }),
    });

    console.log("[Client TTS] OpenAI API response status:", ttsResponse.status);

    if (!ttsResponse.ok) {
      let errorText = "Unknown error";
      try {
        const contentType = ttsResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorJson = await ttsResponse.json();
          errorText = JSON.stringify(errorJson);
          console.error("[Client TTS] OpenAI API error response:", errorJson);
        } else {
          errorText = await ttsResponse.text();
        }
      } catch (parseError) {
        console.error("[Client TTS] Error parsing API error:", parseError);
      }
      throw new Error(`TTS API error: ${ttsResponse.status} - ${errorText}`);
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    console.log(
      "[Client TTS] Audio generated successfully, size:",
      audioBuffer.byteLength,
      "bytes"
    );

    const uint8Array = new Uint8Array(audioBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binary);

    return {
      success: true,
      audioData: base64Audio,
      mimeType: "audio/mpeg",
    };
  } catch (error) {
    console.error("[Client TTS] Error:", error);
    throw error;
  }
}
