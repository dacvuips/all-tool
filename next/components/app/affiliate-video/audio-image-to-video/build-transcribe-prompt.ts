import type { AudioImageToVideoFormState } from "./audio-image-types";

export function buildAudioTranscribePrompt(form: AudioImageToVideoFormState): string {
  const language = form.language || "Vietnamese";
  return `Transcribe the attached audio file completely and accurately.

Requirements:
- Language: ${language}
- Include all spoken words, narration, and dialogue
- Preserve natural paragraph breaks if helpful
- Do NOT summarize or skip content
- Do NOT add commentary

Output: return ONLY the full transcript as plain text. No JSON, no markdown, no explanation.`;
}

export function buildImageExtractTextPrompt(form: AudioImageToVideoFormState): string {
  const language = form.language || "Vietnamese";
  return `Analyze the attached image(s) and extract all readable text plus the visual narrative content needed for video scripting.

Requirements:
- Language for output: ${language}
- Include any visible text (OCR)
- Describe key visual story elements that would accompany narration
- Do NOT create scene breakdown yet

Output: plain text only, no JSON, no markdown.`;
}
