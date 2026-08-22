/**
 * Schema object kết quả trích xuất phân cảnh (film).
 * - Gemini: responseSchema + responseMimeType application/json
 * - OpenAI: response_format json_schema (strict)
 * - Gateway: jsonSchema nhúng vào prompt
 *
 * Single source of truth: buildExtractScreenplaySchemas({ sceneCount, language })
 */

import { Type } from "@google/genai";

export const FILM_CHARACTER_ROLES = ["main", "antagonist", "supporting", "extra"] as const;
export const FILM_PROP_CATEGORIES = ["weapon", "container", "prop", "clothing", "other"] as const;
export const FILM_TIME_OF_DAY_VALUES = [
  "Golden Hour",
  "Blue Hour",
  "Harsh Noon",
  "Overcast Morning",
  "Overcast Afternoon",
  "Rainy Day",
  "Rainy Night",
  "Moonlit Night",
  "Night",
  "Daylight",
] as const;

export type BuildExtractScreenplaySchemaParams = {
  sceneCount: number;
  language: string;
};

function langNote(language: string): string {
  return `Viết bằng ${language}.`;
}

function buildDialogueItemOpenAI(language: string) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      character: {
        type: "string" as const,
        minLength: 1,
        description: `Tên nhân vật nói thoại. ${langNote(language)}`,
      },
      line: {
        type: "string" as const,
        minLength: 1,
        description: `Nội dung thoại. ${langNote(language)}`,
      },
    },
    required: ["character", "line"] as const,
  };
}

function buildCharacterActionItemOpenAI(language: string) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      character: {
        type: "string" as const,
        minLength: 1,
        description: "Tên nhân vật thực hiện hành động",
      },
      action: {
        type: "string" as const,
        minLength: 1,
        description:
          `Hành động: làm gì, tương tác với ai/cái gì như thế nào. KHÔNG gộp lời thoại vào đây. ${langNote(language)}`,
      },
    },
    required: ["character", "action"] as const,
  };
}

function buildSceneItemOpenAI(params: BuildExtractScreenplaySchemaParams) {
  const { sceneCount, language } = params;
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      index: {
        type: "integer" as const,
        minimum: 1,
        maximum: sceneCount,
        description: `Số thứ tự phân cảnh, liên tục từ 1 đến ${sceneCount}`,
      },
      title: {
        type: "string" as const,
        minLength: 1,
        description: `Tiêu đề ngắn của phân cảnh. ${langNote(language)}`,
      },
      content: {
        type: "string" as const,
        minLength: 1,
        description: `Tóm tắt / overview ngắn toàn cảnh (1–3 câu). ${langNote(language)}`,
      },
      characterActions: {
        type: "array" as const,
        description:
          "Hành động từng nhân vật (character + action). Mỗi nhân vật trong characterNames nên có 1 phần tử. Có thể [] nếu không có nhân vật.",
        items: buildCharacterActionItemOpenAI(language),
      },
      visualDescription: {
        type: "string" as const,
        minLength: 8,
        description:
          `Hình ảnh cảnh quay — khung hình, composition, ánh sáng, không gian nhìn thấy. ${langNote(language)}`,
      },
      atmosphere: {
        type: "string" as const,
        minLength: 1,
        description:
          `Không khí cảnh — cảm xúc / năng lượng / tone (căng thẳng, ấm áp, u ám, ...). ${langNote(language)}`,
      },
      shotSize: {
        type: "string" as const,
        minLength: 1,
        description: "Cỡ cảnh (Toàn cảnh / Trung cảnh / Cận cảnh / Siêu cận / ...)",
      },
      cameraAngle: {
        type: "string" as const,
        minLength: 1,
        description: "Góc máy (Chính diện, Nghiêng, Cao, Thấp, Phía sau, ...)",
      },
      cameraMovement: {
        type: "string" as const,
        minLength: 1,
        description: "Lia máy / chuyển động camera (Tĩnh, Pan, Zoom, Theo sau, ...)",
      },
      motion: {
        type: "string" as const,
        minLength: 8,
        description:
          `[MOTION] Chuyển động camera + nhân vật/vật thể (hướng, tốc độ, nhịp). BẮT BUỘC chi tiết, điện ảnh; không generic. ${langNote(language)}`,
      },
      audio: {
        type: "string" as const,
        minLength: 8,
        description:
          `[AUDIO] Nền âm thanh tổng / ambience (phòng, ngoài trời, crowd, máy móc...). BẮT BUỘC chi tiết. ${langNote(language)}`,
      },
      sfx: {
        type: "string" as const,
        minLength: 1,
        description:
          `[SFX] Hiệu ứng cụ thể (bước chân, cửa, va chạm, mưa...). Dùng 'none' nếu không có.`,
      },
      music: {
        type: "string" as const,
        minLength: 1,
        description:
          `[MUSIC] Nhạc nền (thể loại, mood, crescendo/fade). Dùng 'none' nếu im lặng.`,
      },
      voice: {
        type: "string" as const,
        minLength: 1,
        description:
          `[VOICE] Chỉ dẫn giọng — KHÔNG chép nguyên thoại. 'none' CHỈ khi cảnh không có lời. Có lời thì BẮT BUỘC đủ 5 yếu tố: giới tính (nam/nữ), pitch (trầm/bổng), tốc độ (nhanh/chậm), tuổi giọng, cảm xúc. VD: 'Minh, nam, giọng trầm, nói chậm, tuổi trung niên, căng thẳng'. Nhiều người: liệt kê từng người.`,
      },
      videoPrompt: {
        type: "string" as const,
        description:
          "Prompt video đầy đủ cho UI. Format: mỗi tag một khối — tag trên 1 dòng, giá trị xuống dòng bắt đầu '- '. Gồm [MOTION][AUDIO][SFX][MUSIC][VOICE][DIALOGUE]. KHÔNG viết liền sau tag (SAI: [AUDIO]Nước...). Khớp nội dung motion/audio/sfx/music/voice/dialogues. Không markdown.",
      },
      dialogues: {
        type: "array" as const,
        description: `[DIALOGUE] Lời thoại từng nhân vật; [] nếu không có thoại. ${langNote(language)}`,
        items: buildDialogueItemOpenAI(language),
      },
      location: {
        type: "string" as const,
        minLength: 1,
        description: `Địa điểm / bối cảnh của phân cảnh. ${langNote(language)}`,
      },
      characterNames: {
        type: "array" as const,
        description: "Tên các nhân vật xuất hiện trong phân cảnh",
        items: { type: "string" as const, minLength: 1 },
      },
      propNames: {
        type: "array" as const,
        description: "Vật phẩm / props xuất hiện trong phân cảnh",
        items: { type: "string" as const, minLength: 1 },
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
}

function buildCharacterItemOpenAI(language: string) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      name: { type: "string" as const, minLength: 1, description: "Tên nhân vật (unique)" },
      description: {
        type: "string" as const,
        minLength: 1,
        description: `Ngoại hình + tính cách (KHÔNG gồm trang phục). ${langNote(language)}`,
      },
      clothingAccessories: {
        type: "string" as const,
        minLength: 8,
        description:
          "Clothing & Accessories — quần áo, giày dép, trang sức, phụ kiện chi tiết, sống động cho image prompt. BẮT BUỘC không rỗng.",
      },
      role: {
        type: "string" as const,
        enum: [...FILM_CHARACTER_ROLES],
        description: "Vai trò nhân vật trong kịch bản",
      },
    },
    required: ["name", "description", "clothingAccessories", "role"] as const,
  };
}

