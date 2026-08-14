/**
 * Schema object kết quả trích xuất phân cảnh (film).
 * - Gemini: responseSchema + responseMimeType application/json
 * - OpenAI: response_format json_schema (strict)
 * - Gateway: jsonSchema nhúng vào prompt
 */

import { Type } from "@google/genai";

/** Dialogue một nhân vật trong phân cảnh */
const dialogueItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    character: {
      type: "string" as const,
      description: "Tên nhân vật nói thoại",
    },
    line: {
      type: "string" as const,
      description: "Nội dung thoại của nhân vật",
    },
  },
  required: ["character", "line"] as const,
};

/** Hành động một nhân vật trong phân cảnh */
const characterActionItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    character: {
      type: "string" as const,
      description: "Tên nhân vật thực hiện hành động",
    },
    action: {
      type: "string" as const,
      description:
        "Hành động: làm gì, tương tác với ai/cái gì như thế nào (không gồm lời thoại)",
    },
  },
  required: ["character", "action"] as const,
};

const sceneItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    index: {
      type: "integer" as const,
      description: "Số thứ tự phân cảnh, bắt đầu từ 1",
    },
    title: {
      type: "string" as const,
      description: "Tiêu đề ngắn của phân cảnh",
    },
    content: {
      type: "string" as const,
      description: "Tóm tắt / overview ngắn toàn cảnh (1–3 câu)",
    },
    characterActions: {
      type: "array" as const,
      description:
        "Hành động từng nhân vật trong cảnh (character + action). Có thể rỗng nếu không có nhân vật",
      items: characterActionItemOpenAI,
    },
    visualDescription: {
      type: "string" as const,
      description:
        "Hình ảnh cảnh quay — mô tả khung hình / composition / ánh sáng / môi trường nhìn thấy được",
    },
    atmosphere: {
      type: "string" as const,
      description:
        "Không khí cảnh — cảm xúc, năng lượng, tone (căng thẳng, ấm áp, u ám, hài hước, ...)",
    },
    shotSize: {
      type: "string" as const,
      description: "Cỡ cảnh (Toàn cảnh, Trung cảnh, Cận cảnh, Siêu cận, ...)",
    },
    cameraAngle: {
      type: "string" as const,
      description: "Góc máy (Chính diện, Nghiêng, Cao, Thấp, Phía sau, ...)",
    },
    cameraMovement: {
      type: "string" as const,
      description: "Lia máy / chuyển động camera (Tĩnh, Pan, Zoom, Theo sau, ...)",
    },
    motion: {
      type: "string" as const,
      description:
        "[MOTION] Chuyển động trong cảnh: camera + nhân vật/vật thể (hướng, tốc độ, nhịp). BẮT BUỘC chi tiết, không để rỗng.",
    },
    audio: {
      type: "string" as const,
      description:
        "[AUDIO] Nền âm thanh tổng (ambience + lớp âm chính). BẮT BUỘC chi tiết.",
    },
    sfx: {
      type: "string" as const,
      description:
        "[SFX] Hiệu ứng âm thanh cụ thể (bước chân, cửa, va chạm, ...). Có thể 'none' nếu không có.",
    },
    music: {
      type: "string" as const,
      description:
        "[MUSIC] Nhạc nền: thể loại, mood, crescendo/fade. Có thể 'none' nếu im lặng.",
    },
    voice: {
      type: "string" as const,
      description:
        "[VOICE] Chỉ dẫn giọng — BẮT BUỘC đủ 5 yếu tố khi có lời: giới tính (nam/nữ), pitch (trầm/bổng), tốc độ (nhanh/chậm), tuổi giọng, cảm xúc. Có thể thêm ai nói. KHÔNG chép nguyên thoại. Chỉ 'none' nếu cảnh không có lời.",
    },
    videoPrompt: {
      type: "string" as const,
      description:
        "Prompt video ĐẦY ĐỦ cho UI. Mỗi tag một khối, KHÔNG viết liền: [AUDIO]\\n- nội dung. Gồm [MOTION], [AUDIO], [SFX], [MUSIC], [VOICE], [DIALOGUE] (DIALOGUE bỏ nếu không có thoại). Không markdown.",
    },
    dialogues: {
      type: "array" as const,
      description: "Thoại từng nhân vật trong cảnh (có thể rỗng nếu không có thoại)",
      items: dialogueItemOpenAI,
    },
    location: {
      type: "string" as const,
      description: "Địa điểm / bối cảnh của phân cảnh",
    },
    characterNames: {
      type: "array" as const,
      description: "Tên các nhân vật xuất hiện trong phân cảnh",
      items: { type: "string" as const },
    },
    propNames: {
      type: "array" as const,
      description: "Vật phẩm / props xuất hiện trong phân cảnh",
      items: { type: "string" as const },
    },
  },
  required: [
    "index",
    "title",
    "content",
    "characterActions",
    "visualDescription",
    "atmosphere",
    "shotSize",
    "cameraAngle",
    "cameraMovement",
    "motion",
    "audio",
    "sfx",
    "music",
    "voice",
    "videoPrompt",
    "dialogues",
    "location",
    "characterNames",
    "propNames",
  ] as const,
};

const characterItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: { type: "string" as const, description: "Tên nhân vật" },
    description: {
      type: "string" as const,
      description: "Mô tả ngắn ngoại hình / tính cách (không gồm trang phục)",
    },
    clothingAccessories: {
      type: "string" as const,
      description:
        "Clothing & Accessories — trang phục, phụ kiện chi tiết (vd. áo khoác da, vòng cổ bạc, balo quân sự)",
    },
    role: {
      type: "string" as const,
      description: "Vai trò: main | antagonist | supporting | extra",
    },
  },
  required: ["name", "description", "clothingAccessories", "role"] as const,
};

const locationItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: { type: "string" as const, description: "Tên địa điểm" },
    description: {
      type: "string" as const,
      description: "Mô tả ngắn bối cảnh / không gian",
    },
    context: {
      type: "string" as const,
      description: "Ngữ cảnh tình huống (sau mưa, sau trận chiến, ...)",
    },
    timeOfDay: {
      type: "string" as const,
      description:
        "Time of Day / ánh sáng — e.g. Golden Hour, Harsh Noon, Rainy Night, Blue Hour, Overcast Morning, Moonlit Night",
    },
  },
  required: ["name", "description", "context", "timeOfDay"] as const,
};

const propItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: { type: "string" as const, description: "Tên vật phẩm" },
    description: {
      type: "string" as const,
      description: "Mô tả ngắn vật phẩm",
    },
    category: {
      type: "string" as const,
      description: "weapon | container | prop | clothing | other",
    },
  },
  required: ["name", "description", "category"] as const,
};

/**
 * JSON Schema (OpenAI / Gateway prompt) — object kết quả trích xuất phân cảnh.
 *
 * @example
 * {
 *   "scenes": [{
 *     "index": 1,
 *     "title": "Gặp gỡ trong quán cà phê",
 *     "content": "Minh tìm Lan trong quán cà phê để bắt đầu cuộc hẹn.",
 *     "characterActions": [
 *       { "character": "Minh", "action": "Bước vào quán, nhìn quanh rồi vẫy tay chào Lan" },
 *       { "character": "Lan", "action": "Ngồi góc bàn, giơ tay đáp lại và kéo ghế" }
 *     ],
 *     "visualDescription": "Trung cảnh quán cà phê buổi chiều vàng; hai người ngồi đối diện qua bàn nhỏ, bokeh đèn cửa sổ.",
 *     "atmosphere": "Ấm áp, nhẹ nhàng, hơi hồi hộp",
 *     "shotSize": "Trung cảnh",
 *     "cameraAngle": "Chính diện",
 *     "cameraMovement": "Tĩnh",
 *     "dialogues": [
 *       { "character": "Minh", "line": "Lâu rồi không gặp." },
 *       { "character": "Lan", "line": "Ừ, ngồi đi." }
 *     ],
 *     "location": "Quán cà phê góc phố",
 *     "characterNames": ["Minh", "Lan"],
 *     "propNames": ["Tách cà phê"]
 *   }],
 *   "characters": [{
 *     "name": "Minh",
 *     "description": "...",
 *     "clothingAccessories": "Áo sơ mi trắng, đồng hồ da nâu",
 *     "role": "main"
 *   }],
 *   "locations": [{
 *     "name": "Quán cà phê góc phố",
 *     "description": "...",
 *     "context": "Buổi hẹn lần đầu",
 *     "timeOfDay": "Golden Hour"
 *   }],
 *   "props": [{ "name": "Tách cà phê", "description": "...", "category": "prop" }]
 * }
 */
export const FilmExtractScreenplayOpenAIJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    scenes: {
      type: "array" as const,
      description:
        "Danh sách phân cảnh — BẮT BUỘC đúng số lượng sceneCount được chỉ định, index từ 1..N",
      items: sceneItemOpenAI,
    },
    characters: {
      type: "array" as const,
      description: "Tổng hợp TẤT CẢ nhân vật xuất hiện trong kịch bản (unique theo name)",
      items: characterItemOpenAI,
    },
    locations: {
      type: "array" as const,
      description: "Tổng hợp TẤT CẢ địa điểm / bối cảnh (unique theo name)",
      items: locationItemOpenAI,
    },
    props: {
      type: "array" as const,
      description: "Tổng hợp TẤT CẢ vật phẩm / props (unique theo name)",
      items: propItemOpenAI,
    },
  },
  required: ["scenes", "characters", "locations", "props"] as const,
};

/** Gemini responseSchema (Type enum từ @google/genai) */
export const FilmExtractScreenplayGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    scenes: {
      type: Type.ARRAY,
      description:
        "Danh sách phân cảnh — BẮT BUỘC đúng số lượng sceneCount được chỉ định, index từ 1..N",
      items: {
        type: Type.OBJECT,
        properties: {
          index: {
            type: Type.INTEGER,
            description: "Số thứ tự phân cảnh, bắt đầu từ 1",
          },
          title: {
            type: Type.STRING,
            description: "Tiêu đề ngắn của phân cảnh",
          },
          content: {
            type: Type.STRING,
            description: "Tóm tắt / overview ngắn toàn cảnh",
          },
          characterActions: {
            type: Type.ARRAY,
            description: "Hành động từng nhân vật (character + action)",
            items: {
              type: Type.OBJECT,
              properties: {
                character: { type: Type.STRING, description: "Tên nhân vật" },
                action: {
                  type: Type.STRING,
                  description: "Làm gì, tương tác như thế nào (không gồm thoại)",
                },
              },
              required: ["character", "action"],
            },
          },
          visualDescription: {
            type: Type.STRING,
            description: "Hình ảnh cảnh quay — composition / ánh sáng / môi trường",
          },
          atmosphere: {
            type: Type.STRING,
            description: "Không khí cảnh — cảm xúc, tone",
          },
          shotSize: {
            type: Type.STRING,
            description: "Cỡ cảnh (Toàn cảnh, Trung cảnh, Cận cảnh, ...)",
          },
          cameraAngle: {
            type: Type.STRING,
            description: "Góc máy",
          },
          cameraMovement: {
            type: Type.STRING,
            description: "Lia máy / chuyển động camera",
          },
          motion: {
            type: Type.STRING,
            description: "[MOTION] Chuyển động camera + nhân vật/vật thể, chi tiết",
          },
          audio: {
            type: Type.STRING,
            description: "[AUDIO] Nền âm thanh tổng / ambience",
          },
          sfx: {
            type: Type.STRING,
            description: "[SFX] Hiệu ứng âm thanh cụ thể",
          },
          music: {
            type: Type.STRING,
            description: "[MUSIC] Nhạc nền, mood, động lượng",
          },
          voice: {
            type: Type.STRING,
            description:
              "[VOICE] BẮT BUỘC: giới tính, pitch (trầm/bổng), tốc độ, tuổi giọng, cảm xúc. Không chép thoại. 'none' nếu không có lời.",
          },
          videoPrompt: {
            type: Type.STRING,
            description:
              "Prompt video đầy đủ: mỗi tag một khối [AUDIO]\\n- nội dung (MOTION, AUDIO, SFX, MUSIC, VOICE, DIALOGUE). Không viết liền sau tag.",
          },
          dialogues: {
            type: Type.ARRAY,
            description: "Thoại từng nhân vật (character + line)",
            items: {
              type: Type.OBJECT,
              properties: {
                character: { type: Type.STRING, description: "Tên nhân vật" },
                line: { type: Type.STRING, description: "Nội dung thoại" },
              },
              required: ["character", "line"],
            },
          },
          location: {
            type: Type.STRING,
            description: "Địa điểm của phân cảnh",
          },
          characterNames: {
            type: Type.ARRAY,
            description: "Tên nhân vật trong cảnh",
            items: { type: Type.STRING },
          },
          propNames: {
            type: Type.ARRAY,
            description: "Props trong cảnh",
            items: { type: Type.STRING },
          },
        },
        required: [
          "index",
          "title",
          "content",
          "characterActions",
          "visualDescription",
          "atmosphere",
          "shotSize",
          "cameraAngle",
          "cameraMovement",
          "motion",
          "audio",
          "sfx",
          "music",
          "voice",
          "videoPrompt",
          "dialogues",
          "location",
          "characterNames",
          "propNames",
        ],
      },
    },
    characters: {
      type: Type.ARRAY,
      description: "Tổng hợp tất cả nhân vật (unique)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: {
            type: Type.STRING,
            description: "Mô tả ngoại hình / tính cách (không gồm trang phục)",
          },
          clothingAccessories: {
            type: Type.STRING,
            description:
              "Clothing & Accessories — trang phục và phụ kiện chi tiết",
          },
          role: { type: Type.STRING },
        },
        required: ["name", "description", "clothingAccessories", "role"],
      },
    },
    locations: {
      type: Type.ARRAY,
      description: "Tổng hợp tất cả địa điểm (unique)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          context: { type: Type.STRING },
          timeOfDay: {
            type: Type.STRING,
            description:
              "Time of Day (Golden Hour, Harsh Noon, Rainy Night, Blue Hour, ...)",
          },
        },
        required: ["name", "description", "context", "timeOfDay"],
      },
    },
    props: {
      type: Type.ARRAY,
      description: "Tổng hợp tất cả props (unique)",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          category: { type: Type.STRING },
        },
        required: ["name", "description", "category"],
      },
    },
  },
  required: ["scenes", "characters", "locations", "props"],
};

