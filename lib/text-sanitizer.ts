export function sanitizeTextForTTS(text: string, maxLength = 1400): string {
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
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~^#=|]/g, '')
    .replace(/[<>{}[\]\\`$%&+=~@]/g, '')
    .replace(/["''""]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/(select|insert|update|delete|drop|create|alter|exec|execute|script|union|declare)/gi, '')
    .replace(/[^a-zA-Z0-9\s.,!?;:()'"\-]/g, '')
    .replace(/([.,!?;:])\1+/g, '$1')
    .replace(/\.{4,}/g, '...')
    .trim();
  
  if (Number.isFinite(maxLength) && maxLength > 0 && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }
  
  return cleaned;
}

type SplitChunksOptions = {
  minChars?: number;
  maxChars?: number;
  minWords?: number;
  maxWords?: number;
};

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function splitLongSentenceByWords(sentence: string, maxChars: number): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];

  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) out.push(current.trim());

    if (word.length > maxChars) {
      out.push(word.substring(0, maxChars));
      current = "";
    } else {
      current = word;
    }
  }

  if (current) out.push(current.trim());
  return out;
}

export function splitIntoChunks(
  text: string,
  maxCharsOrOptions: number | SplitChunksOptions = { minChars: 200, maxChars: 300 },
): string[] {
  const options: SplitChunksOptions =
    typeof maxCharsOrOptions === "number" ? { maxChars: maxCharsOrOptions } : maxCharsOrOptions;

  const minChars = options.minChars ?? 200;
  const maxChars = options.maxChars ?? 300;

  // IMPORTANT: Don't truncate the entire text here - we want to split it into chunks FIRST
  // Each chunk will be sanitized individually when sent to TTS
  // Pass Infinity to sanitize without truncating
  const sanitized = sanitizeTextForTTS(text, Infinity);
  const minWords = options.minWords;
  const maxWords = options.maxWords;

  if (!sanitized) return [];

  const sentences = sanitized.match(/[^.!?]+[.!?]+/g) || [sanitized];

  const chunks: string[] = [];
  let currentChunk = "";

  const pushCurrent = () => {
    const trimmed = currentChunk.trim();
    if (trimmed.length >= 10) chunks.push(trimmed);
    currentChunk = "";
  };

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    const sentenceParts =
      trimmedSentence.length > maxChars
        ? splitLongSentenceByWords(trimmedSentence, maxChars)
        : [trimmedSentence];

    for (const part of sentenceParts) {
      const candidate = currentChunk ? `${currentChunk} ${part}` : part;
      const candidateWords = countWords(candidate);

      const withinCharLimit = candidate.length <= maxChars;
      const withinWordLimit = typeof maxWords === "number" ? candidateWords <= maxWords : true;

      if (withinCharLimit && withinWordLimit) {
        currentChunk = candidate;
        continue;
      }

      const currentWords = countWords(currentChunk);

      const meetsMinChars = currentChunk.length >= minChars;
      const meetsMinWords = typeof minWords === "number" ? currentWords >= minWords : true;

      if (currentChunk && (meetsMinChars || meetsMinWords)) {
        pushCurrent();
        currentChunk = part;
        continue;
      }

      if (!currentChunk) {
        currentChunk = part.substring(0, maxChars);
        pushCurrent();
        continue;
      }

      pushCurrent();
      currentChunk = part;
    }
  }

  if (currentChunk) pushCurrent();

  if (chunks.length === 0 && sanitized.length > 0) return [sanitized.substring(0, maxChars)];

  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1];
    if (last && last.length < Math.floor(minChars * 0.5) && chunks.length > 1) {
      const prev = chunks[chunks.length - 2];
      if (prev && prev.length + 1 + last.length <= maxChars + 40) {
        chunks[chunks.length - 2] = `${prev} ${last}`.trim();
        chunks.pop();
      }
    }
  }

  return chunks;
}
