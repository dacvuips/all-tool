import { Request, Response } from "express";
import { ActionEnum } from "../app/affiliate-scene/_shared";

export default [
  {
    method: "get",
    path: "/api/api-media",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: ActionEnum };

      // throw error 501
      throw new Error(
        "The system is currently undergoing maintenance. Please try again later, or contact the administrator for further assistance."
      );
      // // Validate apiKey & kiểm tra token hợp lệ
      // const token = await validateApiKey(req, apiMediaTokenService);

      // const captchaData = await fetchCaptchaData({
      //   type,
      //   logPrefix: "api-media",
      // });
      // if (type === ActionEnum.VIDEO_GENERATION) {
      //   return handleVideoGeneration(req, res, captchaData, token.key);
      // }
      // if (type === ActionEnum.IMAGE_GENERATION) {
      //   return handleImageGeneration(req, res, captchaData, token.key);
      // }
    },
  },
];
