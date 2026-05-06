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
          productImages?: string[];
          productImagePrompt?: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
            noText?: boolean;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn ảnh trước khi tạo
        await checkImageLimit(context.id);
        // Build product image reference note to append to prompt
        const productImageUrls = body.productImages?.filter(Boolean) || [];
        const defaultProductImageNote = `\nQUAN TRỌNG: Có hình ảnh tham chiếu sản phẩm được đính kèm. Bạn PHẢI đưa TẤT CẢ sản phẩm vào CÙNG MỘT hình ảnh duy nhất. Mỗi sản phẩm phải giữ nguyên chính xác diện mạo, hình dáng, màu sắc, thương hiệu và bao bì như trong hình ảnh tham chiếu. Hãy sắp xếp tất cả sản phẩm một cách tự nhiên trong một bố cục thống nhất. Mỗi sản phẩm phải hiển thị rõ ràng và dễ nhận biết trong hình ảnh cuối cùng. Một số hình ảnh sản phẩm ngẫu nhiên phải được nhân vật cầm trên tay`;
        const productImageNote =
          productImageUrls.length > 0
            ? body.productImagePrompt
              ? `\n${body.productImagePrompt}`
              : defaultProductImageNote
            : "";

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
        } // Upload product images lên Google Labs nếu có
        let productImageNames: string[] = [];
        if (productImageUrls.length > 0) {
          productImageNames = await processAndUploadImages(
            productImageUrls,
            accessToken,
            projectId,
            context.id
          );
        }

        console.log("productImageUrls", uploadedImageNames);

        // Tạo payload theo cấu trúc Google Labs API

        const noTextStr = !body.config?.noText
          ? `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`
          : "";

        await callAisandboxImageAPI({
          res,
          prompt: `${body.prompt} ${productImageNote} ${noTextStr}`,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames: [...uploadedImageNames, ...productImageNames],
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
