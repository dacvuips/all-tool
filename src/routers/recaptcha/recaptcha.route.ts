import { Request, Response } from "express";
import { ActionEnum } from "../app/affiliate-scene/_shared";

export default [
  {
    method: "get",
    path: "/api/recaptcha",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: ActionEnum };

      // throw error 501
      throw new Error(
        "The system is currently undergoing maintenance. Please try again later, or contact the administrator for further assistance"
      );

      // // Validate apiKey & kiểm tra token hợp lệ
      // await validateApiKey(req, recaptchaTokenService);

      // // Lấy links & captcha data
      // const captchaData = await fetchCaptchaData({
      //   type,
      //   logPrefix: "recaptcha",
      // });

      // res.json({
      //   reCaptchaToken: captchaData.captcha,
      // });
    },
  },
];