function buildLocationItemOpenAI(language: string) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      name: { type: "string" as const, minLength: 1, description: "Tên địa điểm (unique)" },
      description: {
        type: "string" as const,
        minLength: 1,
        description: `Mô tả ngắn bối cảnh / không gian. ${langNote(language)}`,
      },
      context: {
        type: "string" as const,
        minLength: 1,
        description: `Ngữ cảnh tình huống (sau mưa, sau trận chiến, ...). ${langNote(language)}`,
      },
      timeOfDay: {
        type: "string" as const,
        enum: [...FILM_TIME_OF_DAY_VALUES],
        description:
          "Time of Day / ánh sáng điện ảnh — BẮT BUỘC dùng cụm tiếng Anh cinematic (Golden Hour, Harsh Noon, Rainy Night, ...)",
      },
    },
    required: ["name", "description", "context", "timeOfDay"] as const,
  };
}

function buildPropItemOpenAI(language: string) {
  return {
    type: "object" as const,
    additionalProperties: false,
    properties: {
      name: { type: "string" as const, minLength: 1, description: "Tên vật phẩm (unique)" },
      description: {
        type: "string" as const,
        minLength: 1,
        description: `Mô tả ngắn vật phẩm. ${langNote(language)}`,
      },
      category: {
        type: "string" as const,
        enum: [...FILM_PROP_CATEGORIES],
        description: "Loại vật phẩm",
      },
    },
    required: ["name", "description", "category"] as const,
  };
}

/** JSON Schema (OpenAI / Gateway) — build theo sceneCount + language */
export function buildExtractScreenplayOpenAIJsonSchema(params: BuildExtractScreenplaySchemaParams) {
  const { sceneCount, language } = params;
  return {
    type: "object" as const,
    additionalProperties: false,
    description: `Kết quả trích xuất storyboard phim. Mọi field narrative bằng ${language}.`,
    properties: {
      scenes: {
        type: "array" as const,
        minItems: sceneCount,
        maxItems: sceneCount,
        description: `ĐÚNG ${sceneCount} phân cảnh. index liên tục 1..${sceneCount}. Chia cân đều theo tiến trình câu chuyện; không cắt vụn vô nghĩa.`,
        items: buildSceneItemOpenAI(params),
      },
      characters: {
        type: "array" as const,
        description: "Tổng hợp TẤT CẢ nhân vật xuất hiện (unique theo name, không trùng lặp)",
        items: buildCharacterItemOpenAI(language),
      },
      locations: {
        type: "array" as const,
        description: "Tổng hợp TẤT CẢ địa điểm / bối cảnh (unique theo name)",
        items: buildLocationItemOpenAI(language),
      },
      props: {
        type: "array" as const,
        description: "Tổng hợp TẤT CẢ vật phẩm / props (unique theo name)",
        items: buildPropItemOpenAI(language),
      },
    },
    required: ["scenes", "characters", "locations", "props"] as const,
  };
}

