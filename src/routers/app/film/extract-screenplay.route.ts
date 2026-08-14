/**
 * POST /api/app/film/extract-screenplay/
 * Trích xuất phân cảnh dạng JSON object (scenes + characters + locations + props).
 * API key đọc từ bảng Credential. Prompt (system + user) ghép trên backend.
 * Body: content, language, sceneCount, systemInstruction?, previousScenes? (kế thừa tập trước).
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
  FilmExtractScreenplayGeminiSchema,
  FilmExtractScreenplayOpenAIJsonSchema,
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

function buildUserPrompt(params: {
  content: string;
  language: string;
  sceneCount: number;
  previousScenes?: PreviousSceneContext[];
}): string {
  const { content, language, sceneCount, previousScenes = [] } = params;
  const inherit = previousScenes.length > 0;
  return [
    "## TASK",
    inherit
      ? "Chia nội dung gốc bên dưới thành các PHÂN CẢNH chi tiết cho storyboard, có kế thừa mạch truyện từ tập trước."
      : "Chia nội dung gốc bên dưới thành các PHÂN CẢNH chi tiết cho storyboard.",
    `BẮT BUỘC tạo đúng ${sceneCount} phân cảnh (scenes.length === ${sceneCount}). Không được ít hơn hoặc nhiều hơn.`,
    `Mọi field text (title, content, dialogue, description, ...) viết bằng ${language}.`,
    "",
    "## MỖI PHÂN CẢNH (scenes[i]) BẮT BUỘC có:",
    "- index: số thứ tự 1..N",
    "- title: tiêu đề ngắn",
    "- content: tóm tắt / overview ngắn toàn cảnh (1–3 câu)",
    "- characterActions: mảng { character, action } — HÀNH ĐỘNG từng nhân vật trong cảnh:",
    "  · action: làm gì, tương tác với ai/cái gì như thế nào (KHÔNG gộp lời thoại vào đây)",
    "  · mỗi nhân vật trong characterNames nên có 1 phần tử tương ứng",
    "- visualDescription: Hình ảnh cảnh quay — mô tả khung hình, composition, ánh sáng, không gian nhìn thấy",
    "- atmosphere: Không khí cảnh — cảm xúc / năng lượng / tone (căng thẳng, ấm áp, u ám, ...)",
    "- shotSize: cỡ cảnh (Toàn cảnh / Trung cảnh / Cận cảnh / Siêu cận / ...)",
    "- cameraAngle: góc máy",
    "- cameraMovement: lia máy",
    "- motion: [MOTION] mô tả CHI TIẾT chuyển động camera + nhân vật/vật thể (hướng, tốc độ, nhịp). KHÔNG để rỗng.",
    "- audio: [AUDIO] nền âm thanh tổng / ambience (phòng, ngoài trời, crowd, máy móc...). KHÔNG để rỗng.",
    "- sfx: [SFX] hiệu ứng cụ thể (bước chân, cửa, va chạm, mưa...). Dùng 'none' nếu không có.",
    "- music: [MUSIC] nhạc nền (thể loại, mood, crescendo/fade). Dùng 'none' nếu im lặng.",
    "- voice: [VOICE] chỉ dẫn giọng — KHÔNG chép nguyên thoại. Dùng 'none' CHỈ khi cảnh không có lời.",
    "  · Có lời thì BẮT BUỘC đủ 5 yếu tố: giới tính (nam/nữ), pitch (trầm/bổng), tốc độ (nhanh/chậm), tuổi giọng, cảm xúc.",
    "  · Có thể thêm ai nói. VD: 'Minh, nam, giọng trầm, nói chậm, tuổi trung niên, căng thẳng'.",
    "  · Nhiều người nói: liệt kê từng người, mỗi người đủ 5 yếu tố.",
    "- videoPrompt: Prompt video ĐẦY ĐỦ gắn vào UI từng phân cảnh. Format BẮT BUỘC (không markdown, KHÔNG viết nội dung liền sau tag):",
    "    [MOTION]",
    "    - mô tả chuyển động",
    "    [AUDIO]",
    "    - mô tả nền âm",
    "    [SFX]",
    "    - hiệu ứng",
    "    [MUSIC]",
    "    - nhạc nền",
    "    [VOICE]",
    "    - chỉ dẫn giọng",
    "    [DIALOGUE]",
    "    - Tên: lời thoại (bỏ khối này nếu không có thoại)",
    "  · Mỗi tag một khối: tag trên 1 dòng, giá trị xuống dòng, mỗi dòng bắt đầu bằng '- '.",
    "  · SAI: [AUDIO]Nước rút...  — ĐÚNG:",
    "    [AUDIO]",
    "    - Nước rút...",
    "  · videoPrompt phải dùng đúng nội dung các field motion/audio/sfx/music/voice/dialogues ở trên.",
    "- dialogues: mảng { character, line } — [DIALOGUE] lời thoại từng nhân vật; để [] nếu không có thoại",
    "- location: địa điểm cảnh",
    "- characterNames: tên nhân vật xuất hiện trong cảnh",
    "- propNames: props xuất hiện trong cảnh",
    "",
    "## TỔNG HỢP (unique, không trùng lặp):",
    "- characters: { name, description, clothingAccessories, role }",
    "  · description: ngoại hình + tính cách (KHÔNG gồm trang phục)",
    "  · clothingAccessories: Clothing & Accessories — quần áo, giày dép, trang sức, phụ kiện chi tiết",
    "- locations: { name, description, context, timeOfDay }",
    "  · timeOfDay: Time of Day / ánh sáng — e.g. Golden Hour, Harsh Noon, Rainy Night, Blue Hour, Overcast Morning, Moonlit Night",
    "- props: { name, description, category }",
    "",
    "## RULES",
    `- Đúng ${sceneCount} phần tử trong scenes, index liên tục từ 1 đến ${sceneCount}.`,
    "- Chia nội dung cân đều theo tiến trình câu chuyện; không cắt vụn vô nghĩa.",
    "- Role nhân vật: main | antagonist | supporting | extra.",
    "- Category props: weapon | container | prop | clothing | other.",
    "- clothingAccessories BẮT BUỘC cụ thể, sống động cho image prompt (không để rỗng).",
    "- timeOfDay BẮT BUỘC dùng cụm ánh sáng điện ảnh tiếng Anh (Golden Hour / Harsh Noon / Rainy Night / ...).",
    "- Mỗi phân cảnh BẮT BUỘC có mô tả chi tiết motion/audio/sfx/music/voice (tag [MOTION] [AUDIO] [SFX] [MUSIC] [VOICE] [DIALOGUE] khi ghép prompt video).",
    "- motion/audio/sfx/music/voice viết cụ thể, điện ảnh; không generic ('có tiếng động').",
    "- [VOICE] khi có thoại: BẮT BUỘC gồm giới tính + pitch (trầm/bổng) + tốc độ + tuổi giọng + cảm xúc. Không được chỉ 'giọng nam' hoặc 'nói nhanh'.",
    "- Return ONLY raw JSON matching the response schema. No markdown, no code fences, no explanation.",
    "",
    `## OUTPUT LANGUAGE: ${language}`,
    `## SCENE COUNT (MANDATORY): ${sceneCount}`,
    inherit
      ? "- Tiếp nối tập trước: giữ continuity nhân vật/bối cảnh, không viết lại các cảnh đã có ở tập trước."
      : "",
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
  });

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
      ),
      role: asString(c.role) || "supporting",
    };
  }).filter((c) => c.name);

  const locations: FilmExtractLocationItem[] = (
    Array.isArray(parsed.locations) ? parsed.locations : []
  ).map((raw) => {
    const l = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const timeOfDay = asString(l.timeOfDay ?? l.time_of_day);
    return {
      name: asString(l.name),
      description: asString(l.description),
      context: asString(l.context) || timeOfDay || "Ngày",
      timeOfDay: timeOfDay || asString(l.context) || "Daylight",
    };
  }).filter((l) => l.name);

  const props: FilmExtractPropItem[] = (
    Array.isArray(parsed.props) ? parsed.props : []
  ).map((raw) => {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      name: asString(p.name),
      description: asString(p.description),
      category: asString(p.category) || "prop",
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
          schema: FilmExtractScreenplayOpenAIJsonSchema,
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
            JSON.stringify(FilmExtractScreenplayOpenAIJsonSchema),
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
      responseSchema: FilmExtractScreenplayGeminiSchema,
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
        const userPrompt = buildUserPrompt({
          content,
          language,
          sceneCount,
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
            jsonSchema: FilmExtractScreenplayOpenAIJsonSchema as unknown as Record<string, unknown>,
            jsonSchemaName: "film_extract_screenplay",
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
