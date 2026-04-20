import { Request, Response } from "express";
import { recaptchaTokenService } from "../../libs/dal/recaptchaToken";
import { ActionEnum } from "../app/affiliate-scene/_shared";
import { fetchCaptchaData, validateApiKey } from "../helpers/validateApiKey";

export default [
  {
    method: "get",
    path: "/api/recaptcha",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: ActionEnum };

      // Validate apiKey & kiểm tra token hợp lệ
      await validateApiKey(req, recaptchaTokenService);

      // Lấy links & captcha data
      const captchaData = await fetchCaptchaData({
        type,
        logPrefix: "recaptcha",
      });

      res.json({
        reCaptchaToken: captchaData.captcha,
      });
    },
  },
];
