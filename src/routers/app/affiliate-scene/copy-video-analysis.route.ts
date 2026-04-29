import { Type } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callWithKeyRotation,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
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
}): string {
  const artStyle = opts.artStyle || "Realistic";
  const language = opts.language || "Vietnamese";
  const mood = opts.mood || "funny";
  const aspectRatio = opts.aspectRatio || "9:16";

  return `
Bạn là chuyên gia Video Production và AI Animation Director.

Nhiệm vụ:
Phân tích video và tạo kịch bản chi tiết để tái tạo lại video này dưới dạng Video-to-Video generation script.

====================================================================
NGUYÊN TẮC CỐT LÕI: DETAIL & CONSISTENCY
====================================================================

1. VISUAL DNA: LAYERED CLOTHING
Trang phục nhiều lớp

- KHÔNG ĐƯỢC bỏ qua chi tiết quần áo bên trong.
- Phải phân tích kỹ từng lớp trang phục:

Inner Layer:
- Áo bên trong
- Màu sắc
- Dài tay / ngắn tay
- Kiểu cổ áo

Outer Layer:
- Áo khoác / tạp dề / lớp ngoài
- Màu sắc
- Họa tiết
- Chất liệu nếu thấy rõ

Bottoms:
- Quần / váy
- Màu sắc
- Kiểu dáng

Ví dụ sai:
"Wearing a yellow apron"

Ví dụ đúng:
"Wearing a white long-sleeve shirt underneath a bright yellow sunflower-patterned apron"


2. PROPS CONSISTENCY
Đồng nhất đồ vật

- Xác định các Key Props xuất hiện trong video.
- Với mỗi prop, định nghĩa Visual Props theo cấu trúc:

[Màu sắc] + [Hình dáng] + [Chất liệu]

Ví dụ:
"Round black cast-iron pot"

RULE:
Nếu cảnh 1 dùng "Round black pot", thì các cảnh sau KHÔNG được đổi thành "Square white pot".

Phải dùng đúng mô tả prop đó xuyên suốt toàn bộ script.


3. SCENE CLASSIFICATION
Phân loại cảnh

--------------------------------------------------
TYPE: CHARACTER
Cảnh có nhân vật
--------------------------------------------------

- Khi nhân vật chính tương tác với nhân vật phụ, BẮT BUỘC mô tả kỹ CẢ HAI người.

QUY TẮC TARGET DESCRIPTION:

- Không được rút gọn mô tả nhân vật.
- Phải copy-paste nguyên văn toàn bộ Visual DNA đã định nghĩa ban đầu vào mỗi prompt.
- Nếu Visual DNA dài 20 từ, hãy paste đủ 20 từ.
- Đừng sợ prompt dài.

Ví dụ sai:
Visual DNA là:
"purple high-collared long-sleeve top"

Nhưng trong scene lại viết:
"purple top"

Lỗi:
Bị mất chi tiết "high-collared" và "long-sleeve".

Ví dụ đúng:
Dùng lại nguyên văn:
"purple high-collared long-sleeve top"

STRICT RULES:
- Không được viết tắt kiểu: "Visual DNA of..."
- Không được lazy referencing.
- Không được tự ý rút gọn mô tả nhân vật.


--------------------------------------------------
TYPE: OBJECT
Cảnh chỉ có vật thể
--------------------------------------------------

STRICT FORBIDDEN:
- KHÔNG nhắc tên nhân vật.
- KHÔNG nhắc ngoại hình nhân vật.

FOCUS:
- Texture
- Lighting
- Visual Props
- Composition
- Object detail


====================================================================
QUY TRÌNH LÀM VIỆC
====================================================================

Bước 1:
Xác định Visual DNA cho từng nhân vật.
Chú ý:
- Layered clothing
- Chi tiết đầy đủ
- Không rút gọn

Bước 2:
Xác định Visual Props.
Mỗi prop cần có:
- Màu sắc
- Hình dáng
- Chất liệu
- Vai trò trong video

Bước 3:
Viết prompt từng cảnh.

Checklist bắt buộc trước khi trả kết quả:
- Mình đã copy đầy đủ 100% mô tả nhân vật chưa?
- Có bị thiếu các chi tiết như "long-sleeve", "high-collared", "underneath" không?
- Props có được giữ đồng nhất giữa các cảnh không?
- Scene OBJECT có vô tình nhắc đến nhân vật không?


====================================================================
YÊU CẦU CHO TỪNG SCENE
====================================================================

1. visual_prompt

- Mô tả MỘT khung hình tĩnh.
- Viết bằng tiếng Anh.
- Expand toàn bộ Character Description và Props Description.
- Nếu scene_type = "CHARACTER":
  - Phải dùng đầy đủ Visual DNA của nhân vật.
  - Phải copy nguyên văn mô tả nhân vật đã định nghĩa.
- Nếu scene_type = "OBJECT":
  - Tuyệt đối không nhắc nhân vật.
  - Chỉ tập trung vào vật thể, ánh sáng, bố cục, texture.
  - Sử dụng các effect phù hợp để tăng tính hấp dẫn.
Style bắt buộc:"${artStyle}"
Mood / Tính cách nhân vật:"${mood}"
Aspect ratio:${aspectRatio}

2. motion_description
- Viết bằng tiếng Anh.
- Mô tả chuyển động cho Animator / Runway Gen-2.
- Phải dùng TÊN NHÂN VẬT cụ thể.
Ví dụ sai:"The character bounces..."
Ví dụ đúng:"Chibi Girl bounces up and down..."

3. audio_description
- Viết bằng tiếng Anh.
- Mô tả:
  - Voice gender - Tone - Emotion - Pace - Background sound/music nếu có
4. dialogue
Bao gồm:
original_content:
- Giữ nguyên ngôn ngữ gốc của video.
- Định dạng:
  "TÊN NHÂN VẬT: Nội dung"

translated_content:
- Dịch lại nội dung sang ngôn ngữ: ${language}.
- Nếu ngôn ngữ gốc trùng với ngôn ngữ yêu cầu, để là null.
====================================================================
CELEBRITY / PUBLIC FIGURE BYPASS
CRITICAL — HIGHEST PRIORITY
====================================================================
Nếu video có bất kỳ người thật dễ nhận diện nào, bao gồm:
- Chính trị gia
- Người nổi tiếng
- Vận động viên
- Influencer
- Nhân vật lịch sử

Bắt buộc làm như sau:

1. KHÔNG BAO GIỜ dùng tên thật đầy đủ của họ trong:
   - visual_prompt
   - bất kỳ field nào liên quan đến hình ảnh

2. Thay tên thật bằng alias viết tắt.

Ví dụ:
"Donald Trump" → "Mr. Dn"
"Elon Musk" → "Mr. El"

3. Luôn thêm mô tả ngoại hình chi tiết 40–60 từ thay cho tên thật.

4. Trong original_content và translated_content:
   - Có thể dùng tên thật nếu đó là lời thoại gốc.

5. Trong characters array:
   - name: dùng alias
   - description: dùng mô tả ngoại hình đầy đủ

Trả về kết quả JSON theo đúng responseSchema đã định nghĩa, bao gồm:
- characters
- props
- scenes
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
        };

        if (!body?.videoBase64) {
          return res.status(400).json({ message: "Thiếu dữ liệu video (videoBase64)" });
        }

        const mimeType = body.mimeType || "video/mp4";

        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);

        const clients = await getAvailableGeminiClients();

        const response = await callWithKeyRotation(
          clients,
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
                      text: buildVideoAnalysisPrompt({
                        artStyle: body.artStyle,
                        language: body.language,
                        mood: body.mood,
                        aspectRatio: body.aspectRatio,
                      }),
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
          "copy-video-analysis"
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
