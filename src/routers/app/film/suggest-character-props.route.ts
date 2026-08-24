/**
 * POST /api/app/film/suggest-character-props/
 * Gợi ý đúng 10 vật phẩm / phụ kiện trên người 1 nhân vật (customer AI keys).
 */
import { GoogleGenAI } from "@google/genai";
import { Request, Response } from "express";
import logger from "../../../helpers/logger";
import {
  callChatGPTGateway,
  checkRequestLimit,
  DEFAULT_CHATGPT_MODEL,
  incrementRequestCount,
  parseGeminiJsonResponse,
} from "../affiliate-scene/_shared";
import { authFilmFeature } from "./_film-access";
import {
  filmCustomerId,
  resolveFilmAiCredentialFromDb,
} from "./_film-ai-credentials";
import {
  FilmSuggestCharacterPropsGeminiSchema,
  FilmSuggestCharacterPropsOpenAIJsonSchema,
  type FilmSuggestCharacterPropItem,
  type FilmSuggestCharacterPropsResult,
} from "./suggest-character-props.schema";

const MAX_CONTENT_CHARS = 40_000;
/** OpenAI Chat Completions — model OpenAI thật (không dùng id Gateway `gpt-5-5`). */
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_LANGUAGE = "Vietnamese";
const TARGET_PROP_COUNT = 10;

const SYSTEM_PROMPT = `## ROLE
You are a film prop designer specializing in on-character accessories, wearable items, and personal gear that appear on or with a character in a short film production.

## GOAL
Given character profile + film project title + original story content, invent exactly ${TARGET_PROP_COUNT} props this character would wear, carry, or keep on their body.

## OUTPUT CONSTRAINTS
- Return ONLY a single JSON object matching the schema. No markdown, no code fences, no commentary.
- Exactly ${TARGET_PROP_COUNT} items in "props".
- Each item: "name" (short, 2–8 words) + "description" (1–3 vivid sentences: material, color, wear, how worn/held).
- Follow the requested output language for name and description.

## DESIGN RULES
- On-character only: jewelry, bags, belts, personal weapons, glasses, scarves, keys, amulets, gadgets, signature accessories.
- Make items distinctive to personality / status / story — avoid blank generics.
- Avoid full outfits and location/set pieces.
- Names unique within the list.`;

type AiProvider = "gateway" | "openai" | "gemini";

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function buildUserPrompt(params: {
  projectName: string;
  originalContent: string;
  characterName: string;
  characterRole: string;
  characterDescription: string;
  clothingAccessories: string;
  language: string;
}): string {
  return [
    "## TASK",
    `Suggest exactly ${TARGET_PROP_COUNT} on-character props/accessories for this character.`,
    `Write name + description in ${params.language}.`,
    "",
    "## FILM PROJECT",
    params.projectName || "(untitled)",
    "",
    "## CHARACTER",
    `- Name: ${params.characterName || "(unnamed)"}`,
    `- Role: ${params.characterRole || "supporting"}`,
    `- Description: ${params.characterDescription || "(none)"}`,
    `- Clothing & Accessories: ${params.clothingAccessories || "(none)"}`,
    "",
    "## ORIGINAL CONTENT",
    params.originalContent || "(empty — invent from character profile and title)",
    "",
    "## OUTPUT",
    `JSON only: { "props": [ { "name": "...", "description": "..." }, ...x${TARGET_PROP_COUNT} ] }`,
  ].join("\n");
}

function normalizeProps(raw: unknown): FilmSuggestCharacterPropItem[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.props)
      ? (raw as any).props
      : [];
  const out: FilmSuggestCharacterPropItem[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const name = asString((item as any)?.name);
    const description = asString((item as any)?.description);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, description: description || name });
    if (out.length >= TARGET_PROP_COUNT) break;
  }
  return out;
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
      temperature: 0.5,
      messages: [
        { role: "system", content: params.systemInstruction },
        { role: "user", content: params.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "film_suggest_character_props",
          strict: true,
          schema: FilmSuggestCharacterPropsOpenAIJsonSchema,
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
    const err: any = new Error("OpenAI không trả về JSON vật phẩm");
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
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content: [
            params.systemInstruction,
            "",
            "Output MUST match this JSON Schema:",
            JSON.stringify(FilmSuggestCharacterPropsOpenAIJsonSchema),
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
    const err: any = new Error("OpenAI không trả về JSON vật phẩm");
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
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: FilmSuggestCharacterPropsGeminiSchema,
    },
  });
  const text = String((response as any)?.text || "").trim();
  if (!text) {
    const err: any = new Error("Gemini không trả về JSON vật phẩm");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

export default [
  {
    method: "post",
    path: "/api/app/film/suggest-character-props/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authFilmFeature(req);

        const body = req.body as {
          projectName?: string;
          originalContent?: string;
          characterName?: string;
          characterRole?: string;
          characterDescription?: string;
          clothingAccessories?: string;
          language?: string;
          provider?: string;
        };

        const characterName = asString(body?.characterName);
        if (!characterName) {
          return res.status(400).json({ message: "Thiếu tên nhân vật" });
        }

        const projectName = asString(body?.projectName);
        const originalContent = asString(body?.originalContent).slice(0, MAX_CONTENT_CHARS);
        const characterRole = asString(body?.characterRole);
        const characterDescription = asString(body?.characterDescription);
        const clothingAccessories = asString(body?.clothingAccessories);
        const language = asString(body?.language) || DEFAULT_LANGUAGE;

        const cred = await resolveFilmAiCredentialFromDb(
          filmCustomerId(context),
          body?.provider
        );
        await checkRequestLimit(context.id);

        const userPrompt = buildUserPrompt({
          projectName,
          originalContent,
          characterName,
          characterRole,
          characterDescription,
          clothingAccessories,
          language,
        });

        let rawText = "";
        let model = "";
        let provider: AiProvider = cred.provider;

        if (cred.provider === "gateway") {
          model = cred.model || DEFAULT_CHATGPT_MODEL;
          rawText = await callChatGPTGateway({
            text: ["## SYSTEM", SYSTEM_PROMPT, "", userPrompt].join("\n"),
            label: "film-suggest-character-props",
            model,
            temperature: 0.5,
            baseUrl: cred.endpoint,
            apiKey: cred.apiKey,
            jsonSchema:
              FilmSuggestCharacterPropsOpenAIJsonSchema as unknown as Record<string, unknown>,
            jsonSchemaName: "film_suggest_character_props",
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

        const parsed = parseGeminiJsonResponse(rawText);
        const props = normalizeProps(parsed);
        if (props.length === 0) {
          const err: any = new Error("AI không trả về vật phẩm");
          err.statusCode = 502;
          throw err;
        }

        const data: FilmSuggestCharacterPropsResult = { props };
        await incrementRequestCount(context.id);

        res.json({
          success: true,
          data: {
            ...data,
            provider,
            model,
            language,
            characterName,
          },
        });
      } catch (err: any) {
        logger.error(`[film-suggest-character-props] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
