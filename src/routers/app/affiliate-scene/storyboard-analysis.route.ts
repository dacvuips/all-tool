import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  assertNonEmptyScenesArray,
  buildProductImageScriptNote,
  callChatGPTGateway,
  callGeminiJsonGenerate,
  checkRequestLimit,
  getChatGPTSceneModel,
  getGeminiSceneModel,
  incrementRequestCount,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
  normalizeSceneAudioField,
  resolveArtStylePrompt,
} from "./_shared";
import { StoryboardAnalysisOpenAIJsonSchema } from "./_chatgpt.constants";
import { StoryboardAnalysisResponseSchema } from "./storyboard-analysis.schema";

function buildStoryboardAnalysisPrompt(opts: {
  artStyle?: string;
  language?: string;
  aspectRatio?: string;
  tipContent?: string;
}): string {
  const artStyle = opts.artStyle || "Realistic";
  const language = opts.language || "Vietnamese";
  const aspectRatio = opts.aspectRatio || "9:16";
  const tipContent = opts.tipContent?.trim()
    ? `\nNội dung / thông điệp chính cần ưu tiên: ${opts.tipContent}`
    : "";

  return `
Bạn là chuyên gia Storyboard Analysis và AI Video Director.

Nhiệm vụ: Phân tích ẢNH STORYBOARD đính kèm (một hoặc nhiều panel/khung hình trong cùng một ảnh) và trả về kịch bản chi tiết cho từng phân cảnh.

QUY TẮC PHÁT HIỆN PHÂN CẢNH:
1. Xác định TẤT CẢ các panel/khung storyboard trong ảnh (có thể xếp dọc, ngang, hoặc lưới).
2. Sắp xếp theo thứ tự đọc tự nhiên: trên → dưới, trái → phải.
3. Số phân cảnh = số panel thực tế trong ảnh (KHÔNG tự ý thêm hoặc bớt).
4. Mỗi panel phải có cropRegion chính xác (bounding box) bao trọn panel đó.

QUY TẮC cropRegion (QUAN TRỌNG – dùng để cắt ảnh bằng JavaScript Canvas):
- Tất cả giá trị x, y, width, height là TỶ LỆ CHUẨN HOÁ từ 0 đến 1 so với kích thước ảnh gốc.
- x, y = góc trên-trái của panel.
- width, height = chiều rộng / chiều cao của panel.
- Không chồng lấn giữa các panel. Không cắt mất nội dung panel.

THÔNG TIN BỔ SUNG:
- Phong cách nghệ thuật: ${artStyle}
- Tỉ lệ khung hình mục tiêu: ${aspectRatio}
- Ngôn ngữ lời thoại: ${language}${tipContent}

CHO MỖI PHÂN CẢNH, trả về:
- sceneNumber: số thứ tự (1, 2, 3, ...)
- cropRegion: vùng cắt chuẩn hoá
- camera: góc máy gợi ý
- dialogue: lời thoại/narration bằng ${language} – suy ra từ nội dung panel hoặc sáng tạo phù hợp
- motionPrompt: mô tả chuyển động bằng tiếng Anh
- audio: metadata giọng đọc cho phân cảnh (giới tính, tính cách, nhịp điệu) bằng ${language}
- visualDescription: mô tả khung hình tĩnh bằng tiếng Anh, phong cách ${artStyle}

CHO TOÀN VIDEO:
- voiceGender: male hoặc female
- voiceTone: tính cách giọng đọc
- voiceStyle: phong cách đọc
- voicePacing: nhịp điệu đọc (fast / moderate / slow)
- audioPrompt: prompt casting giọng đọc đầy đủ bằng tiếng Anh
- topicTitle: tiêu đề video bằng ${language}

Trả về JSON hợp lệ theo schema đã định nghĩa.
`;
}

export default [
  {
    method: "post",
    path: "/api/app/storyboard-analysis/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          storyboardImageBase64: string;
          mimeType?: string;
          artStyle?: string;
          artStyleId?: string;
          language?: string;
          aspectRatio?: string;
          tipContent?: string;
          productImages?: string[];
        };

        if (!body?.storyboardImageBase64) {
          return res.status(400).json({ message: "Thiếu ảnh storyboard (storyboardImageBase64)" });
        }

        await checkRequestLimit(context.id);

        const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
          artStyleId: body.artStyleId,
          artStyle: body.artStyle,
        });

        const artStyle = resolvedArtStylePrompt || body.artStyle;
        const productImageNote = buildProductImageScriptNote(body.productImages || []);

        const text =
          buildStoryboardAnalysisPrompt({
            artStyle,
            language: body.language,
            aspectRatio: body.aspectRatio,
            tipContent: body.tipContent,
          }) + productImageNote;

        const mimeType = body.mimeType || "image/png";

        const aiProvider = await resolveAiSceneProvider();
        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: await getGeminiSceneModel("STORYBOARD"),
            text,
            media: [{ imageBytes: body.storyboardImageBase64, mimeType }],
            label: "storyboard-analysis",
            responseSchema: StoryboardAnalysisResponseSchema,
            temperature: 0.3,
          });
        } else {
          responseText = await callChatGPTGateway({
            text,
            images: [{ imageBytes: body.storyboardImageBase64, mimeType }],
            label: "storyboard-analysis",
            model: await getChatGPTSceneModel("STORYBOARD"),
            jsonSchema: StoryboardAnalysisOpenAIJsonSchema,
            jsonSchemaName: "storyboard_analysis_response",
            temperature: 0.3,
          });
        }
        const parsed = parseGeminiJsonResponse(responseText) as any;
        assertNonEmptyScenesArray(parsed.scenes);

        const normalizedScenes = parsed.scenes.map((scene: any, index: number) => ({
          sceneNumber: scene.sceneNumber ?? index + 1,
          cropRegion: {
            x: clamp01(scene.cropRegion?.x ?? 0),
            y: clamp01(scene.cropRegion?.y ?? 0),
            width: clamp01(scene.cropRegion?.width ?? 1),
            height: clamp01(scene.cropRegion?.height ?? 1),
          },
          camera: scene.camera || "WIDE SHOT",
          dialogue: scene.dialogue || "",
          motionPrompt: scene.motionPrompt || "",
          audio: normalizeSceneAudioField(scene.audio),
          visualDescription: scene.visualDescription || "",
        }));

        await incrementRequestCount(context.id);
        res.json({
          success: true,
          data: {
            topicTitle: parsed.topicTitle || "",
            voiceGender: parsed.voiceGender || "female",
            voiceTone: parsed.voiceTone || "",
            voiceStyle: parsed.voiceStyle || "",
            voicePacing: parsed.voicePacing || "moderate",
            audioPrompt: parsed.audioPrompt || "",
            scenes: normalizedScenes,
          },
        });
      } catch (err: any) {
        logger.error(`[storyboard-analysis] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
