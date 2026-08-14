/**
 * POST /api/app/film/rewrite-shot-frame-prompt/
 * Viết lại prompt Ảnh Cảnh quay để tránh Google content policy (gpt-4o-mini ưu tiên).
 */
import { GoogleGenAI } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callChatGPTGateway,
  checkRequestLimit,
  DEFAULT_CHATGPT_MODEL,
  incrementRequestCount,
  parseGeminiJsonResponse,
} from "../affiliate-scene/_shared";
import {
  filmCustomerId,
  resolveFilmAiCredentialFromDb,
} from "./_film-ai-credentials";
import {
  FilmRewriteShotFramePromptGeminiSchema,
  FilmRewriteShotFramePromptOpenAIJsonSchema,
  type FilmRewriteShotFramePromptResult,
} from "./rewrite-shot-frame-prompt.schema";

const MAX_PROMPT_CHARS = 12_000;
const MAX_META_CHARS = 4_000;
/** User yêu cầu 4o-mini */
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_LANGUAGE = "Vietnamese";

const SYSTEM_PROMPT = `## ROLE
You rewrite film storyboard IMAGE PROMPTS so Google image models accept them (content policy safe), while keeping the same cinematic intent.

## GOAL
Given the current image prompt + optional metadata (scene title, character/prop/location names, error message), produce ONE rewritten prompt that:
- Avoids sexual, explicit, violent gore, underage, hate, real-person deepfake, and other typical Google generative content policy triggers.
- Softens sensitive actions into implied / cinematic / PG-13 visual language without inventing a totally different scene.
- May anonymize people with placeholder names ONLY in this style (user convention):
  - "Charter 1", "Charter 2", "Charter 3"... by order of appearance
  - Or "Charter Nam" / "Charter Nữ" when gender is clear
  - Props → "Prop 1", "Prop 2"...; locations → "Location 1"... when names might trigger policy
- Keep shot size, camera angle, atmosphere, composition, lighting, art direction.
- Do NOT add titles, markdown, JSON outside the schema, or commentary inside rewrittenPrompt.
- rewrittenPrompt must be a complete standalone image prompt (not a diff).
- changesSummary: short bullet-style summary in the requested language.

## OUTPUT
Return ONLY JSON matching the schema.`;

type AiProvider = "gateway" | "openai" | "gemini";

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function buildShotImagePromptFromFields(params: {
  prompt: string;
  visualDescription: string;
  atmosphere: string;
  action: string;
  shotSize: string;
  cameraAngle: string;
  summary: string;
  storyboardImagePrompt: string;
}): string {
  const stored = asString(params.prompt);
  if (stored) return stored;
  const parts: string[] = [];
  if (params.shotSize) parts.push(`Cỡ cảnh: ${params.shotSize}`);
  if (params.cameraAngle) parts.push(`Góc máy: ${params.cameraAngle}`);
  if (params.visualDescription) parts.push(`Hình ảnh cảnh quay: ${params.visualDescription}`);
  if (params.atmosphere) parts.push(`Không khí cảnh: ${params.atmosphere}`);
  if (params.action) parts.push(`Hành động nhân vật: ${params.action}`);
  if (params.storyboardImagePrompt) parts.push(params.storyboardImagePrompt);
  if (parts.length) return parts.join("\n\n");
  return params.summary;
}

function buildUserPrompt(params: {
  language: string;
  prompt: string;
  errorMessage: string;
  sceneTitle: string;
  characterNames: string[];
  propNames: string[];
  locationNames: string[];
}): string {
  return [
    "## TASK",
    "Rewrite the image prompt so Google image generation will accept it.",
    `Write changesSummary in ${params.language}.`,
    "rewrittenPrompt may stay in the same language as the original prompt (prefer keeping original language).",
    "",
    "## ORIGINAL IMAGE PROMPT",
    params.prompt,
    "",
    "## GENERATION ERROR (if any)",
    params.errorMessage || "(none)",
    "",
    "## SCENE META",
    `- Title: ${params.sceneTitle || "(none)"}`,
    `- Characters (replace with Charter N / Charter Nam / Charter Nữ): ${
      params.characterNames.length ? params.characterNames.join(", ") : "(none)"
    }`,
    `- Props: ${params.propNames.length ? params.propNames.join(", ") : "(none)"}`,
    `- Locations: ${
      params.locationNames.length ? params.locationNames.join(", ") : "(none)"
    }`,
    "",
    "## OUTPUT",
    'JSON only: { "rewrittenPrompt": "...", "changesSummary": "..." }',
  ].join("\n");
}

async function callOpenAiJson(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
}): Promise<{ text: string; model: string }> {
  const model = OPENAI_MODEL;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: "system", content: params.systemInstruction },
        { role: "user", content: params.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "film_rewrite_shot_frame_prompt",
          strict: true,
          schema: FilmRewriteShotFramePromptOpenAIJsonSchema,
        },
      },
    }),
  });
  const bodyText = await resp.text().catch(() => "");
  let json: any = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }
  if (!resp.ok) {
    const msg = String(json?.error?.message || bodyText.slice(0, 200) || "");
    if (resp.status === 400 && /response_format|json_schema|strict/i.test(msg)) {
      return callOpenAiFallback(params);
    }
    const err: any = new Error(msg || `OpenAI HTTP ${resp.status}`);
    err.statusCode = resp.status === 401 || resp.status === 403 ? resp.status : 502;
    throw err;
  }
  const text = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    const err: any = new Error("OpenAI không trả về prompt đã viết lại");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

