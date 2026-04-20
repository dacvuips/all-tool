import { Request, Response } from "express";
import { apiMediaTokenService } from "../../libs/dal/apiMediaToken";
import { ActionEnum } from "../app/affiliate-scene/_shared";
import { fetchCaptchaData, validateApiKey } from "../helpers/validateApiKey";
import { handleVideoGeneration } from "./handle-video-generation";

export default [
  {
    method: "get",
    path: "/api/api-media",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { type } = req.query as { type?: ActionEnum };

      // Validate apiKey & kiểm tra token hợp lệ
      const token = await validateApiKey(req, apiMediaTokenService);

      const captchaData = await fetchCaptchaData({
        type,
        logPrefix: "api-media",
      });
      if (type === ActionEnum.VIDEO_GENERATION) {
        return handleVideoGeneration(req, res, captchaData, token.key);
      }
      if (type === ActionEnum.IMAGE_GENERATION) {
      }
    },
  },
];
