/**
 * POST /api/app/film/extract-screenplay/
 * Trích xuất phân cảnh dạng JSON object (scenes + characters + locations + props).
 * API key đọc từ bảng Credential. Prompt (system + user) ghép trên backend.
 * Body: content, language, sceneCount, narration?, systemInstruction?, previousScenes? (kế thừa tập trước).
 *
 * Structured output:
 * - OpenAI: response_format json_schema (strict)
 * - Gemini: responseMimeType application/json + responseSchema
 * - Gateway: jsonSchema gắn vào prompt
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
import { FILM_DEFAULT_SYSTEM_INSTRUCTION } from "./_film-screenplay-system-instruction";
import {
  buildExtractScreenplaySchemas,
  FILM_CHARACTER_ROLES,
  FILM_PROP_CATEGORIES,
  FILM_TIME_OF_DAY_VALUES,
  type FilmExtractCharacterAction,
  type FilmExtractCharacterItem,
  type FilmExtractDialogue,
  type FilmExtractLocationItem,
  type FilmExtractPropItem,
  type FilmExtractSceneItem,
  type FilmExtractScreenplayResult,
} from "./extract-screenplay.schema";

const MAX_CONTENT_CHARS = 120_000;
const MAX_SYSTEM_INSTRUCTION_CHARS = 80_000;
/** OpenAI Chat Completions — model OpenAI API cho trích xuất screenplay. */
const OPENAI_MODEL = "gpt-5.6-terra";
const GEMINI_MODEL = "gemini-2.0-flash";
const DEFAULT_LANGUAGE = "Vietnamese";
const MIN_SCENE_COUNT = 1;
const MAX_SCENE_COUNT = 60;

const ALLOWED_LANGUAGES = new Set([
  "Vietnamese",
  "English",
  "Chinese",
  "Japanese",
  "Korean",
  "Hindi",
  "French",
  "German",
  "Spanish",
  "Italian",
  "Portuguese",
  "Russian",
  "Arabic",
  "Turkish",
]);

type AiProvider = "gateway" | "openai" | "gemini";

function normalizeLanguage(raw?: string): string {
  const v = String(raw || "").trim();
  if (ALLOWED_LANGUAGES.has(v)) return v;
  return DEFAULT_LANGUAGE;
}

function normalizeSceneCount(raw: unknown): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 6;
  return Math.min(MAX_SCENE_COUNT, Math.max(MIN_SCENE_COUNT, n));
}

type PreviousSceneContext = {
  title: string;
  summary: string;
};

function normalizePreviousScenes(raw: unknown): PreviousSceneContext[] {
  if (!Array.isArray(raw)) return [];
  const out: PreviousSceneContext[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const title = asString((item as { title?: unknown }).title).slice(0, 400);
    const summary = asString((item as { summary?: unknown }).summary).slice(0, 4_000);
    if (!title && !summary) continue;
    out.push({ title, summary });
    if (out.length >= MAX_SCENE_COUNT) break;
  }
  return out;
}

function formatPreviousScenesBlock(scenes: PreviousSceneContext[]): string {
  if (!scenes.length) return "";
  const lines = scenes.map((s, i) => {
    const title = s.title || `Cảnh quay #${i + 1}`;
    const summary = s.summary;
    return summary
      ? `${i + 1}. ${title}\n   Tổng quan: ${summary}`
      : `${i + 1}. ${title}`;
  });
  return [
    "## NỘI DUNG TẬP TRƯỚC (KẾ THỪA)",
    "Tổng hợp Tiêu đề + Tổng quan cảnh quay của tập ngay trước.",
    "Dùng để nối mạch câu chuyện, nhân vật, bối cảnh và tiến trình.",
    "KHÔNG lặp lại các phân cảnh tập trước. Tập hiện tại phải tiếp nối tự nhiên từ đó.",
    "Ưu tiên nội dung gốc mới khi có mâu thuẫn; tập trước chỉ là ngữ cảnh.",
    "",
    ...lines,
    "",
  ].join("\n");
}

type FilmNarrationMode = "dialogue" | "third_person" | "pov";

function normalizeNarration(raw?: string): FilmNarrationMode {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "third_person" || v === "third-person" || v === "ngoi_3") return "third_person";
  if (v === "pov" || v === "first_person" || v === "first-person" || v === "ngoi_1") return "pov";
  return "dialogue";
}

