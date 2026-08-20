/**
 * Schema JSON — gợi ý 10 vật phẩm trên người nhân vật.
 */
import { Type } from "@google/genai";

const propItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: {
      type: "string" as const,
      description: "Tên vật phẩm / phụ kiện ngắn gọn",
    },
    description: {
      type: "string" as const,
      description: "Mô tả vật lý chi tiết (chất liệu, màu, độ cũ, cách đeo) cho image prompt",
    },
  },
  required: ["name", "description"] as const,
};

export const FilmSuggestCharacterPropsOpenAIJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    props: {
      type: "array" as const,
      description: "Đúng 10 vật phẩm trên người nhân vật",
      items: propItemOpenAI,
    },
  },
  required: ["props"] as const,
};

export const FilmSuggestCharacterPropsGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    props: {
      type: Type.ARRAY,
      description: "Đúng 10 vật phẩm trên người nhân vật",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Tên vật phẩm / phụ kiện ngắn gọn",
          },
          description: {
            type: Type.STRING,
            description:
              "Mô tả vật lý chi tiết (chất liệu, màu, độ cũ, cách đeo) cho image prompt",
          },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["props"],
};

export type FilmSuggestCharacterPropItem = {
  name: string;
  description: string;
};

export type FilmSuggestCharacterPropsResult = {
  props: FilmSuggestCharacterPropItem[];
};