function buildGeminiSceneItem(params: BuildExtractScreenplaySchemaParams) {
  const { sceneCount, language } = params;
  return {
    type: Type.OBJECT,
    properties: {
      index: {
        type: Type.INTEGER,
        description: `Số thứ tự phân cảnh, liên tục từ 1 đến ${sceneCount}`,
      },
      title: { type: Type.STRING, description: `Tiêu đề ngắn. ${langNote(language)}` },
      content: { type: Type.STRING, description: `Overview 1–3 câu. ${langNote(language)}` },
      characterActions: {
        type: Type.ARRAY,
        description:
          "Hành động từng nhân vật. Mỗi characterNames nên có 1 action. Không gộp thoại.",
        items: {
          type: Type.OBJECT,
          properties: {
            character: { type: Type.STRING },
            action: { type: Type.STRING, description: "Không gồm lời thoại" },
          },
          required: ["character", "action"],
        },
      },
      visualDescription: {
        type: Type.STRING,
        description: "Hình ảnh cảnh quay — composition / ánh sáng / môi trường",
      },
      atmosphere: { type: Type.STRING, description: "Không khí cảnh — cảm xúc, tone" },
      shotSize: { type: Type.STRING, description: "Cỡ cảnh" },
      cameraAngle: { type: Type.STRING, description: "Góc máy" },
      cameraMovement: { type: Type.STRING, description: "Lia máy" },
      motion: {
        type: Type.STRING,
        description: "[MOTION] Chi tiết, không rỗng, không generic",
      },
      audio: {
        type: Type.STRING,
        description: "[AUDIO] Ambience chi tiết, không rỗng",
      },
      sfx: { type: Type.STRING, description: "[SFX] hoặc 'none'" },
      music: { type: Type.STRING, description: "[MUSIC] hoặc 'none'" },
      voice: {
        type: Type.STRING,
        description:
          "[VOICE] 5 yếu tố khi có lời: giới tính, pitch, tốc độ, tuổi, cảm xúc. 'none' nếu không có lời.",
      },
      videoPrompt: {
        type: Type.STRING,
        description:
          "Prompt video: tag xuống dòng, '- ' prefix. [MOTION][AUDIO][SFX][MUSIC][VOICE][DIALOGUE]",
      },
      dialogues: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            character: { type: Type.STRING },
            line: { type: Type.STRING },
          },
          required: ["character", "line"],
        },
      },
      location: { type: Type.STRING },
      characterNames: { type: Type.ARRAY, items: { type: Type.STRING } },
      propNames: { type: Type.ARRAY, items: { type: Type.STRING } },
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
  };
}

/** Gemini responseSchema — build từ cùng params với OpenAI */
export function buildExtractScreenplayGeminiSchema(params: BuildExtractScreenplaySchemaParams) {
  const { sceneCount, language } = params;
  return {
    type: Type.OBJECT,
    description: `Storyboard extract. Narrative text in ${language}. Exactly ${sceneCount} scenes.`,
    properties: {
      scenes: {
        type: Type.ARRAY,
        description: `ĐÚNG ${sceneCount} phân cảnh, index 1..${sceneCount}`,
        items: buildGeminiSceneItem(params),
      },
      characters: {
        type: Type.ARRAY,
        description: "Tất cả nhân vật unique",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING, description: "Không gồm trang phục" },
            clothingAccessories: {
              type: Type.STRING,
              description: "Clothing & Accessories chi tiết, không rỗng",
            },
            role: {
              type: Type.STRING,
              enum: [...FILM_CHARACTER_ROLES],
            },
          },
          required: ["name", "description", "clothingAccessories", "role"],
        },
      },
      locations: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            context: { type: Type.STRING },
            timeOfDay: {
              type: Type.STRING,
              enum: [...FILM_TIME_OF_DAY_VALUES],
            },
          },
          required: ["name", "description", "context", "timeOfDay"],
        },
      },
      props: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: {
              type: Type.STRING,
              enum: [...FILM_PROP_CATEGORIES],
            },
          },
          required: ["name", "description", "category"],
        },
      },
    },
    required: ["scenes", "characters", "locations", "props"],
  };
}

export function buildExtractScreenplaySchemas(params: BuildExtractScreenplaySchemaParams) {
  return {
    openai: buildExtractScreenplayOpenAIJsonSchema(params),
    gemini: buildExtractScreenplayGeminiSchema(params),
  };
}

/** Default static export — docs / fallback khi chưa có params */
export const FilmExtractScreenplayOpenAIJsonSchema = buildExtractScreenplayOpenAIJsonSchema({
  sceneCount: 6,
  language: "Vietnamese",
});

export const FilmExtractScreenplayGeminiSchema = buildExtractScreenplayGeminiSchema({
  sceneCount: 6,
  language: "Vietnamese",
});

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
