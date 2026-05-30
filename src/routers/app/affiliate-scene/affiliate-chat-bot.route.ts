import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { TrendingModel } from "../../../libs/dal/trending/trending.model";
import { Context } from "../../../libs/graphql";
import {
  callWithKeyRotation,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
} from "./_shared";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
/** ~10MB ảnh / ~30MB video (ước lượng từ độ dài base64). */
const MAX_IMAGE_BASE64_CHARS = Math.ceil((10 * 1024 * 1024 * 4) / 3);
const MAX_VIDEO_BASE64_CHARS = Math.ceil((30 * 1024 * 1024 * 4) / 3);

const SYSTEM_INSTRUCTION = `Bạn là trợ lý AI chuyên tạo video affiliate trending (mẹo vặt, nhân hoá đồ vật, kịch bản ngắn TikTok/Reels).
Nhiệm vụ: gợi ý objectToPersonify, tipContent, cải thiện kịch bản/scene, dialogue, visual prompt (tiếng Anh cho phần hình ảnh).
Trả lời súc tích, thực tế. Khi user cần cấu hình, có thể đưa ví dụ JSON ngắn gọn.`;

type ChatRole = "user" | "assistant";
type ChatMediaKind = "image" | "video";

interface ChatMediaAttachment {
  kind: ChatMediaKind;
  mimeType: string;
  data: string;
}

interface ChatMessage {
  role: ChatRole;
  content: string;
  attachments?: ChatMediaAttachment[];
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

function normalizeBase64Payload(data: string): string {
  const trimmed = data.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return match ? match[2] : trimmed;
}

function sanitizeAttachments(raw?: ChatMediaAttachment[]): ChatMediaAttachment[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: ChatMediaAttachment[] = [];
  for (const item of raw.slice(0, MAX_ATTACHMENTS_PER_MESSAGE)) {
    if (item?.kind !== "image" && item?.kind !== "video") continue;
    const data = normalizeBase64Payload(typeof item.data === "string" ? item.data : "");
    if (!data) continue;

    const maxChars = item.kind === "video" ? MAX_VIDEO_BASE64_CHARS : MAX_IMAGE_BASE64_CHARS;
    if (data.length > maxChars) {
      throw Object.assign(
        new Error(
          item.kind === "video"
            ? "Video đính kèm quá lớn (tối đa ~30MB)"
            : "Ảnh đính kèm quá lớn (tối đa ~10MB)"
        ),
        { statusCode: 400 }
      );
    }

    const mimeType =
      (typeof item.mimeType === "string" && item.mimeType.trim()) ||
      (item.kind === "video" ? "video/mp4" : "image/png");

    out.push({ kind: item.kind, mimeType, data });
  }
  return out;
}

function messageHasPayload(m: ChatMessage): boolean {
  return Boolean(m.content?.trim()) || (m.attachments?.length ?? 0) > 0;
}

function buildGeminiParts(m: ChatMessage) {
  const parts: { text?: string; inlineData?: { data: string; mimeType: string } }[] = [];

  for (const att of m.attachments || []) {
    parts.push({
      inlineData: {
        data: att.data,
        mimeType: att.mimeType,
      },
    });
  }

  const text = m.content?.trim();
  if (text) parts.push({ text });

  return parts;
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: buildGeminiParts(m),
    }))
    .filter((m) => m.parts.length > 0);
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
          chatBotId?: string;
          chatKind?: string;
        };

        const chatBot = await TrendingModel.findById(body.chatBotId);
        if (!chatBot) {
          return res.status(400).json({ message: "Chatbot không tồn tại" });
        }

        const messages = (body.messages || [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as ChatRole,
            content: typeof m.content === "string" ? m.content : "",
            attachments: sanitizeAttachments(m.attachments),
          }))
          .filter(messageHasPayload);

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
          attachments: m.attachments,
        }));

        await checkRequestLimit(context.id);
        const clients = await getAvailableGeminiClients();

        const customPrompt = typeof chatBot.prompt === "string" ? chatBot.prompt.trim() : "";
        const baseInstruction = customPrompt || SYSTEM_INSTRUCTION;

        const response = await callWithKeyRotation(
          clients,
          (ai) =>
            ai.models.generateContent({
              model: "gemini-3.5-flash",
              contents: toGeminiContents(trimmed),
              config: {
                systemInstruction: baseInstruction,
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
