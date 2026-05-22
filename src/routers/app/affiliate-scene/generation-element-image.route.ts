import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callImageToImageAPI } from "../../api-media/handle-image-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { fetchCaptchaData } from "../../helpers/validateApiKey";
import { ActionEnum, checkImageLimit, incrementImageCount, resolveArtStylePrompt } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-element-image/",
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
          aspectRatio?: "16:9" | "9:16";
          noText?: boolean;
          artStyleId?: string;
          artStyle?: string;
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
          Headers,
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

        const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
          await resolveArtStylePrompt({
            artStyleId: body.artStyleId,
            artStyle: body.artStyle,
          });
        if (resolvedArtStylePrompt && resolvedArtStyleName === body.artStyle) {
          body.artStyle = resolvedArtStylePrompt;
        }

        const noTextStr = !body?.noText
          ? `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`
          : "";
        const params = {
          res,
          prompt: `${body.artStyle} ${body.prompt} ${noTextStr}`,
          aspectRatio: body.aspectRatio,
          uploadedImageNames: uploadedImageNames,
          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
          headers: Headers,
        };
        await callImageToImageAPI(params);

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
