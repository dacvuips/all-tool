import { Request, Response } from "express";
import { recaptchaTokenService } from "../../libs/dal/recaptchaToken";
import { settingService } from "../../libs/dal/setting";

interface RecaptchaResponseData {
  url: string;
  apiKey: string;
}

interface RecaptchaAPISetting {
  link: RecaptchaResponseData[];
}

export default [
  {
    method: "get",
    path: "/api/recaptcha",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: string };
      const apiKey = req.headers["x-api-key"] as string | undefined;

      // Validate apiKey
      if (!apiKey) {
        const err: any = new Error("Thiếu x-api-key");
        err.statusCode = 400;
        throw err;
      }

      // Kiểm tra token hợp lệ
      const token = await recaptchaTokenService.findOne({ key: apiKey, active: true });
      if (!token) {
        const err: any = new Error("API Key không hợp lệ");
        err.statusCode = 401;
        throw err;
      }
      if (!token.active) {
        const err: any = new Error("API Key đã bị vô hiệu hóa");
        err.statusCode = 403;
        throw err;
      }
      if (token.expiredDate && new Date(token.expiredDate) < new Date()) {
        const err: any = new Error("API Key đã hết hạn");
        err.statusCode = 403;
        throw err;
      }
      if (
        token.requestQuantity != null &&
        token.usedQuantity != null &&
        token.usedQuantity >= token.requestQuantity
      ) {
        const err: any = new Error("Đã hết lượt sử dụng. Vui lòng nâng cấp gói.");
        err.statusCode = 429;
        throw err;
      }

      // Lấy cấu hình API captcha từ setting
      const setting = await settingService.findOne({ key: "recaptcha-api-secret-key" });
      const settingValue = setting?.value as RecaptchaAPISetting | undefined;

      if (!settingValue?.link || settingValue.link.length === 0) {
        const err: any = new Error("Chưa cấu hình API captcha");
        err.statusCode = 500;
        throw err;
      }

      // Shuffle danh sách link ngẫu nhiên rồi thử lần lượt
      const links = [...settingValue.link];
      for (let i = links.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [links[i], links[j]] = [links[j], links[i]];
      }

      let captchaData: {
        accessToken: string;
        captcha: string;
        ProjectID: string;
        Gmail: string;
        sessionId: string;
        Seed: string;
      } = null;
      let lastError: any = null;

      for (const selectedLink of links) {
        try {
          const captchaUrl = type ? `${selectedLink.url}?action=${type}` : selectedLink.url;

          const headers: Record<string, string> = {};
          if (selectedLink.apiKey) {
            headers["X-API-Key"] = selectedLink.apiKey;
          }

          const captchaResp = await fetch(captchaUrl, { headers });

          if (!captchaResp.ok) {
            const errText = await captchaResp.text();
            throw new Error(`Captcha API error ${captchaResp.status}: ${errText}`);
          }

          captchaData = await captchaResp.json();
          break; // Thành công, thoát vòng lặp
        } catch (err: any) {
          lastError = err;
          console.warn(
            `[recaptcha] Link ${selectedLink.url} thất bại: ${err.message}. Thử link tiếp theo...`
          );
          continue;
        }
      }

      if (!captchaData) {
        const err: any = new Error(
          `Tất cả hệ thống captcha hiện tại không khả dụng. Vui lòng thử lại sau ít phút.`
        );
        err.statusCode = 502;
        throw err;
      }

      // Tăng usedQuantity
      await recaptchaTokenService.updateOne(token._id, {
        usedQuantity: (token.usedQuantity || 0) + 1,
      });

      return {
        reCaptchaToken: captchaData.captcha,
      };
    },
  },
];
