import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  checkVideoLimit,
  getCustomerGeminiClient,
  incrementVideoCount,
  retryAICall,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/extend-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          video?: { uri?: string; videoBytes?: string; mimeType?: string };
          image?: { imageBytes: string; mimeType: string };
          config?: {
            aspectRatio?: string;
            generateAudio?: boolean;
          };
        };

        if (!body?.video) {
          return res.status(400).json({ message: "Thiếu video gốc để nối tiếp" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);

        const genAI = await getCustomerGeminiClient(context.id);

        logger.info(`[extend-video] Gọi Veo 3 fast (extend mode) cho user ${context.id}`);

        // Setup SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendSSE({ type: "progress", progress: 5, message: "Đang khởi tạo extend video..." });

        // Build config
        const generateConfig: any = {
          aspectRatio: body.config?.aspectRatio || "9:16",
          generateAudio: body.config?.generateAudio ?? true,
        };

        // Nếu có ảnh tham chiếu → thêm vào config.referenceImages
        if (body.image?.imageBytes) {
          generateConfig.referenceImages = [
            {
              image: {
                imageBytes: body.image.imageBytes,
                mimeType: body.image.mimeType || "image/png",
              },
              referenceType: "asset",
            },
          ];
        }

        // Use Veo 3 fast for extend mode
        const finalPrompt = body.prompt?.trim() || "Continue the scene naturally";

        const generateParams: any = {
          model: "veo-3-fast-generate",
          prompt: finalPrompt,
          config: generateConfig,
          video: body.video,
        };

        let operation = await retryAICall(
          () => genAI.models.generateVideos(generateParams),
          "extend-video"
        );

        sendSSE({
          type: "progress",
          progress: 15,
          message: "Đã gửi yêu cầu extend, đang chờ xử lý...",
        });

        // Poll until done
        const MAX_POLLS = 120; // max ~30 minutes (15s * 120)
        let pollCount = 0;
        while (!operation.done && pollCount < MAX_POLLS) {
          await new Promise((resolve) => setTimeout(resolve, 15000)); // 15s interval
          pollCount++;

          // Simulate progress: 15% → 90% linearly over polls
          const progress = Math.min(15 + Math.round((pollCount / MAX_POLLS) * 75), 90);
          sendSSE({
            type: "progress",
            progress,
            message: `Đang nối video... (${pollCount * 15}s)`,
          });

          try {
            operation = await genAI.operations.getVideosOperation({ operation: operation as any });
          } catch (pollErr: any) {
            logger.warn(`[extend-video] Poll error: ${pollErr?.message}`);
          }
        }

        if (!operation.done) {
          sendSSE({ type: "error", message: "Quá thời gian chờ nối video" });
          res.end();
          return;
        }

        sendSSE({ type: "progress", progress: 95, message: "Đang lấy kết quả..." });

        const generatedVideos = (operation as any).response?.generatedVideos || [];
        if (generatedVideos.length === 0) {
          sendSSE({ type: "error", message: "Không nhận được video nối từ API" });
          res.end();
          return;
        }

        const video = generatedVideos[0].video;
        const videoUri = video?.uri || null;
        const videoBytes = video?.videoBytes || null;

        // Nối video thành công → tăng videoCount
        await incrementVideoCount(context.id);

        sendSSE({
          type: "done",
          progress: 100,
          data: {
            videoUri,
            videoBytes,
            mimeType: video?.mimeType || "video/mp4",
          },
        });
        res.end();
      } catch (err: any) {
        logger.error(`[extend-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
          );
          res.end();
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
