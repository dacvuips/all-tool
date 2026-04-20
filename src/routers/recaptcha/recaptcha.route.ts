import { Request, Response } from "express";
import { recaptchaTokenService } from "../../libs/dal/recaptchaToken";
import { ActionEnum } from "../app/affiliate-scene/_shared";
import { fetchCaptchaData, getApiSetting, validateApiKey } from "../helpers/validateApiKey";

export default [
  {
    method: "get",
    path: "/api/recaptcha",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: ActionEnum };

      // Validate apiKey & kiểm tra token hợp lệ
      const token = await validateApiKey(req, recaptchaTokenService);

      // Lấy links & captcha data
      const links = await getApiSetting("recaptcha-api-secret-key");
      const captchaData = await fetchCaptchaData({
        links,
        type,
        logPrefix: "recaptcha",
        token,
        tokenService: recaptchaTokenService,
      });

      res.json({
        reCaptchaToken: captchaData.captcha,
      });
    },
  },
];
