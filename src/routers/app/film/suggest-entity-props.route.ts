/**
 * POST /api/app/film/suggest-entity-props/
 * Gợi ý đúng 10 vật phẩm kèm cho 1 Vật phẩm hoặc Bối cảnh (gpt-4o-mini ưu tiên).
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
  FilmSuggestEntityPropsGeminiSchema,
  FilmSuggestEntityPropsOpenAIJsonSchema,
  type FilmSuggestEntityKind,
  type FilmSuggestEntityPropItem,
  type FilmSuggestEntityPropsResult,
} from "./suggest-entity-props.schema";

const MAX_CONTENT_CHARS = 40_000;
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_LANGUAGE = "Vietnamese";
const TARGET_PROP_COUNT = 10;

const SYSTEM_PROMPT_PROP = `## ROLE
You are a film prop designer specializing in companion pieces, small related accessories, and detail props that pair with a main hero prop.

## GOAL
Given one main prop + project title + original story, invent exactly ${TARGET_PROP_COUNT} companion/related props that share a visual or functional relationship with the main prop (set, case, matching item, scrap of detail, branding tag, strap, base, recharge unit, etc.).

## OUTPUT CONSTRAINTS
- Return ONLY JSON matching the schema. No markdown.
- Exactly ${TARGET_PROP_COUNT} items in "props".
- name (2–8 words) + description (1–3 vivid physical sentences).
- Follow the requested language.
- Names unique. Do not repeat the main prop name alone as an item.
- Keep items product-shot friendly (single object, clear materials). Avoid full locations or characters.`;

const SYSTEM_PROMPT_LOCATION = `## ROLE
You are a film set dresser specializing in set dressing, environment props, and practical objects that belong in a location plate / bối cảnh.

## GOAL
Given one location / scene setting + project title + original story, invent exactly ${TARGET_PROP_COUNT} environment props or set dressing pieces visible in that location (furniture, fixtures, signage, vehicles fragments, terrain marker, weather props, cult objects, plant pots… depending on place).

## OUTPUT CONSTRAINTS
- Return ONLY JSON matching the schema. No markdown.
- Exactly ${TARGET_PROP_COUNT} items in "props".
- name (2–8 words) + description (1–3 vivid physical sentences for image generation).
- Follow the requested language.
- Names unique. Prefer set dressing over wearable character jewelry unless the location demands them.
- Avoid inventing new character names. Keep props that feel grounded in the location.`;

type AiProvider = "gateway" | "openai" | "gemini";

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function buildUserPrompt(params: {
  entityKind: FilmSuggestEntityKind;
  language: string;
  projectName: string;
  originalContent: string;
  entityName: string;
  entityMeta: string;
  entityDescription: string;
}): string {
  const kindLabel =
    params.entityKind === "location" ? "LOCATION / SETTING" : "MAIN PROP";
  return [
    "## TASK",
    `Suggest exactly ${TARGET_PROP_COUNT} companion props for this ${kindLabel}.`,
    `Write name + description in ${params.language}.`,
    "",
    "## FILM PROJECT",
    params.projectName || "(untitled)",
    "",
    `## ${kindLabel}`,
    `- Name: ${params.entityName || "(unnamed)"}`,
    `- Meta: ${params.entityMeta || "(none)"}`,
    `- Description: ${params.entityDescription || "(none)"}`,
    "",
    "## ORIGINAL CONTENT",
    params.originalContent || "(empty — invent from entity profile and title)",
    "",
    "## OUTPUT",
    `JSON only: { "props": [ { "name": "...", "description": "..." }, ...x${TARGET_PROP_COUNT} ] }`,
  ].join("\n");
}

function normalizeProps(raw: unknown): FilmSuggestEntityPropItem[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.props)
      ? (raw as any).props
      : [];
  const out: FilmSuggestEntityPropItem[] = [];
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
          name: "film_suggest_entity_props",
          strict: true,
          schema: FilmSuggestEntityPropsOpenAIJsonSchema,
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
            JSON.stringify(FilmSuggestEntityPropsOpenAIJsonSchema),
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
      responseSchema: FilmSuggestEntityPropsGeminiSchema,
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
    path: "/api/app/film/suggest-entity-props/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          entityKind?: string;
          projectName?: string;
          originalContent?: string;
          entityName?: string;
          entityMeta?: string;
          entityDescription?: string;
          language?: string;
          provider?: string;
        };

        const kindRaw = asString(body?.entityKind).toLowerCase();
        const entityKind: FilmSuggestEntityKind =
          kindRaw === "location" ? "location" : "prop";
        const entityName = asString(body?.entityName);
        if (!entityName) {
          return res.status(400).json({ message: "Thiếu tên entity" });
        }

        const projectName = asString(body?.projectName);
        const originalContent = asString(body?.originalContent).slice(0, MAX_CONTENT_CHARS);
        const entityMeta = asString(body?.entityMeta);
        const entityDescription = asString(body?.entityDescription);
        const language = asString(body?.language) || DEFAULT_LANGUAGE;
        const systemInstruction =
          entityKind === "location" ? SYSTEM_PROMPT_LOCATION : SYSTEM_PROMPT_PROP;

        const cred = await resolveFilmAiCredentialFromDb(
          filmCustomerId(context),
          body?.provider || "openai"
        );
        await checkRequestLimit(context.id);

        const userPrompt = buildUserPrompt({
          entityKind,
          language,
          projectName,
          originalContent,
          entityName,
          entityMeta,
          entityDescription,
        });

        let rawText = "";
        let model = "";
        let provider: AiProvider = cred.provider;

        if (cred.provider === "gateway") {
          model = cred.model || DEFAULT_CHATGPT_MODEL;
          rawText = await callChatGPTGateway({
            text: ["## SYSTEM", systemInstruction, "", userPrompt].join("\n"),
            label: "film-suggest-entity-props",
            model,
            temperature: 0.5,
            baseUrl: cred.endpoint,
            apiKey: cred.apiKey,
            jsonSchema:
              FilmSuggestEntityPropsOpenAIJsonSchema as unknown as Record<string, unknown>,
            jsonSchemaName: "film_suggest_entity_props",
          });
        } else if (cred.provider === "gemini") {
          const out = await callGeminiJson({
            apiKey: cred.apiKey,
            systemInstruction,
            userPrompt,
          });
          rawText = out.text;
          model = out.model;
        } else {
          const out = await callOpenAiJson({
            apiKey: cred.apiKey,
            systemInstruction,
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

        const data: FilmSuggestEntityPropsResult = { props };
        await incrementRequestCount(context.id);

        res.json({
          success: true,
          data: {
            ...data,
            provider,
            model,
            language,
            entityKind,
            entityName,
          },
        });
      } catch (err: any) {
        logger.error(`[film-suggest-entity-props] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
