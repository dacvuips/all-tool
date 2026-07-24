/**
 * Chat AI gợi ý storyboard — Flow2 ChatGPT Conversation image (picture_v2).
 * POST /api/app/storyboard-ai-suggest/ — SSE stream (tránh Cloudflare/proxy 504 khi chờ lâu).
 *
 * Frontend chỉ gửi: prompt (ý tưởng ngắn) + sceneCount (+ conversationId/parentMessageId khi follow-up).
 * Prompt mẫu được ráp ở backend.
 * Gọi Flow2: mode=picture_v2, system_hints=["picture_v2"], picture=true.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  initGenerationSSE,
  sendGenerationSSEError,
} from "../../api-media/generation-sse";
import {
  callChatGPTPictureSuggest,
  checkImageLimit,
  checkRequestLimit,
  getChatGPTSceneModel,
  incrementImageCount,
  incrementRequestCount,
} from "./_shared";

const MAX_PROMPT_CHARS = 8000;
const SECONDS_PER_SCENE = 8;
const MAX_REFERENCE_IMAGES = 10;
const MAX_IMAGE_BASE64_CHARS = Math.ceil((10 * 1024 * 1024 * 4) / 3);

interface StoryboardReferenceImageInput {
  imageBytes?: string;
  mimeType?: string;
  name?: string;
}

function normalizeBase64Payload(data: string): string {
  const trimmed = data.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return match ? match[2] : trimmed;
}

function sanitizeReferenceImages(
  raw?: StoryboardReferenceImageInput[]
): Array<{ imageBytes: string; mimeType: string; fileName?: string }> {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: Array<{ imageBytes: string; mimeType: string; fileName?: string }> = [];
  for (const item of raw.slice(0, MAX_REFERENCE_IMAGES)) {
    const imageBytes = normalizeBase64Payload(
      typeof item?.imageBytes === "string" ? item.imageBytes : ""
    );
    if (!imageBytes) continue;
    if (imageBytes.length > MAX_IMAGE_BASE64_CHARS) {
      throw Object.assign(new Error("Ảnh tham chiếu quá lớn (tối đa ~10MB/ảnh)"), {
        statusCode: 400,
      });
    }
    out.push({
      imageBytes,
      mimeType: (typeof item.mimeType === "string" && item.mimeType.trim()) || "image/jpeg",
      fileName: typeof item.name === "string" ? item.name.trim() : undefined,
    });
  }
  return out;
}

const STORYBOARD_SUGGEST_TEMPLATE = `Bạn là chuyên gia viết kịch bản, đạo diễn sitcom phim, chuyên gia marketing, chuyên gia về phim ngắn

Negative prompt: tạo ảnh storyboard và chỉ xuất duy nhất 1 ảnh, không xuất text, tất cả các khung hình phân cảnh phải có kích thước giống nhau ,Đàm thoại (tên: thoại cho từng nhân vật) , hành động biểu cảm từng nhân vật (tên: hành động biểu cảm từng) , viết: text , đoàn thoại, bhành động biểu cảm, góc máy ngay trong từng phân cảnh trong ảnh storyboard 


Hãy viết 1 kịch bản sitcom phim quảng cáo về ({{USER_PROMPT}})
Mở đầu phải có hook để hút , dài {{DURATION_SECONDS}}s ( {{SCENE_COUNT}} phân cảnh ),khả năng viral cao, góc máy , 

`;

function clampSceneCount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.min(30, Math.max(1, Math.round(n)));
}

/** Ráp prompt mẫu storyboard từ ý tưởng user + số phân cảnh. */
export function buildStoryboardSuggestPrompt(userPrompt: string, sceneCount: number): string {
  const n = clampSceneCount(sceneCount);
  const durationSeconds = n * SECONDS_PER_SCENE;
  return STORYBOARD_SUGGEST_TEMPLATE.replace("{{USER_PROMPT}}", userPrompt.trim())
    .replace("{{DURATION_SECONDS}}", String(durationSeconds))
    .replace("{{SCENE_COUNT}}", String(n));
}

export default [
  {
    method: "post",
    path: "/api/app/storyboard-ai-suggest/",
    midd: [],
    action: async (req: Request, res: Response) => {
      let sseStarted = false;
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          sceneCount?: number;
          conversationId?: string;
          parentMessageId?: string;
          images?: StoryboardReferenceImageInput[];
        };

        const userPrompt = (body.prompt || "").trim().slice(0, MAX_PROMPT_CHARS);
        if (!userPrompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        const referenceImages = sanitizeReferenceImages(body.images);

        const sceneCount = clampSceneCount(body.sceneCount);
        const durationSeconds = sceneCount * SECONDS_PER_SCENE;

        await checkRequestLimit(context.id);
        await checkImageLimit(context.id);

        const hasConversation = Boolean(
          body.conversationId?.trim() && body.parentMessageId?.trim()
        );
        const hasPartialConversation = Boolean(
          (body.conversationId?.trim() && !body.parentMessageId?.trim()) ||
            (!body.conversationId?.trim() && body.parentMessageId?.trim())
        );
        if (hasPartialConversation) {
          return res.status(400).json({
            message: "Multi-turn cần cả conversationId và parentMessageId",
          });
        }

        const prompt = hasConversation
          ? userPrompt
          : buildStoryboardSuggestPrompt(userPrompt, sceneCount);

        logger.info(
          `[storyboard-ai-suggest] sceneCount=${sceneCount} followUp=${hasConversation} refImages=${referenceImages.length} user=${context.id}`
        );

        const storyboardModel = await getChatGPTSceneModel("STORYBOARD");

        // SSE sớm — proxy/Cloudflare không 504 khi chờ Conversation image lâu
        const send = initGenerationSSE(res);
        sseStarted = true;
        send({ type: "progress", progress: 3, message: "Đang bắt đầu AI gợi ý..." });

        const result = await callChatGPTPictureSuggest({
          prompt,
          label: "storyboard-ai-suggest",
          model: storyboardModel,
          conversationId: body.conversationId,
          parentMessageId: body.parentMessageId,
          images: referenceImages.length > 0 ? referenceImages : undefined,
          onProgress: async (progress, message) => {
            send({
              type: "progress",
              progress,
              message: message || "Đang tạo ảnh storyboard...",
            });
          },
        });

        if (!result.text && result.images.length === 0) {
          sendGenerationSSEError(res, "AI không trả lời", 502);
          return;
        }

        await incrementRequestCount(context.id);
        if (result.images.length > 0) {
          await incrementImageCount(context.id);
        }

        send({
          type: "done",
          progress: 100,
          message: "Hoàn tất",
          data: {
            reply: result.text || undefined,
            images: result.images.length > 0 ? result.images : undefined,
            sceneCount,
            durationSeconds,
            conversationId: result.conversationId,
            messageId: result.messageId,
          },
        });
        res.end();
      } catch (err: any) {
        logger.error(`[storyboard-ai-suggest] Lỗi: ${err?.message}`);
        if (sseStarted) {
          sendGenerationSSEError(
            res,
            err?.message || "Lỗi server",
            err?.statusCode || 500
          );
          return;
        }
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
