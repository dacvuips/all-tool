import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callWithKeyRotation,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
} from "./_shared";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

const SYSTEM_INSTRUCTION = `Bạn là trợ lý AI chuyên tạo video affiliate trending (mẹo vặt, nhân hoá đồ vật, kịch bản ngắn TikTok/Reels).
Nhiệm vụ: gợi ý objectToPersonify, tipContent, cải thiện kịch bản/scene, dialogue, visual prompt (tiếng Anh cho phần hình ảnh).
Trả lời súc tích, thực tế. Khi user cần cấu hình, có thể đưa ví dụ JSON ngắn gọn.`;

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface TrendingChatContext {
  objectToPersonify?: string;
  tipContent?: string;
  category?: string;
  mood?: string;
  language?: string;
  artStyle?: string;
  sceneCount?: number;
}

function buildContextNote(ctx?: TrendingChatContext): string {
  if (!ctx) return "";
  const lines: string[] = [];
  if (ctx.objectToPersonify) lines.push(`- objectToPersonify: ${ctx.objectToPersonify}`);
  if (ctx.tipContent) lines.push(`- tipContent: ${ctx.tipContent}`);
  if (ctx.category) lines.push(`- category: ${ctx.category}`);
  if (ctx.mood) lines.push(`- mood: ${ctx.mood}`);
  if (ctx.language) lines.push(`- language: ${ctx.language}`);
  if (ctx.artStyle) lines.push(`- artStyle: ${ctx.artStyle}`);
  if (ctx.sceneCount != null) lines.push(`- sceneCount: ${ctx.sceneCount}`);
  if (lines.length === 0) return "";
  return `\n\n*** CẤU HÌNH HIỆN TẠI ***\n${lines.join("\n")}`;
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content.trim() }],
  }));
}

export default [
  {
    method: "post",
    path: "/api/app/affiliate-chat-bot/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          messages?: ChatMessage[];
          context?: TrendingChatContext;
          textContext?: string;
          chatKind?: string;
        };

        const messages = (body.messages || []).filter(
          (m) =>
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string" &&
            m.content.trim().length > 0
        );

        if (messages.length === 0) {
          return res.status(400).json({ message: "Thiếu tin nhắn" });
        }

        const last = messages[messages.length - 1];
        if (last.role !== "user") {
          return res.status(400).json({ message: "Tin nhắn cuối phải từ người dùng" });
        }

        const trimmed = messages.slice(-MAX_MESSAGES).map((m) => ({
          role: m.role,
          content: m.content.slice(0, MAX_MESSAGE_CHARS),
        }));

        await checkRequestLimit(context.id);
        const clients = await getAvailableGeminiClients();

        const customPrompt = typeof body.textContext === "string" ? body.textContext.trim() : "";
        const baseInstruction = customPrompt || SYSTEM_INSTRUCTION;
        const systemText = baseInstruction + buildContextNote(body.context);

        const response = await callWithKeyRotation(
          clients,
          (ai) =>
            ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: toGeminiContents(trimmed),
              config: {
                systemInstruction: systemText,
                temperature: 0.7,
              },
            }),
          "affiliate-trending-chat"
        );

        const reply = (response.text || "").trim();
        if (!reply) {
          return res.status(502).json({ message: "AI không trả lời" });
        }

        await incrementRequestCount(context.id);
        res.json({ success: true, data: { reply } });
      } catch (err: any) {
        logger.error(`[affiliate-trending-chat] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
