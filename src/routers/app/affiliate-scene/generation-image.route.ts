import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callAisandboxImageAPI } from "../../api-media/handle-image-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { fetchCaptchaData } from "../../helpers/validateApiKey";
import { ActionEnum, checkImageLimit, incrementImageCount } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          images?: Array<
            | string // URL ảnh
            | { imageBytes: string; mimeType?: string } // base64
          >;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
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
          ProjectID: projectId,
          accessToken,
        } = await fetchCaptchaData({
          type: ActionEnum.IMAGE_GENERATION,
          logPrefix: "generation-image",
        });

        // Upload ảnh lên Google Labs trước nếu có
        let uploadedImageNames: string[] = [];
        if (body.images?.length > 0) {
          uploadedImageNames = await processAndUploadImages(
            body.images || [],
            accessToken,
            projectId,
            context.id
          );
        }

        // Tạo payload theo cấu trúc Google Labs API
        console.log(body.config?.aspectRatio);
        await callAisandboxImageAPI({
          res,
          prompt: body.prompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
        });

        // Tạo ảnh thành công → tăng imageCount
        await incrementImageCount(context.id);
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
