export function sanitizeTextForTTS(text: string): string {
  if (!text) return '';
  
  let cleaned = text
    .replace(/https?:\/\/[^\s]+/gi, '')
    .replace(/www\.[^\s]+/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, '')
    .replace(/[\uFFF0-\uFFFF]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[<>{}[\]\\|`$%&*+=~^#@]/g, '')
    .replace(/["''""]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/(select|insert|update|delete|drop|create|alter|exec|execute|script|union|declare)/gi, '')
    .replace(/[^a-zA-Z0-9\s.,!?;:()'"\-]/g, '')
    .replace(/([.,!?;:])\1+/g, '$1')
    .replace(/\.{4,}/g, '...')
    .trim();
  
  if (cleaned.length > 1400) {
    cleaned = cleaned.substring(0, 1400);
  }
  
  return cleaned;
}

export function splitIntoChunks(text: string, maxChars: number = 1200): string[] {
  const sanitized = sanitizeTextForTTS(text);
  
  if (sanitized.length <= maxChars) {
    return [sanitized];
  }
  
  const chunks: string[] = [];
  const sentences = sanitized.match(/[^.!?]+[.!?]+/g) || [sanitized];
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    
    if (!trimmedSentence) continue;
    
    if ((currentChunk + ' ' + trimmedSentence).length <= maxChars) {
      currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      if (trimmedSentence.length > maxChars) {
        const words = trimmedSentence.split(/\s+/);
        let wordChunk = '';
        
        for (const word of words) {
          if ((wordChunk + ' ' + word).length <= maxChars) {
            wordChunk += (wordChunk ? ' ' : '') + word;
          } else {
            if (wordChunk) chunks.push(wordChunk.trim());
            wordChunk = word.length > maxChars ? word.substring(0, maxChars) : word;
          }
        }
        if (wordChunk) currentChunk = wordChunk;
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length >= 10);
}