/** Quy tắc ngôi kể — gắn vào user prompt khi trích xuất. */
function formatNarrationModeBlock(narration: FilmNarrationMode, language: string): string {
  if (narration === "third_person") {
    return [
      "## NARRATION MODE: THIRD PERSON (Ngôi 3)",
      `- dialogues BẮT BUỘC là lời dẫn chuyện ngôi 3 (narrator voiceover), viết bằng ${language}.`,
      "- character của mỗi dialogue: dùng 'Người kể' / 'Narrator' (hoặc tương đương theo ngôn ngữ output).",
      "- KHÔNG viết đối thoại qua lại giữa nhân vật trong dialogues; thoại nhân vật (nếu cần cho mạch) chỉ mô tả ngắn trong content/characterActions.",
      "- Giọng kể: ngôi 3 (anh ấy/cô ấy/họ hoặc tên nhân vật), khách quan hoặc limited third-person.",
      "- voice phải mô tả giọng người kể chuyện (không phải giọng thoại nhân vật).",
    ].join("\n");
  }
  if (narration === "pov") {
    return [
      "## NARRATION MODE: POV (Góc nhìn nhân vật / Ngôi 1)",
      `- dialogues BẮT BUỘC là lời kể / độc thoại nội tâm góc nhìn nhân vật (POV, ngôi 1), viết bằng ${language}.`,
      "- character: tên nhân vật đang giữ góc nhìn (thường là nhân vật chính / focal character của cảnh).",
      "- line viết ngôi 1 (tôi / I / 我… tùy language) — cảm nhận, suy nghĩ, hoặc những gì nhân vật chứng kiến.",
      "- Ưu tiên shotSize/cameraAngle mang tính POV khi phù hợp (vd. POV (Góc nhìn nhân vật), Over-the-Shoulder, Cận cảnh).",
      "- visualDescription / motion có thể mô tả khung hình như nhân vật POV đang nhìn thấy.",
      "- voice mô tả giọng đúng nhân vật POV (giới tính, pitch, tốc độ, tuổi, cảm xúc).",
      "- Có thể có rất ít thoại người khác; ưu tiên dòng kể POV trong dialogues.",
    ].join("\n");
  }
  return [
    "## NARRATION MODE: DIALOGUE (Đối thoại)",
    `- dialogues BẮT BUỘC là thoại nói của nhân vật (spoken dialogue), viết bằng ${language}.`,
    "- Mỗi phần tử: tên nhân vật đang nói + câu thoại của họ.",
    "- KHÔNG viết lời dẫn chuyện ngôi 3 hay lời kể ngôi 1/POV vào dialogues.",
    "- voice mô tả giọng từng người nói (hoặc từng người nếu nhiều thoại).",
  ].join("\n");
}

function buildUserPrompt(params: {
  content: string;
  language: string;
  sceneCount: number;
  narration: FilmNarrationMode;
  previousScenes?: PreviousSceneContext[];
}): string {
  const { content, language, sceneCount, narration, previousScenes = [] } = params;
  const inherit = previousScenes.length > 0;
  return [
    "## TASK",
    inherit
      ? "Chia ORIGINAL CONTENT bên dưới thành đúng số phân cảnh storyboard JSON, tiếp nối mạch truyện từ tập trước."
      : "Chia ORIGINAL CONTENT bên dưới thành đúng số phân cảnh storyboard JSON.",
    `BẮT BUỘC đúng ${sceneCount} phân cảnh (scenes.length === ${sceneCount}).`,
    "Tuân thủ JSON Schema đã cung cấp — mọi quy tắc field, enum và format nằm trong schema descriptions.",
    `Mọi field narrative viết bằng ${language}.`,
    inherit
      ? "- Giữ continuity nhân vật/bối cảnh; KHÔNG lặp lại các cảnh đã có ở tập trước."
      : "",
    "",
    formatNarrationModeBlock(narration, language),
    "",
    formatPreviousScenesBlock(previousScenes),
    "## ORIGINAL CONTENT",
    content.trim(),
  ].join("\n");
}