async function callOpenAiFallback(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
}): Promise<{ text: string; model: string }> {
  const model = OPENAI_MODEL;
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: [
            params.systemInstruction,
            "",
            "Output MUST match this JSON Schema:",
            JSON.stringify(FilmRewriteShotFramePromptOpenAIJsonSchema),
          ].join("\n"),
        },
        { role: "user", content: params.userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  const bodyText = await resp.text().catch(() => "");
  let json: any = null;
  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }
  if (!resp.ok) {
    const err: any = new Error(
      json?.error?.message || bodyText.slice(0, 200) || `OpenAI HTTP ${resp.status}`
    );
    err.statusCode = resp.status === 401 || resp.status === 403 ? resp.status : 502;
    throw err;
  }
  const text = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    const err: any = new Error("OpenAI không trả về prompt đã viết lại");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

async function callGeminiJson(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
}): Promise<{ text: string; model: string }> {
  const model = GEMINI_MODEL;
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: FilmRewriteShotFramePromptGeminiSchema,
    },
  });
  const text = String((response as any)?.text || "").trim();
  if (!text) {
    const err: any = new Error("Gemini không trả về prompt đã viết lại");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

export default [
  {
    method: "post",
    path: "/api/app/film/rewrite-shot-frame-prompt/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          visualDescription?: string;
          atmosphere?: string;
          action?: string;
          shotSize?: string;
          cameraAngle?: string;
          summary?: string;
          storyboardImagePrompt?: string;
          errorMessage?: string;
          sceneTitle?: string;
          characterNames?: string[];
          propNames?: string[];
          locationNames?: string[];
          language?: string;
          provider?: string;
        };

        const prompt = buildShotImagePromptFromFields({
          prompt: asString(body?.prompt),
          visualDescription: asString(body?.visualDescription),
          atmosphere: asString(body?.atmosphere),
          action: asString(body?.action),
          shotSize: asString(body?.shotSize),
          cameraAngle: asString(body?.cameraAngle),
          summary: asString(body?.summary),
          storyboardImagePrompt: asString(body?.storyboardImagePrompt),
        }).slice(0, MAX_PROMPT_CHARS);
        if (!prompt) {
          return res.status(400).json({ message: "Thiếu field ảnh phân cảnh để viết lại prompt" });
        }

        const errorMessage = asString(body?.errorMessage).slice(0, MAX_META_CHARS);
        const sceneTitle = asString(body?.sceneTitle).slice(0, 500);
        const characterNames = Array.isArray(body?.characterNames)
          ? body.characterNames.map(asString).filter(Boolean).slice(0, 20)
          : [];
        const propNames = Array.isArray(body?.propNames)
          ? body.propNames.map(asString).filter(Boolean).slice(0, 20)
          : [];
        const locationNames = Array.isArray(body?.locationNames)
          ? body.locationNames.map(asString).filter(Boolean).slice(0, 10)
          : [];
        const language = asString(body?.language) || DEFAULT_LANGUAGE;

        const cred = await resolveFilmAiCredentialFromDb(
          filmCustomerId(context),
          body?.provider || "openai"
        );
        await checkRequestLimit(context.id);

        const userPrompt = buildUserPrompt({
          language,
          prompt,
          errorMessage,
          sceneTitle,
          characterNames,
          propNames,
          locationNames,
        });

        let rawText = "";
        let model = "";
        let provider: AiProvider = cred.provider;

        if (cred.provider === "gateway") {
          model = cred.model || DEFAULT_CHATGPT_MODEL;
          rawText = await callChatGPTGateway({
            text: ["## SYSTEM", SYSTEM_PROMPT, "", userPrompt].join("\n"),
            label: "film-rewrite-shot-frame-prompt",
            model,
            temperature: 0.4,
            baseUrl: cred.endpoint,
            apiKey: cred.apiKey,
            jsonSchema:
              FilmRewriteShotFramePromptOpenAIJsonSchema as unknown as Record<
                string,
                unknown
              >,
            jsonSchemaName: "film_rewrite_shot_frame_prompt",
          });
        } else if (cred.provider === "gemini") {
          const out = await callGeminiJson({
            apiKey: cred.apiKey,
            systemInstruction: SYSTEM_PROMPT,
            userPrompt,
          });
          rawText = out.text;
          model = out.model;
        } else {
          const out = await callOpenAiJson({
            apiKey: cred.apiKey,
            systemInstruction: SYSTEM_PROMPT,
            userPrompt,
          });
          rawText = out.text;
          model = out.model;
          provider = "openai";
        }

        const parsed = parseGeminiJsonResponse(rawText) as Record<string, unknown> | null;
        const rewrittenPrompt = asString(parsed?.rewrittenPrompt);
        const changesSummary = asString(parsed?.changesSummary);
        if (!rewrittenPrompt) {
          const err: any = new Error("AI không trả về prompt đã viết lại");
          err.statusCode = 502;
          throw err;
        }

        const data: FilmRewriteShotFramePromptResult = {
          rewrittenPrompt,
          changesSummary: changesSummary || "Đã làm dịu prompt để tránh content policy.",
        };
        await incrementRequestCount(context.id);

        res.json({
          success: true,
          data: {
            ...data,
            provider,
            model,
            language,
          },
        });
      } catch (err: any) {
        logger.error(`[film-rewrite-shot-frame-prompt] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
