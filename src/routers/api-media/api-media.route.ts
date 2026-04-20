import { Request, Response } from "express";
import { apiMediaTokenService } from "../../libs/dal/apiMediaToken";
import { ActionEnum } from "../app/affiliate-scene/_shared";
import { fetchCaptchaData, getApiSetting, validateApiKey } from "../helpers/validateApiKey";
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

      // Lấy links & captcha data
      const links = await getApiSetting("recaptcha-api-secret-key");
      const captchaData = await fetchCaptchaData({
        links,
        type,
        logPrefix: "api-media",
        token,
        tokenService: apiMediaTokenService,
      });
      if (type === ActionEnum.VIDEO_GENERATION) {
        return handleVideoGeneration(req, res, captchaData, token.key);
      }
      if (type === ActionEnum.IMAGE_GENERATION) {
      }
    },
  },
];