function withLanguageInSystemInstruction(systemInstruction: string, language: string): string {
  return [
    systemInstruction.trim(),
    "",
    "## OUTPUT FORMAT:",
    "- You MUST return a single JSON object matching the provided schema.",
    "- Do NOT return markdown screenplay body. Do NOT wrap JSON in code fences.",
    "",
    "## OUTPUT LANGUAGE REQUIREMENT:",
    `- All narrative text fields MUST be written in ${language}.`,
    `- Do not mix languages unless the original material intentionally mixes languages.`,
  ].join("\n");
}

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    const s = asString(item);
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function normalizeDialogues(raw: unknown): FilmExtractDialogue[] {
  if (!Array.isArray(raw)) return [];
  const out: FilmExtractDialogue[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const character = asString((item as any).character);
    const line = asString((item as any).line);
    if (!character && !line) continue;
    out.push({ character: character || "Unknown", line });
  }
  return out;
}

function normalizeCharacterActions(raw: unknown): FilmExtractCharacterAction[] {
  if (!Array.isArray(raw)) return [];
  const out: FilmExtractCharacterAction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const character = asString((item as any).character);
    const action = asString((item as any).action);
    if (!character && !action) continue;
    out.push({ character: character || "Unknown", action });
  }
  return out;
}

function isNoneish(v: string): boolean {
  const s = v.trim().toLowerCase();
  return !s || s === "none" || s === "không" || s === "khong";
}

function normalizeEnumValue<T extends string>(raw: string, allowed: readonly T[], fallback: T): T {
  const key = raw.trim().toLowerCase();
  const hit = allowed.find((v) => v.toLowerCase() === key);
  return hit || fallback;
}

function repairExtractScene(scene: FilmExtractSceneItem): FilmExtractSceneItem {
  const next = { ...scene };
  if (!next.sfx.trim()) next.sfx = "none";
  if (!next.music.trim()) next.music = "none";
  if (!next.motion.trim()) {
    next.motion = next.content
      ? `Camera và nhân vật di chuyển tự nhiên trong cảnh — ${next.content.slice(0, 160)}`
      : "Camera pan chậm qua không gian cảnh, nhân vật có chuyển động nhẹ theo nhịp cảnh";
  }
  if (!next.audio.trim()) {
    next.audio = next.atmosphere
      ? `Ambience và lớp âm nền phù hợp không khí ${next.atmosphere}`
      : "Ambience không gian cảnh, tiếng môi trường vừa phải";
  }
  if (next.dialogues.length > 0 && isNoneish(next.voice)) {
    next.voice =
      "Giọng trung tính, pitch trung bình, tốc độ vừa, tuổi trưởng thành, cảm xúc theo tone cảnh";
  } else if (!next.dialogues.length && isNoneish(next.voice)) {
    next.voice = "none";
  }
  return next;
}

