import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  checkImageLimit,
  getReCaptchaCredentials,
  incrementImageCount,
  retryAICall,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        const endPoint = "https://aisandbox-pa.googleapis.com/v1/projects";
        const params = "flowMedia:batchGenerateImages";
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const imageModelName = "NARWHAL";
        const body = req.body as {
          prompt: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: string;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn ảnh trước khi tạo
        await checkImageLimit(context.id);

        // Lấy captcha + credentials từ Cliproxy API
        const {
          captcha: recaptchaToken,
          sessionId,
          projectId,
          accessToken,
        } = await getReCaptchaCredentials("IMAGE_GENERATION");

        // Map aspectRatio sang format Google Labs
        const aspectRatioInput = body.config?.aspectRatio || "9:16";
        let imageAspectRatio = "IMAGE_ASPECT_RATIO_LANDSCAPE";
        if (aspectRatioInput === "16:9" || aspectRatioInput === "landscape") {
          imageAspectRatio = "IMAGE_ASPECT_RATIO_LANDSCAPE";
        } else if (aspectRatioInput === "1:1" || aspectRatioInput === "square") {
          imageAspectRatio = "IMAGE_ASPECT_RATIO_SQUARE";
        } else if (aspectRatioInput === "9:16" || aspectRatioInput === "portrait") {
          imageAspectRatio = "IMAGE_ASPECT_RATIO_PORTRAIT";
        }

        // Tạo payload theo cấu trúc Google Labs API
        const numberOfImages = body.config?.numberOfImages || 1;
        const batchId = crypto.randomUUID();

        const clientContext = {
          recaptchaContext: {
            token: recaptchaToken,
            applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
          },
          projectId,
          tool: "PINHOLE",
          sessionId,
        };

        // Build inner requests array (one per image)
        const imageRequests: any[] = [];
        for (let i = 0; i < numberOfImages; i++) {
          const seed = Math.floor(Math.random() * 1000000);
          imageRequests.push({
            clientContext,
            imageModelName,
            imageAspectRatio,
            structuredPrompt: {
              parts: [{ text: body.prompt }],
            },
            seed,
            imageInputs: [],
          });
        }

        // Top-level payload for batchGenerateImages
        const payload = {
          clientContext,
          mediaGenerationContext: {
            batchId,
          },
          useNewMedia: true,
          requests: imageRequests,
        };

        const endpoint = `${endPoint}/${projectId}/${params}`;
        const response = await retryAICall(async () => {
          const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const errText = await resp.text();
            const err: any = new Error(`Google Labs API error ${resp.status}: ${errText}`);
            err.statusCode = resp.status;
            throw err;
          }
          return resp.json();
        }, "generation-image");

        // Extract images từ response Google Labs
        // Response trả về { media: [{ image: { generatedImage: { fifeUrl: "..." } } }] }

        const mediaItems = (response as any)?.media || [];

        if (mediaItems.length === 0) {
          const err: any = new Error("Không nhận được ảnh từ Google Labs API");
          err.statusCode = 500;
          throw err;
        }

        // Fetch từng ảnh từ fifeUrl và convert sang base64
        const images = await Promise.all(
          mediaItems.map(async (item: any) => {
            const fifeUrl = item?.image?.generatedImage?.fifeUrl;
            if (fifeUrl) {
              // Fetch image binary từ Google Storage URL
              const imgResp = await fetch(fifeUrl);
              if (!imgResp.ok) {
                logger.warn(`[generation-image] Không thể fetch ảnh từ fifeUrl: ${imgResp.status}`);
                return { imageUrl: fifeUrl };
              }
              const imgBuffer = await imgResp.arrayBuffer();
              const base64 = Buffer.from(imgBuffer).toString("base64");
              const contentType = imgResp.headers.get("content-type") || "image/png";
              return {
                imageBytes: base64,
                mimeType: contentType,
              };
            }
            // Fallback: trả về toàn bộ object
            return item;
          })
        );

        // Tạo ảnh thành công → tăng imageCount
        await incrementImageCount(context.id);

        res.json({ success: true, data: images });
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
