/**
 * Shared prompt helpers for video generation handlers.
 * `noText`: when false/absent, append anti-text note.
 * `voiceDisable`: when true, strip [AUDIO]/[DIALOGUE] tags and append silent-video note.
 * `prompt`: top-level ưu tiên hơn `config.prompt`.
 */
export const NO_TEXT_NOTE = `\n Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`;

export const VOICE_DISABLE_NOTE = `\n silent video, no audio, no sound, no voice`;

export type VideoPromptOptions = {
  noText?: boolean;
  configNoText?: boolean;
  voiceDisable?: boolean;
  configVoiceDisable?: boolean;
};

export type VideoPromptPayload = {
  prompt?: string;
  noText?: boolean;
  voiceDisable?: boolean;
  config?: {
    prompt?: string;
    noText?: boolean;
    voiceDisable?: boolean;
    generateAudio?: boolean;
  };
};

/** Resolve a boolean flag from top-level payload or config (default: false). */
function resolvePayloadFlag(primary?: boolean, config?: boolean): boolean {
  return primary ?? config ?? false;
}

/** Resolve prompt: `payload.prompt` ưu tiên, fallback `payload.config.prompt`. */
export function resolvePayloadPrompt(payload: VideoPromptPayload): string {
  return (payload.prompt ?? payload.config?.prompt ?? "").trim();
}

export function getVideoPromptOptionsFromPayload(payload: VideoPromptPayload): VideoPromptOptions {
  return {
    noText: payload.noText,
    configNoText: payload.config?.noText,
    voiceDisable: payload.voiceDisable,
    configVoiceDisable: payload.config?.voiceDisable,
  };
}

/** voiceDisable overrides generateAudio when true. */
export function resolveVideoGenerateAudio(options: {
  voiceDisable?: boolean;
  configVoiceDisable?: boolean;
  generateAudio?: boolean;
}): boolean {
  if (resolvePayloadFlag(options.voiceDisable, options.configVoiceDisable)) {
    return false;
  }
  return options.generateAudio ?? true;
}

/** Remove `[AUDIO]...` / `[DIALOGUE]...` suffix from affiliate/element video prompts. */
function stripVoiceTagsFromPrompt(prompt: string): string {
  const cutPattern = /(?:,\s*)?\[(?:AUDIO|DIALOGUE)\]/i;
  const match = prompt.search(cutPattern);
  if (match === -1) return prompt.trim();
  return prompt.slice(0, match).trim();
}

/**
 * Apply `voiceDisable` and `noText` modifiers to a video prompt.
 * Order: strip voice tags → append voice-disable note → append no-text note.
 */
export function buildVideoPrompt(prompt: string, options?: VideoPromptOptions): string {
  let result = prompt.trim();

  if (resolvePayloadFlag(options?.voiceDisable, options?.configVoiceDisable)) {
    result = `${stripVoiceTagsFromPrompt(result)}${VOICE_DISABLE_NOTE}`;
  }

  if (!resolvePayloadFlag(options?.noText, options?.configNoText)) {
    result += NO_TEXT_NOTE;
  }

  return result.trim();
}

/**
 * Build full video prompt from job payload.
 * @param prepend Optional prefix (e.g. resolved artStyle) joined before scene prompt.
 */
export function buildVideoPromptFromPayload(
  payload: VideoPromptPayload,
  options?: { prepend?: string }
): string {
  const base = [options?.prepend?.trim(), resolvePayloadPrompt(payload)]
    .filter((part) => part)
    .join(" ");
  return buildVideoPrompt(base, getVideoPromptOptionsFromPayload(payload));
}
