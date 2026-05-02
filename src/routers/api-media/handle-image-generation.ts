import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken/apiMediaToken.model";
import { Context } from "../../libs/graphql";
import { retryAICall } from "../app/affiliate-scene/_shared";
import { processAndUploadImages } from "../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData } from "../helpers/validateApiKey";

/**
 * Xử lý logic generate image:
 * - Validate body & prompt
 * - Gọi Google Labs API tạo image (batchGenerateImages)
 * - Extract images từ response (fifeUrl → base64)
 * - Tăng usedQuantity sau khi thành công
 */
export async function handleImageGeneration(
  req: Request,
  res: Response,
  captchaData: CaptchaResponseData,
  tokenKey: string
): Promise<void> {
  const body = req.body as {
    prompt: string;
    images?: Array<
      | string // URL ảnh
      | { imageBytes: string; mimeType?: string } // base64
    >;
    config?: {
      aspectRatio?: "16:9" | "9:16";
    };
  };
  if (!body?.prompt) {
    res.status(400).json({ message: "Thiếu prompt" });
    return;
  }

  const context = new Context({ req });
  const uploadedImageNames = await processAndUploadImages(
    body.images || [],
    captchaData.accessToken,
    captchaData.ProjectID,
    context.id
  );

  // Tạo ảnh
  await callAisandboxImageAPI({
    res,
    prompt: body.prompt,
    aspectRatio: body.config?.aspectRatio,
    uploadedImageNames,
    recaptchaToken: captchaData.captcha,
    sessionId: captchaData.sessionId,
    projectId: captchaData.ProjectID,
    accessToken: captchaData.accessToken,
  });

  // Tăng usedQuantity sau khi generate image thành công (atomic $inc, tìm theo API key)
  await ApiMediaTokenModel.findOneAndUpdate({ key: tokenKey }, { $inc: { usedQuantity: 1 } });
}

interface CallAisandboxParams {
  res: Response;
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  uploadedImageNames?: string[];
  recaptchaToken: string;
  sessionId: string;
  projectId: string;
  accessToken: string;
  noText?: boolean;
}

/**
 * Gọi Aisandbox API: dispatch sang hàm xử lý phù hợp dựa trên số lượng ảnh.
 */
export async function callAisandboxImageAPI(params: CallAisandboxParams): Promise<void> {
  const { uploadedImageNames } = params;
  const imageCount = uploadedImageNames?.length || 0;
  if (imageCount === 0) {
    await callTextOnlyAPI(params);
  } else {
    await callImageToImageAPI(params);
  }
}

// ── Helpers dùng chung ──────────────────────────────────────────────────────

function mapAspectRatio(aspectRatio?: "16:9" | "9:16"): string {
  const input = aspectRatio || "9:16";
  return input === "16:9" ? "IMAGE_ASPECT_RATIO_LANDSCAPE" : "IMAGE_ASPECT_RATIO_PORTRAIT";
}
function buildClientContext(params: CallAisandboxParams) {
  return {
    projectId: params.projectId,
    tool: "PINHOLE",
    sessionId: params.sessionId,
    recaptchaContext: {
      token: params.recaptchaToken,
      applicationType: "RECAPTCHA_APPLICATION_TYPE_WEB",
    },
  };
}
async function sendAndParseResponse(
  res: Response,
  endpoint: string,
  payload: any,
  accessToken: string
): Promise<void> {
  const apiRes = await retryAICall(async () => {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      const err: any = new Error(`Google Labs API error ${resp.status}: ${errText}`);
      err.statusCode = resp.status;
      throw err;
    }
    return resp.json();
  }, "generation-image");

  // Extract images từ response Google Labs
  // Response trả về { media: [{ image: { generatedImage: { fifeUrl: "..." } } }] }

  const mediaItems = (apiRes as any)?.media || [];

  if (mediaItems.length === 0) {
    const err: any = new Error("Không nhận được ảnh từ Google Labs API");
    err.statusCode = 500;
    throw err;
  }

  // Fetch từng ảnh từ fifeUrl và convert sang base64
  const images = await Promise.all(
    mediaItems.map(async (item: any) => {
      const fifeUrl = item?.image?.generatedImage?.fifeUrl;
      if (fifeUrl) {
        // Fetch image binary từ Google Storage URL
        const imgResp = await fetch(fifeUrl);
        if (!imgResp.ok) {
          logger.warn(`[generation-image] Không thể fetch ảnh từ fifeUrl: ${imgResp.status}`);
          return { imageUrl: fifeUrl };
        }
        const imgBuffer = await imgResp.arrayBuffer();
        const base64 = Buffer.from(imgBuffer).toString("base64");
        const contentType = imgResp.headers.get("content-type") || "image/png";
        return {
          imageBytes: base64,
          mimeType: contentType,
          fifeUrl,
        };
      }
      // Fallback: trả về toàn bộ object
      return item;
    })
  );

  res.json({ success: true, data: images });
}

async function callTextOnlyAPI(params: CallAisandboxParams): Promise<void> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: {
      batchId,
    },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: {
          parts: [{ text: params.prompt }],
        },
        seed,
        imageInputs: [] as any,
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  await sendAndParseResponse(params.res, endpoint, payload, params.accessToken);
}

async function callImageToImageAPI(params: CallAisandboxParams): Promise<void> {
  const imageAspectRatio = mapAspectRatio(params.aspectRatio);
  const batchId = crypto.randomUUID();
  const seed = Math.floor(Math.random() * 1000000);
  const clientContext = buildClientContext(params);

  const payload = {
    clientContext,
    mediaGenerationContext: {
      batchId,
    },
    useNewMedia: true,
    requests: [
      {
        clientContext,
        imageModelName: "NARWHAL",
        imageAspectRatio,
        structuredPrompt: {
          parts: [{ text: params.prompt }],
        },
        seed,
        imageInputs: params.uploadedImageNames!.map((mediaId) => ({
          name: mediaId,
          imageInputType: "IMAGE_INPUT_TYPE_REFERENCE",
        })),
      },
    ],
  };

  const endpoint = `https://aisandbox-pa.googleapis.com/v1/projects/${params.projectId}/flowMedia:batchGenerateImages`;
  await sendAndParseResponse(params.res, endpoint, payload, params.accessToken);
}
