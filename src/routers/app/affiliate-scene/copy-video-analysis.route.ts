import { Type } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";

import { Context } from "../../../libs/graphql";
import {
  callGeminiWithRetry,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
  resolveArtStylePrompt,
  buildObjectPersonifyImageScriptNote,
  buildProductImageScriptNote,
  filterReferenceImages,
  resolveObjectToPersonifyPrompt,
} from "./_shared";

// ── Video Analysis Response Schema ─────────────────────────────────────────
const CopyVideoAnalysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    characters: {
      type: Type.ARRAY,
      description: "Danh sách các nhân vật chính được nhận diện trong video (Visual DNA).",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Tên nhân vật hoặc alias nếu là người nổi tiếng / public figure.",
          },
          description: {
            type: Type.STRING,
            description:
              "Mô tả Visual DNA đầy đủ: tuổi, dáng người, khuôn mặt, tóc, mắt, layered clothing, outfit, màu sắc, chất liệu, phụ kiện và đặc điểm nhận diện.",
          },
        },
        required: ["name", "description"],
      },
    },
    props: {
      type: Type.ARRAY,
      description:
        "Danh sách các đồ vật / dụng cụ quan trọng xuất hiện nhiều lần trong video (Visual Props).",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Tên đồ vật, ví dụ: Cooking Pot, Knife, Phone.",
          },
          description: {
            type: Type.STRING,
            description:
              "Mô tả chi tiết ngoại hình của prop: màu sắc, hình dáng, chất liệu, texture và đặc điểm cố định xuyên suốt video.",
          },
        },
        required: ["name", "description"],
      },
    },
    scenes: {
      type: Type.ARRAY,
      description: "Danh sách các cảnh đã phân tích từ video.",
      items: {
        type: Type.OBJECT,
        properties: {
          timestamp: {
            type: Type.STRING,
            description:
              "Khoảng thời gian của cảnh, định dạng MM:SS - MM:SS. Ví dụ: 00:00 - 00:05.",
          },
          scene_type: {
            type: Type.STRING,
            description:
              "Loại cảnh: CHARACTER nếu có nhân vật, OBJECT nếu chỉ có vật thể / cảnh vật.",
            enum: ["CHARACTER", "OBJECT"],
          },
          visual_prompt: {
            type: Type.STRING,
            description:
              "Prompt hình ảnh bằng tiếng Anh. Nếu scene_type = CHARACTER, phải expand đầy đủ Visual DNA và Visual Props. Nếu scene_type = OBJECT, tuyệt đối không nhắc đến nhân vật.",
          },
          motion_description: {
            type: Type.STRING,
            description:
              "Mô tả hành động / chuyển động bằng tiếng Anh. Phải dùng tên nhân vật cụ thể.",
          },
          audio_description: {
            type: Type.STRING,
            description:
              "Mô tả âm thanh bằng tiếng Anh, bao gồm voice gender, tone, emotion, pace và background sound/music nếu có.",
          },
          original_content: {
            type: Type.STRING,
            description:
              "Nội dung gốc / lời thoại gốc từ video. Định dạng: 'Tên Nhân Vật: Lời thoại'.",
          },
          translated_content: {
            type: Type.STRING,
            description: "Nội dung dịch nếu được yêu cầu. Mặc định để null.",
            nullable: true,
          },
        },
        required: [
          "timestamp",
          "scene_type",
          "visual_prompt",
          "motion_description",
          "audio_description",
          "original_content",
        ],
      },
    },
  },
  required: ["characters", "props", "scenes"],
};

