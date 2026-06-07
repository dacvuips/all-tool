/**
 * Shared prompt helpers for video generation handlers.
 * `noText` semantics match generation-element-image: when false/absent, append anti-text note.
 * `voiceDisable`: when true, strip [AUDIO]/[DIALOGUE] tags and append silent-video note.
 */
export const NO_TEXT_NOTE = `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export const VOICE_DISABLE_NOTE = `\nIMPORTANT: Do not generate any speech, dialogue, voiceover, narration, or spoken audio. The video must have no human voice — motion only, ambient sound at most.`;

export type VideoPromptOptions = {
  noText?: boolean;
  configNoText?: boolean;
  voiceDisable?: boolean;
  configVoiceDisable?: boolean;
};

export type VideoPromptPayload = {
  noText?: boolean;
  voiceDisable?: boolean;
  config?: {
    noText?: boolean;
    voiceDisable?: boolean;
    generateAudio?: boolean;
  };
};

export function getVideoPromptOptionsFromPayload(
  payload: VideoPromptPayload
): VideoPromptOptions {
  return {
    noText: payload.noText,
    configNoText: payload.config?.noText,
    voiceDisable: payload.voiceDisable,
    configVoiceDisable: payload.config?.voiceDisable,
  };
}

export function resolveVideoNoText(
  noText?: boolean,
  configNoText?: boolean
): boolean {
  return noText ?? configNoText ?? false;
}

export function resolveVideoVoiceDisable(
  voiceDisable?: boolean,
  configVoiceDisable?: boolean
): boolean {
  return voiceDisable ?? configVoiceDisable ?? false;
}

/** voiceDisable overrides generateAudio when true. */
export function resolveVideoGenerateAudio(options: {
  voiceDisable?: boolean;
  configVoiceDisable?: boolean;
  generateAudio?: boolean;
}): boolean {
  if (resolveVideoVoiceDisable(options.voiceDisable, options.configVoiceDisable)) {
    return false;
  }
  return options.generateAudio ?? true;
}

/** Remove `, [AUDIO]...` / `, [DIALOGUE]...` suffix from affiliate/element video prompts. */
export function stripVoiceTagsFromPrompt(prompt: string): string {
  const cutPattern = /,\s*\[(?:AUDIO|DIALOGUE)\]/i;
  const match = prompt.search(cutPattern);
  if (match === -1) return prompt.trim();
  return prompt.slice(0, match).trim();
}

export function applyVoiceDisableToPrompt(
  prompt: string,
  voiceDisable?: boolean,
  configVoiceDisable?: boolean
): string {
  if (!resolveVideoVoiceDisable(voiceDisable, configVoiceDisable)) {
    return prompt;
  }
  const stripped = stripVoiceTagsFromPrompt(prompt);
  return `${stripped}${VOICE_DISABLE_NOTE}`.trim();
}

export function appendNoTextNote(
  prompt: string,
  noText?: boolean,
  configNoText?: boolean
): string {
  const resolvedNoText = resolveVideoNoText(noText, configNoText);
  const noTextStr = !resolvedNoText ? NO_TEXT_NOTE : "";
  return `${prompt}${noTextStr}`.trim();
}

export function buildVideoPrompt(prompt: string, options?: VideoPromptOptions): string {
  const withVoice = applyVoiceDisableToPrompt(
    prompt,
    options?.voiceDisable,
    options?.configVoiceDisable
  );
  return appendNoTextNote(withVoice, options?.noText, options?.configNoText);
}