/** Kiểu kết quả parse (dùng server + client) */
export type FilmExtractDialogue = {
  character: string;
  line: string;
};

/** Hành động một nhân vật trong phân cảnh */
export type FilmExtractCharacterAction = {
  character: string;
  action: string;
};

export type FilmExtractSceneItem = {
  index: number;
  title: string;
  /** Tóm tắt / overview cảnh */
  content: string;
  /** Hành động từng nhân vật */
  characterActions: FilmExtractCharacterAction[];
  /** Hình ảnh cảnh quay */
  visualDescription: string;
  /** Không khí cảnh */
  atmosphere: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  /** [MOTION] */
  motion: string;
  /** [AUDIO] */
  audio: string;
  /** [SFX] */
  sfx: string;
  /** [MUSIC] */
  music: string;
  /** [VOICE] */
  voice: string;
  /** Prompt video đầy đủ (gắn UI) */
  videoPrompt: string;
  dialogues: FilmExtractDialogue[];
  location: string;
  characterNames: string[];
  propNames: string[];
};

export type FilmExtractCharacterItem = {
  name: string;
  description: string;
  /** Clothing & Accessories */
  clothingAccessories: string;
  role: string;
};

export type FilmExtractLocationItem = {
  name: string;
  description: string;
  context: string;
  /** Time of Day — e.g. Golden Hour, Harsh Noon, Rainy Night */
  timeOfDay: string;
};

export type FilmExtractPropItem = {
  name: string;
  description: string;
  category: string;
};

export type FilmExtractScreenplayResult = {
  scenes: FilmExtractSceneItem[];
  characters: FilmExtractCharacterItem[];
  locations: FilmExtractLocationItem[];
  props: FilmExtractPropItem[];
};