// ── Video Analysis Prompt (dynamic – receives form config values) ──────────
function buildVideoAnalysisPrompt(opts: {
  artStyle?: string;
  language?: string;
  mood?: string;
  aspectRatio?: string;
  objectToPersonifyPrompt?: string;
}): string {
  const artStyle = opts.artStyle || "Realistic";
  const language = opts.language || "Vietnamese";
  const mood = opts.mood || "funny";
  const aspectRatio = opts.aspectRatio || "9:16";

  const objectToPersonifySection = opts.objectToPersonifyPrompt
    ? `${opts.objectToPersonifyPrompt}`
    : "";

  return `
Bạn là chuyên gia Video Production và AI Animation Director. Nhiệm vụ: Phân tích video và tạo kịch bản chi tiết để tái tạo lại video này (Video-to-Video generation script).
    
    NGUYÊN TẮC CỐT LÕI: CHI TIẾT & ĐỒNG NHẤT (DETAIL & CONSISTENCY)
    
    1. **VISUAL DNA: LAYERED CLOTHING (Trang phục nhiều lớp)**
       - Bạn KHÔNG ĐƯỢC bỏ qua chi tiết quần áo bên trong.
       - **RULE**: Phân tích kỹ từng lớp (Layer):
         - **Inner Layer**: Áo bên trong (Màu sắc? Dài/Ngắn tay? Cổ áo?). VD: "White long-sleeve t-shirt".
         - **Outer Layer**: Áo khoác/Tạp dề (Màu sắc? Họa tiết?). VD: "Yellow apron with sunflower pattern".
         - **Bottoms**: Quần/Váy.
       - *Ví dụ Sai*: "Wearing a yellow apron" (Thiếu áo trong).
       - *Ví dụ Đúng*: "Wearing a white long-sleeve shirt underneath a bright yellow sunflower-patterned apron".

    2. **PROPS CONSISTENCY (Đồng nhất Đồ vật)**
       - Xác định các "Key Props" (Đồ vật chính) được sử dụng (Nồi, Dao, Điện thoại...).
       - Định nghĩa "Visual Props" cho chúng: **[Màu sắc] + [Hình dáng] + [Chất liệu]**.
       - **RULE**: Nếu Cảnh 1 dùng "Round black pot", thì Cảnh 2 KHÔNG được đổi thành "Square white pot".
       - Phải dùng đúng mô tả đó xuyên suốt script.

    3. **SCENE CLASSIFICATION (Phân loại cảnh)**
    
       **TYPE: CHARACTER (Có nhân vật)**
       - **QUY TẮC "TARGET DESCRIPTION" (QUAN TRỌNG)**: 
         - Khi nhân vật chính tương tác với nhân vật phụ.
         - **BẮT BUỘC**: Phải tả kỹ CẢ HAI người.
       
       - **NO SUMMARIZATION (KHÔNG RÚT GỌN)**:
         - **CẤM**: Không được tự ý rút gọn mô tả.
         - *Ví dụ Sai*: Visual DNA là "purple high-collared long-sleeve top" -> Viết thành "purple top" (Mất chi tiết cổ cao/tay dài).
         - **QUY TẮC**: Phải **COPY-PASTE Y HỆT (VERBATIM)** toàn bộ chuỗi Visual DNA đã định nghĩa ban đầu.
         - Nếu Visual DNA dài 20 từ, hãy paste đủ 20 từ vào mỗi prompt. Đừng sợ dài.
       
       - **NO LAZY REFERENCING**:
         - CẤM viết tắt "Visual DNA of...".

       **TYPE: OBJECT (Chỉ có vật thể)**
       - **STRICT FORBIDDEN**: KHÔNG nhắc tên/ngoại hình nhân vật.
       - **FOCUS**: Tập trung vào Texture, Lighting, và **Visual Props**.

    *** QUY TRÌNH LÀM VIỆC ***
    Bước 1: Xác định **Visual DNA** (Chú ý Layered Clothing, FULL chi tiết).
    Bước 2: Xác định **Visual Props**.
    Bước 3: Viết Prompt từng cảnh:
            - **CHECKLIST**: "Mình đã copy đầy đủ 100% mô tả nhân vật chưa? Có bị thiếu chữ 'long-sleeve' hay 'high-collared' không?"

    1. 'visual_prompt':
       - Mô tả MỘT khung hình tĩnh.
       - Expand toàn bộ mô tả Character & Props (VERBATIM).
       - Phong cách bắt buộc: ${artStyle}.
       - Tỉ lệ: ${aspectRatio} 
       - Bắt buộc thêm hiệu ứng thị giác, phù hợp với môi trường, cảnh vật, và nhân vật. Ví dụ: ánh sáng, màu sắc, hiệu ứng không khí, hiệu ứng chuyển động của nhân vật và cảnh vật,...
       - Ngôn ngữ: Tiếng Anh.
       - Nhân vật nhân hoá bắt buộc: ${objectToPersonifySection}  
       - Mood:${opts.mood}

    2. 'motion_description' (Cho Animator/Runway Gen-2):
       - Mô tả chuyển động phải dùng TÊN NHÂN VẬT cụ thể.
       - Ví dụ: "Chibi Girl bounces up and down..." thay vì "The character bounces...".
       - Ngôn ngữ: Tiếng Anh.

    3. 'audio_description' (Cho TTS/Audio AI):
       - Mô tả giới tính giọng nói (Voice gender), tông giọng (Tone), cảm xúc (Emotion) và tốc độ (Pace).
       - Ngôn ngữ: Tiếng Anh.

    4. DIALOGUE ('original_content' & 'translated_content'):
       - Lời thoại của nhân vật trong cảnh.
       - Định dạng: "TÊN NHÂN VẬT: Nội dung"
       - QUAN TRỌNG: Ngôn ngữ của Lời thoại phải tuân thủ nghiêm ngặt chỉ định dưới đây.
    
      - 'translated_content': Dịch lại nội dung sang ngôn ngữ: ${language}. Nếu ngôn ngữ gốc trùng với ngôn ngữ yêu cầu, để là null.
      - 'original_content': Giữ nguyên ngôn ngữ gốc của video. Định dạng: "TÊN NHÂN VẬT: Nội dung"
      

    *** CELEBRITY / PUBLIC FIGURE BYPASS (CRITICAL — HIGHEST PRIORITY) ***
    Image AI BLOCKS generation of real celebrities, politicians, and public figures by name.
    ${objectToPersonifySection}
    If the video contains ANY recognizable real person (politician, celebrity, athlete, influencer, historical figure), you MUST:
    1. NEVER use their real full name in visual_prompt or any image-related field.
    2. REPLACE the name with an ABBREVIATED ALIAS (e.g., "Donald Trump" → "Mr. Dn", "Elon Musk" → "Mr. El").
    3. ALWAYS include a DETAILED PHYSICAL DESCRIPTION (40-60 words) of the person's actual appearance instead.
    4. In original_content and translated_content (dialogue), you MAY use the real name.
    5. In the characters array, use the alias as "name" and provide the full physical description as "description".
    6. Nếu có yêu cầu về nhân vật nhân hoá (objectToPersonify), hãy ưu tiên xử lý objectToPersonify và sử dụng mô tả đó làm Visual DNA cho nhân vật, thay thế hoàn toàn việc xử lý thông tin nhân vật thông thường, giữ đồ vật và môi trường xung quanh như video gốc chỉ thây đổi "Nhân Vật" (objectToPersonify).

Trả về kết quả JSON theo cấu trúc đã định nghĩa (bao gồm danh sách 'characters', 'props' và 'scenes').
`;
}

