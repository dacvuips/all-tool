/**
 * Schema JSON — rewrite prompt Ảnh Cảnh quay để tránh content policy Google.
 */
import { Type } from "@google/genai";

export const FilmRewriteShotFramePromptOpenAIJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    rewrittenPrompt: {
      type: "string" as const,
      description:
        "Full image generation prompt rewritten to avoid Google content policy violations",
    },
    changesSummary: {
      type: "string" as const,
      description: "Short list of what changed (language of user request)",
    },
  },
  required: ["rewrittenPrompt", "changesSummary"] as const,
};

export const FilmRewriteShotFramePromptGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    rewrittenPrompt: {
      type: Type.STRING,
      description:
        "Full image generation prompt rewritten to avoid Google content policy violations",
    },
    changesSummary: {
      type: Type.STRING,
      description: "Short list of what changed",
    },
  },
  required: ["rewrittenPrompt", "changesSummary"],
};

export type FilmRewriteShotFramePromptResult = {
  rewrittenPrompt: string;
  changesSummary: string;
};
