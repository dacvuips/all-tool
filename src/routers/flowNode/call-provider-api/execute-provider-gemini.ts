import axios from "axios";
import { ExecuteProviderContext, MethodEnum } from "../execute-provider";
import { sendErrorResponse } from "../execute.route";

/** Context truyền vào từng executor theo từng AI provider */
/** Build request config và gọi API (dùng chung cho các provider, có thể tách riêng sau). */
export async function CallProviderGeminiApi(ctx: ExecuteProviderContext): Promise<unknown> {
  const { body, headers, url, method, fieldValues } = ctx;
  // Thu thập URL ảnh từ fieldValues (string hoặc mảng URL), convert sang base64
  const imageUrls = collectImageUrlsFromFieldValues(fieldValues);
  const convertedImages: { base64Data: string; mimeType: string }[] = [];
  if (imageUrls.length > 0) {
    try {
      const results = await Promise.all(imageUrls.map(convertImageUrlToBase64));
      convertedImages.push(...results);
    } catch (conversionErr: any) {
      return sendErrorResponse(
        null,
        400,
        `Failed to load images: ${conversionErr?.message ?? String(conversionErr)}`
      );
    }
  }
  const inlineDataParts = convertedImages.map((image) => ({
    inlineData: { mimeType: image.mimeType, data: image.base64Data },
  }));
  const parts = [{ text: body }, ...inlineDataParts];
  const axiosConfig = {
    method: method as MethodEnum,
    url,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    data: {
      contents: [{ parts }],
    },
  };
  const externalRes = await axios.request(axiosConfig);
  return externalRes.data;
}

/** Check if string looks like an image URL. */
function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed);
}

/** Đệ quy thu thập mọi URL ảnh trong object: string URL hoặc mảng URL, kể cả lồng nhau. */
function collectImageUrlsFromFieldValues(fieldValues: Record<string, unknown>): string[] {
  const urls: string[] = [];
  function walk(obj: unknown): void {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (isImageUrl(item)) urls.push(item.trim());
        else if (typeof item === "object" && item !== null) walk(item);
      }
      return;
    }
    if (typeof obj === "object") {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (isImageUrl(value)) urls.push(value.trim());
        else if (Array.isArray(value) || (typeof value === "object" && value !== null)) walk(value);
      }
    }
  }
  walk(fieldValues);
  return urls;
}

const convertImageUrlToBase64 = async (url: string) => {
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000, // 30 seconds timeout
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Convert arraybuffer to base64 correctly
    const base64Data = Buffer.from(response.data).toString("base64");
    const contentType = response.headers["content-type"] || "image/jpeg";

    return {
      base64Data,
      mimeType: contentType,
    };
  } catch (error: any) {
    console.error("Error converting image URL to base64:", {
      url,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });
    throw new Error(`Failed to fetch image from URL: ${error.message}`);
  }
};
