import {
  DEFAULT_FLOW2_TEXT_MODEL,
  DEFAULT_FLOW2_THINKING_LEVEL,
  MAX_FLOW2_TEXT_AUDIOS,
  MAX_FLOW2_TEXT_IMAGES,
  type Flow2AudioInput,
  type Flow2ImageInput,
} from "../../api-media/flow2";

export const MAX_PROMPT_CHARS = 80_000;
export const MAX_SYSTEM_INSTRUCTION_CHARS = 20_000;

export type GenerateTextBody = {
  prompt?: string;
  systemInstruction?: string;
  system_instruction?: string;
  model?: string;
  thinkingLevel?: string;
  thinking_level?: string;
  images?: Flow2ImageInput[];
  image_base64s?: Flow2ImageInput[];
  audios?: Flow2AudioInput[];
  audio_base64s?: Flow2AudioInput[];
  jsonMode?: boolean;
  json?: boolean;
  jsonSchema?: Record<string, unknown>;
  schema?: Record<string, unknown>;
};

function asTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

export function collectGenerateTextImageInputs(body: GenerateTextBody): Flow2ImageInput[] {
  const raw = Array.isArray(body.images)
    ? body.images
    : Array.isArray(body.image_base64s)
      ? body.image_base64s
      : [];
  return raw.filter(Boolean).slice(0, MAX_FLOW2_TEXT_IMAGES);
}

export function collectGenerateTextAudioInputs(body: GenerateTextBody): Flow2AudioInput[] {
  const raw = Array.isArray(body.audios)
    ? body.audios
    : Array.isArray(body.audio_base64s)
      ? body.audio_base64s
      : [];
  return raw.filter(Boolean).slice(0, MAX_FLOW2_TEXT_AUDIOS);
}

export function parseGenerateTextParams(body: GenerateTextBody) {
  const prompt = asTrimmed(body.prompt).slice(0, MAX_PROMPT_CHARS);
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt"), { statusCode: 400 });
  }

  const systemInstruction = asTrimmed(body.systemInstruction || body.system_instruction).slice(
    0,
    MAX_SYSTEM_INSTRUCTION_CHARS
  );

  const rawSchema = body.jsonSchema ?? body.schema;
  const jsonSchema =
    rawSchema && typeof rawSchema === "object" && !Array.isArray(rawSchema)
      ? (rawSchema as Record<string, unknown>)
      : undefined;
  const jsonMode = body.jsonMode === true || body.json === true || jsonSchema != null;

  return {
    prompt,
    systemInstruction: systemInstruction || undefined,
    model: asTrimmed(body.model) || DEFAULT_FLOW2_TEXT_MODEL,
    thinkingLevel: asTrimmed(body.thinkingLevel || body.thinking_level) || DEFAULT_FLOW2_THINKING_LEVEL,
    imageInputs: collectGenerateTextImageInputs(body),
    audioInputs: collectGenerateTextAudioInputs(body),
    jsonMode: jsonMode || undefined,
    jsonSchema: jsonSchema || undefined,
  };
}
