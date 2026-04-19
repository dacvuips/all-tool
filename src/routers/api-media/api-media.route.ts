import { Request, Response } from "express";
import { apiMediaTokenService } from "../../libs/dal/apiMediaToken";
import { validateApiKey, getApiSetting, fetchCaptchaData } from "../helpers/validateApiKey";

export default [
  {
    method: "get",
    path: "/api/api-media",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: string };

      // Validate apiKey & kiểm tra token hợp lệ
      const token = await validateApiKey(req, apiMediaTokenService);

      // Lấy links & captcha data
      const links = await getApiSetting("recaptcha-api-secret-key");
      const captchaData = await fetchCaptchaData({
        links,
        type,
        logPrefix: "api-media",
        token,
        tokenService: apiMediaTokenService,
      });

      res.json({
        reCaptchaToken: captchaData.captcha,
      });
    },
  },
];
