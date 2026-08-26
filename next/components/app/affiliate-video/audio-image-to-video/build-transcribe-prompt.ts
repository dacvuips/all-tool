import type { AudioImageToVideoFormState } from "./audio-image-types";

export function buildAudioTranscribePrompt(form: AudioImageToVideoFormState): string {
  const language = form.language || "Vietnamese";
  return `Transcribe the attached audio file completely and accurately WITH precise timing.

Requirements:
- Language: ${language}
- Include all spoken words, narration, and dialogue
- Split into natural phrase/sentence segments (not one giant blob)
- For EACH segment provide:
  - text: the spoken words
  - startTime: start time in seconds from the beginning of the audio (number, e.g. 0, 1.2, 12.5)
  - endTime: end time in seconds (number, must be > startTime)
- Timestamps must be accurate and non-overlapping (or only slightly overlapping), covering the full audio in order
- Do NOT summarize or skip content
- Do NOT add commentary

Output: ONLY valid JSON matching this shape (no markdown fences):
{
  "segments": [
    { "text": "Lời thoại đoạn 1", "startTime": 0, "endTime": 3.5 },
    { "text": "Lời thoại đoạn 2", "startTime": 3.5, "endTime": 8.0 }
  ]
}`;
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
