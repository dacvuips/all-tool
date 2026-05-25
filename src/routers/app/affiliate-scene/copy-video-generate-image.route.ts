import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callAisandboxImageAPI } from "../../api-media/handle-image-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { fetchCaptchaData } from "../../helpers/validateApiKey";
import {
  ActionEnum,
  buildImageReferenceNotes,
  checkImageLimit,
  filterReferenceImages,
  incrementImageCount,
  ReferenceImageInput,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/copy-video-generate-image/",
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
          productImages?: string[];
          objectToPersonifyImages?: ReferenceImageInput[];
          productImagePrompt?: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
          };
          noText?: boolean;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn ảnh trước khi tạo
        await checkImageLimit(context.id);

        // Build product image reference note to append to prompt
        const productImageUrls = body.productImages?.filter(Boolean) || [];
        const personifyImageRefs = filterReferenceImages(body.objectToPersonifyImages);
        const imageReferenceNote = buildImageReferenceNotes({
          productUrls: productImageUrls,
          productCustomPrompt: body.productImagePrompt,
          personifyImages: personifyImageRefs,
        });

        // Tạo payload theo cấu trúc Google Labs API

        const noTextStr = !body.noText
          ? `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`
          : "";

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

        // Upload product images lên Google Labs nếu có
        let productImageNames: string[] = [];
        if (productImageUrls.length > 0) {
          productImageNames = await processAndUploadImages(
            productImageUrls,
            accessToken,
            projectId,
            context.id
          );
        }
        let personifyImageNames: string[] = [];
        if (personifyImageRefs.length > 0) {
          logger.info(
            `[copy-video-generate-image] Upload ${personifyImageRefs.length} ảnh nhân hoá đồ vật (user ${context.id})`
          );
          personifyImageNames = await processAndUploadImages(
            personifyImageRefs,
            accessToken,
            projectId,
            context.id
          );
        } else if (body.objectToPersonifyImages?.length) {
          logger.warn(
            `[copy-video-generate-image] objectToPersonifyImages có ${body.objectToPersonifyImages.length} phần tử nhưng không có imageBytes hợp lệ`
          );
        }

        await callAisandboxImageAPI({
          res,
          prompt: `${body.prompt} ${imageReferenceNote} ${noTextStr}`,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames: [...personifyImageNames, ...uploadedImageNames, ...productImageNames],

          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
          headers: Headers,
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
