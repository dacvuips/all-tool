/**
 * pages/api/affiliate-video-prompt.ts
 * Dùng ChatGPT API hoặc Gemini API để biến đổi prompt thô thành N câu prompt chuyên sâu cho video.
 * POST /api/affiliate-video-prompt
 *
 * Tự động detect loại API key:
 *   - Key bắt đầu bằng "sk-" → gọi OpenAI ChatGPT (gpt-4.1-mini)
 *   - Còn lại → gọi Google Gemini (gemini-2.5-flash)
 */
import { GoogleGenAI } from "@google/genai";
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

export interface PromptProcessRequest {
  apiKey: string;
  rawPrompt: string;
  templateId: string;
  numberOfOutputs: number;
}

export interface PromptProcessResponse {
  success: boolean;
  prompts?: string[];
  voids?: string[];
  error?: string;
}

// ── Template system instructions ──────────────────────────────────────────
const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
  affiliate_review: `Bạn là chuyên gia viết kịch bản video và prompt cho AI video generation.
Nhiệm vụ: Từ mô tả / ý tưởng của người dùng, hãy tạo ra {N} video prompt chi tiết.
Mỗi prompt phải mô tả cảnh quay, hành động, ánh sáng, góc camera cụ thể.
QUAN TRỌNG: Xuất ra DUY NHẤT 1 JSON object có dạng:
{"prompts":["prompt1","prompt2",...], "voids":["dialogue1","dialogue2",...] }
Trong đó "prompts" là mảng {N} video prompt bằng tiếng Anh, "voids" là mảng {N} câu thoại/voice-over tương ứng.
Chỉ xuất JSON object, không giải thích, không markdown code block, không text thừa.`,

  unboxing: `Bạn là chuyên gia tạo nội dung unboxing viral cho mạng xã hội.
Nhiệm vụ: Từ mô tả sản phẩm thô, tạo {N} video prompt unboxing khác nhau.
Mỗi prompt phải mô tả:
- Bối cảnh (bàn gỗ, ánh sáng studio, phong cách minimalist...)
- Hành động mở hộp từng bước
- Reaction của người dùng khi nhìn thấy sản phẩm
- Chi tiết cận cảnh (close-up) của sản phẩm
Xuất JSON array {N} string prompt tiếng Anh.`,

  comparison: `Bạn là chuyên gia so sánh sản phẩm với phong cách khoa học, thuyết phục.
Nhiệm vụ: Từ mô tả sản phẩm, tạo {N} video prompt so sánh "before/after" hoặc "vs competitor".
Mỗi prompt mô tả cụ thể cảnh quay chứng minh ưu điểm vượt trội.
Xuất JSON array {N} string prompt tiếng Anh.`,

  tutorial: `Bạn là chuyên gia tạo video hướng dẫn sử dụng sản phẩm.
Nhiệm vụ: Từ mô tả sản phẩm, tạo {N} video prompt hướng dẫn step-by-step.
Mỗi prompt mô tả góc quay tay thao tác, close-up nút bấm/chức năng, text overlay giải thích.
Xuất JSON array {N} string prompt tiếng Anh.`,

  lifestyle: `Bạn là chuyên gia sáng tạo nội dung lifestyle & aspirational marketing.
Nhiệm vụ: Từ mô tả sản phẩm, tạo {N} video prompt thể hiện lối sống đẳng cấp khi dùng sản phẩm.
Mỗi prompt mô tả bối cảnh sang trọng, người dùng tự tin, ánh sáng golden hour, cinematic feel.
Xuất JSON array {N} string prompt tiếng Anh.`,

  testimonial: `Bạn là chuyên gia tạo video testimonial / user-generated content.
Nhiệm vụ: Từ mô tả sản phẩm, tạo {N} video prompt giả lập người dùng thật chia sẻ trải nghiệm.
Phong cách tự nhiên, authentic, shot bằng điện thoại, không quá chỉnh sửa.
Xuất JSON array {N} string prompt tiếng Anh.`,

  custom: `Bạn là AI chuyên gia xử lý prompt video marketing chuyên sâu.
Nhiệm vụ: Từ ý tưởng thô của người dùng, tạo {N} video prompt chi tiết, chuyên nghiệp.
Mỗi prompt phải mô tả: cảnh quay, ánh sáng, chuyển động camera, màu sắc, phong cách.
Xuất JSON array {N} string prompt tiếng Anh.`,
};

