export function sanitizeTextForTTS(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\u2000-\u206F\u2E00-\u2E7F]/g, '')
    .replace(/[\uFFF0-\uFFFF]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[<>{}\[\]\\]/g, '')
    .replace(/["''""]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[…]/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}