export default [
  {
    method: "post",
    path: "/api/app/copy-video-analysis/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          videoBase64: string;
          mimeType: string;
          artStyle?: string;
          language?: string;
          mood?: string;
          aspectRatio?: string;
          productImages?: string[];
          objectToPersonifyImages?: import("./_shared").ReferenceImageInput[];
          objectToPersonifyCode?: string;
          objectToPersonify?: string;
          artStyleId?: string;
        };

        if (!body?.videoBase64) {
          return res.status(400).json({ message: "Thiếu dữ liệu video (videoBase64)" });
        }

        const mimeType = body.mimeType || "video/mp4";

        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);
        const clients = await getAvailableGeminiClients();

        const personifyImageRefs = filterReferenceImages(body.objectToPersonifyImages || []);
        const usePersonifyImage = personifyImageRefs.length > 0;
        let objectToPersonifyPrompt: string | undefined;

        // ── Resolve objectToPersonify prompt (chỉ khi không dùng ảnh tham chiếu) ──
        if (!usePersonifyImage) {
          const resolved = await resolveObjectToPersonifyPrompt({
            objectToPersonifyCode: body.objectToPersonifyCode,
            objectToPersonify: body.objectToPersonify,
          });
          if (resolved.error) {
            return res.status(resolved.error.status).json({ message: resolved.error.message });
          }
          objectToPersonifyPrompt = resolved.prompt;
          if (objectToPersonifyPrompt) {
            body.objectToPersonify = objectToPersonifyPrompt;
          }
        }

        // ── Resolve artStyle prompt from DB ──
        const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
          artStyleId: body.artStyleId,
          artStyle: body.artStyle,
        });
        if (resolvedArtStylePrompt) {
          body.artStyle = resolvedArtStylePrompt;
        }

        // Build product image reference text
        const productImageNote = buildProductImageScriptNote(body.productImages || []);
        const personifyImageNote = usePersonifyImage
          ? buildObjectPersonifyImageScriptNote(body.objectToPersonifyImages || [])
          : "";
        const text =
          buildVideoAnalysisPrompt({
            artStyle: body.artStyle,
            language: body.language,
            mood: body.mood,
            aspectRatio: body.aspectRatio,
            objectToPersonifyPrompt: usePersonifyImage ? undefined : objectToPersonifyPrompt,
          }) +
          personifyImageNote +
          productImageNote;

        const response = await callGeminiWithRetry(
          (ai) =>
            ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      inlineData: {
                        data: body.videoBase64,
                        mimeType,
                      },
                    },
                    {
                      text,
                    },
                  ],
                },
              ],
              config: {
                temperature: 0.4,
                responseMimeType: "application/json",
                responseSchema: CopyVideoAnalysisResponseSchema,
              },
            }),
          "copy-video-analysis",
          clients
        );

        let parsed: any;
        try {
          parsed = JSON.parse(response.text || "{}");
        } catch {
          parsed = { raw: response.text };
        }

        await incrementRequestCount(context.id);
        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[copy-video-analysis] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