// ── Detect API key type ───────────────────────────────────────────────────
function isOpenAIKey(key: string): boolean {
  return key.trim().startsWith("sk-");
}

// ── Call OpenAI ChatGPT ───────────────────────────────────────────────────
async function callChatGPT(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.9,
    max_tokens: 4096,
  });
  return response.choices?.[0]?.message?.content ?? "";
}

// ── Call Google Gemini ─────────────────────────────────────────────────────
async function callGemini(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [
      {
        role: "user",
        parts: [{ text: userPrompt }],
      },
    ],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.9,
      maxOutputTokens: 4096,
    },
  });
  console.log("Gemini response:", response);
  return response.text ?? "";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PromptProcessResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body: PromptProcessRequest = req.body;
  const { apiKey, rawPrompt, templateId, numberOfOutputs } = body;

  if (!apiKey)
    return res.status(400).json({ success: false, error: "Cần API key (OpenAI hoặc Gemini)" });
  if (!rawPrompt?.trim())
    return res.status(400).json({ success: false, error: "Cần nhập prompt mô tả" });

  const N = Math.min(Math.max(1, numberOfOutputs || 1), 8);
  const sysInstruction = (
    TEMPLATE_INSTRUCTIONS[templateId] || TEMPLATE_INSTRUCTIONS.custom
  ).replace(/{N}/g, String(N));

  const userPrompt = `Sản phẩm / ý tưởng: ${rawPrompt.trim()}`;
  const useOpenAI = isOpenAIKey(apiKey);

  try {
    const text = useOpenAI
      ? await callChatGPT(apiKey, sysInstruction, userPrompt)
      : await callGemini(apiKey, sysInstruction, userPrompt);

    const provider = useOpenAI ? "ChatGPT" : "Gemini";
    console.log(`[affiliate-video-prompt] ${provider} raw response:`, text);

    // ── Robust JSON extraction ──────────────────────────────────────────────
    // 1. Strip markdown code fences
    const stripped = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // Helper: try JSON.parse, return { prompts, voids } or null
    const tryParseObj = (s: string): { prompts: string[]; voids: string[] } | null => {
      try {
        const parsed = JSON.parse(s);
        // Handle object format {prompts:[], voids:[]}
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          if (Array.isArray(parsed.prompts)) {
            return {
              prompts: parsed.prompts.map(String),
              voids: Array.isArray(parsed.voids) ? parsed.voids.map(String) : [],
            };
          }
        }
        // Handle plain array format [...]
        if (Array.isArray(parsed)) {
          return { prompts: parsed.map(String), voids: [] };
        }
      } catch {}
      return null;
    };

    // 2. Try parsing the whole stripped text
    let result = tryParseObj(stripped);

    // 3. Find JSON object {...} first, then array [...]
    if (!result) {
      const objMatch = stripped.match(/\{[\s\S]*\}/);
      if (objMatch) result = tryParseObj(objMatch[0]);
    }
    if (!result) {
      const arrayMatch = stripped.match(/\[[\s\S]*\]/);
      if (arrayMatch) result = tryParseObj(arrayMatch[0]);
    }

    // 4. Fallback: extract quoted strings (handles partial/broken JSON)
    if (!result) {
      const quoted = Array.from(stripped.matchAll(/"((?:[^"\\]|\\.)*)"/g)).map((m) =>
        m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
      );
      if (quoted.length > 0) result = { prompts: quoted, voids: [] };
    }

    // 5. Last resort: numbered / bulleted list lines
    if (!result || result.prompts.length === 0) {
      const lines = text
        .split(/\n+/)
        .map((l) => l.replace(/^[\-\*\d]+[.)]\s*/, "").trim())
        .filter((l) => l.length > 20);
      if (lines.length > 0) result = { prompts: lines, voids: [] };
    }

    if (!result || result.prompts.length === 0) throw new Error("AI không trả về prompt hợp lệ");
    console.log("result", result);
    return res.status(200).json({
      success: true,
      prompts: result.prompts,
      voids: result.voids,
    });
  } catch (err: any) {
    console.error("[affiliate-video-prompt] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Lỗi xử lý prompt" });
  }
}