function normalizeResult(parsed: Record<string, unknown>, sceneCount: number): FilmExtractScreenplayResult {
  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  if (rawScenes.length === 0) {
    const err: any = new Error("AI không trả về phân cảnh nào");
    err.statusCode = 502;
    throw err;
  }
  if (rawScenes.length !== sceneCount) {
    const err: any = new Error(
      `AI trả ${rawScenes.length} phân cảnh, yêu cầu đúng ${sceneCount}. Thử lại.`
    );
    err.statusCode = 502;
    throw err;
  }

  const scenes: FilmExtractSceneItem[] = rawScenes.map((raw, i) => {
    const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const dialogues = normalizeDialogues(s.dialogues);
    const characterActions = normalizeCharacterActions(
      s.characterActions ?? s.character_actions
    );
    const characterNames = asStringArray(s.characterNames);
    // Bổ sung tên từ dialogues / characterActions nếu model quên
    for (const d of dialogues) {
      if (d.character && !characterNames.some((n) => n.toLowerCase() === d.character.toLowerCase())) {
        characterNames.push(d.character);
      }
    }
    for (const a of characterActions) {
      if (
        a.character &&
        !characterNames.some((n) => n.toLowerCase() === a.character.toLowerCase())
      ) {
        characterNames.push(a.character);
      }
    }
    const content = asString(s.content);
    const visualDescription =
      asString(s.visualDescription ?? s.visual_description) || content;
    const atmosphere = asString(s.atmosphere);
    return {
      index: Math.max(1, Math.floor(Number(s.index)) || i + 1),
      title: asString(s.title) || `Cảnh quay #${i + 1}`,
      content,
      characterActions,
      visualDescription,
      atmosphere,
      shotSize: asString(s.shotSize) || "Trung cảnh",
      cameraAngle: asString(s.cameraAngle) || "Chính diện",
      cameraMovement: asString(s.cameraMovement) || "Tĩnh",
      motion: asString(s.motion ?? s.motionPrompt),
      audio: asString(s.audio ?? s.audioAmbience),
      sfx: asString(s.sfx),
      music: asString(s.music),
      voice: asString(s.voice ?? s.voiceDirection),
      videoPrompt: asString(s.videoPrompt ?? s.video_prompt),
      dialogues,
      location: asString(s.location),
      characterNames,
      propNames: asStringArray(s.propNames),
    };
  }).map(repairExtractScene);

  // Re-index 1..N liên tục
  scenes.forEach((sc, i) => {
    sc.index = i + 1;
  });

  const characters: FilmExtractCharacterItem[] = (
    Array.isArray(parsed.characters) ? parsed.characters : []
  ).map((raw) => {
    const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      name: asString(c.name),
      description: asString(c.description),
      clothingAccessories: asString(
        c.clothingAccessories ?? c.clothing_and_accessories ?? c.clothing
      ) || asString(c.description).slice(0, 120),
      role: normalizeEnumValue(asString(c.role) || "supporting", FILM_CHARACTER_ROLES, "supporting"),
    };
  }).filter((c) => c.name);

  const locations: FilmExtractLocationItem[] = (
    Array.isArray(parsed.locations) ? parsed.locations : []
  ).map((raw) => {
    const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const timeOfDayRaw = asString(l.timeOfDay ?? l.time_of_day);
    const timeOfDay = normalizeEnumValue(
      timeOfDayRaw || "Daylight",
      FILM_TIME_OF_DAY_VALUES,
      "Daylight"
    );
    return {
      name: asString(l.name),
      description: asString(l.description),
      context: asString(l.context) || timeOfDay || "Ngày",
      timeOfDay,
    };
  }).filter((l) => l.name);

  const props: FilmExtractPropItem[] = (
    Array.isArray(parsed.props) ? parsed.props : []
  ).map((raw) => {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      name: asString(p.name),
      description: asString(p.description),
      category: normalizeEnumValue(asString(p.category) || "prop", FILM_PROP_CATEGORIES, "prop"),
    };
  }).filter((p) => p.name);

  // Bổ sung aggregate từ scenes nếu model để rỗng
  if (characters.length === 0) {
    const names = new Set<string>();
    for (const sc of scenes) {
      for (const n of sc.characterNames) names.add(n);
      for (const d of sc.dialogues) if (d.character) names.add(d.character);
    }
    Array.from(names).forEach((name) => {
      characters.push({
        name,
        description: "",
        clothingAccessories: "",
        role: "supporting",
      });
    });
  }
  if (locations.length === 0) {
    const seen = new Set<string>();
    for (const sc of scenes) {
      const name = sc.location.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      locations.push({
        name,
        description: sc.content.slice(0, 80),
        context: "Ngày",
        timeOfDay: "Daylight",
      });
    }
  }
  if (props.length === 0) {
    const seen = new Set<string>();
    for (const sc of scenes) {
      for (const name of sc.propNames) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        props.push({ name, description: "", category: "prop" });
      }
    }
  }

  return { scenes, characters, locations, props };
}

