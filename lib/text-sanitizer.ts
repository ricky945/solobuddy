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

type SplitChunksOptions = {
  minWords?: number;
  maxWords?: number;
  maxChars?: number;
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

export function splitIntoChunks(text: string, maxCharsOrOptions: number | SplitChunksOptions = 1200): string[] {
  const sanitized = sanitizeTextForTTS(text);

  const options: SplitChunksOptions =
    typeof maxCharsOrOptions === "number" ? { maxChars: maxCharsOrOptions } : maxCharsOrOptions;

  const minWords = options.minWords ?? 200;
  const maxWords = options.maxWords ?? 300;
  const maxChars = options.maxChars ?? 1200;

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

      if (candidate.length <= maxChars && candidateWords <= maxWords) {
        currentChunk = candidate;
        continue;
      }

      const currentWords = countWords(currentChunk);

      if (currentChunk && (currentWords >= minWords || currentChunk.length >= Math.floor(maxChars * 0.75))) {
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

  return chunks;
}
