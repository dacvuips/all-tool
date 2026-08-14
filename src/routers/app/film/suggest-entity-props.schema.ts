/**
 * Schema JSON — gợi ý 10 vật phẩm kèm cho Vật phẩm / Bối cảnh.
 */
import { Type } from "@google/genai";

const propItemOpenAI = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    name: {
      type: "string" as const,
      description: "Tên vật phẩm ngắn gọn",
    },
    description: {
      type: "string" as const,
      description: "Mô tả vật lý chi tiết cho image prompt",
    },
  },
  required: ["name", "description"] as const,
};

export const FilmSuggestEntityPropsOpenAIJsonSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    props: {
      type: "array" as const,
      description: "Đúng 10 vật phẩm kèm",
      items: propItemOpenAI,
    },
  },
  required: ["props"] as const,
};

export const FilmSuggestEntityPropsGeminiSchema = {
  type: Type.OBJECT,
  properties: {
    props: {
      type: Type.ARRAY,
      description: "Đúng 10 vật phẩm kèm",
      items: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "Tên vật phẩm ngắn gọn",
          },
          description: {
            type: Type.STRING,
            description: "Mô tả vật lý chi tiết cho image prompt",
          },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["props"],
};

export type FilmSuggestEntityPropItem = {
  name: string;
  description: string;
};

export type FilmSuggestEntityKind = "prop" | "location";

export type FilmSuggestEntityPropsResult = {
  props: FilmSuggestEntityPropItem[];
};