async function callOpenAiJson(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  openAiSchema: Record<string, unknown>;
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
      messages: [
        { role: "system", content: params.systemInstruction },
        { role: "user", content: params.userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "film_extract_screenplay",
          strict: true,
          schema: params.openAiSchema,
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
    // Fallback: một số model/key không hỗ trợ json_schema strict → json_object
    const msg = String(json?.error?.message || bodyText.slice(0, 200) || "");
    if (resp.status === 400 && /response_format|json_schema|strict/i.test(msg)) {
      return callOpenAiJsonObjectFallback(params);
    }
    const err: any = new Error(msg || `OpenAI HTTP ${resp.status}`);
    err.statusCode = resp.status === 401 || resp.status === 403 ? resp.status : 502;
    throw err;
  }
  const text = String(json?.choices?.[0]?.message?.content || "").trim();
  if (!text) {
    const err: any = new Error("OpenAI không trả về JSON phân cảnh");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

async function callOpenAiJsonObjectFallback(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  openAiSchema: Record<string, unknown>;
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
      messages: [
        {
          role: "system",
          content: [
            params.systemInstruction,
            "",
            "Output MUST match this JSON Schema exactly:",
            JSON.stringify(params.openAiSchema),
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
    const err: any = new Error("OpenAI không trả về JSON phân cảnh");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

async function callGeminiJson(params: {
  apiKey: string;
  systemInstruction: string;
  userPrompt: string;
  geminiSchema: Record<string, unknown>;
}): Promise<{ text: string; model: string }> {
  const model = GEMINI_MODEL;
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: params.userPrompt,
    config: {
      systemInstruction: params.systemInstruction,
      temperature: 0.35,
      responseMimeType: "application/json",
      responseSchema: params.geminiSchema,
    },
  });
  const text = String((response as any)?.text || "").trim();
  if (!text) {
    const err: any = new Error("Gemini không trả về JSON phân cảnh");
    err.statusCode = 502;
    throw err;
  }
  return { text, model };
}

export default [
  {
    method: "post",
    path: "/api/app/film/extract-screenplay/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          content?: string;
          systemInstruction?: string;
          language?: string;
          sceneCount?: number;
          narration?: string;
          provider?: string;
          previousScenes?: unknown;
        };

        const content = String(body?.content || "").trim().slice(0, MAX_CONTENT_CHARS);
        if (!content) {
          return res.status(400).json({ message: "Thiếu nội dung gốc để trích xuất" });
        }

        const systemInstructionRaw = (
          String(body?.systemInstruction || "").trim() || FILM_DEFAULT_SYSTEM_INSTRUCTION
        ).slice(0, MAX_SYSTEM_INSTRUCTION_CHARS);

        const language = normalizeLanguage(body?.language);
        const sceneCount = normalizeSceneCount(body?.sceneCount);
        const narration = normalizeNarration(body?.narration);
        const systemInstruction = withLanguageInSystemInstruction(
          systemInstructionRaw,
          language
        );

        const cred = await resolveFilmAiCredentialFromDb(
          filmCustomerId(context),
          body?.provider
        );
        await checkRequestLimit(context.id);

        const previousScenes = normalizePreviousScenes(body?.previousScenes);
        const schemas = buildExtractScreenplaySchemas({ sceneCount, language, narration });
        const userPrompt = buildUserPrompt({
          content,
          language,
          sceneCount,
          narration,
          previousScenes,
        });
        let rawText = "";
        let model = "";
        let provider: AiProvider = cred.provider;

        if (cred.provider === "gateway") {
          model = cred.model || DEFAULT_CHATGPT_MODEL;
          const fullPrompt = [
            "## SYSTEM INSTRUCTION",
            systemInstruction,
            "",
            userPrompt,
          ].join("\n");
          rawText = await callChatGPTGateway({
            text: fullPrompt,
            label: "film-extract-screenplay",
            model,
            temperature: 0.35,
            baseUrl: cred.endpoint,
            apiKey: cred.apiKey,
            jsonSchema: schemas.openai as unknown as Record<string, unknown>,
            jsonSchemaName: "film_extract_screenplay",
          });
        } else if (cred.provider === "gemini") {
          const out = await callGeminiJson({
            apiKey: cred.apiKey,
            systemInstruction,
            userPrompt,
            geminiSchema: schemas.gemini as unknown as Record<string, unknown>,
          });
          rawText = out.text;
          model = out.model;
        } else {
          const out = await callOpenAiJson({
            apiKey: cred.apiKey,
            systemInstruction,
            userPrompt,
            openAiSchema: schemas.openai as unknown as Record<string, unknown>,
          });
          rawText = out.text;
          model = out.model;
          provider = "openai";
        }

        const parsed = parseGeminiJsonResponse(rawText);
        const data = normalizeResult(parsed, sceneCount);

        await incrementRequestCount(context.id);

        res.json({
          success: true,
          data: {
            ...data,
            provider,
            model,
            language,
            sceneCount,
          },
        });
      } catch (err: any) {
        logger.error(`[film-extract-screenplay] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
