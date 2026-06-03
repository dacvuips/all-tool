import {
  fetchImageAsBase64,
  stripDataUrlFromBase64,
} from "../../helpers/handleUploadGoogleLabImages";
import {
  createFlow2Request,
  Flow2StatusResponse,
  isHttpUrl,
  looksLikeRawBase64,
  runFlow2WithRetry,
  safeProgress,
  waitForFlow2Result,
} from "./_shared";

export type Flow2ImageInput = string | { imageBytes: string; mimeType?: string };

export type Flow2CreateImageRequestParams = {
  prompt: string;
  imageInputs?: Flow2ImageInput[];
  aspectRatio?: "16:9" | "9:16";
  imageModel?: string;
  variantCount?: number;
  imageInputTypes?: string[];
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
};

export type GeneratedImage = {
  imageBytes?: string;
  mimeType?: string;
};

const DEFAULT_IMAGE_MODEL = "NANO_BANANA_PRO";

function looksLikeRawBase64Image(value: string): boolean {
  return looksLikeRawBase64(value, 128);
}

export async function normalizeImageToDataUrl(input: Flow2ImageInput): Promise<string> {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Ảnh đầu vào rỗng");
    if (trimmed.startsWith("data:")) return trimmed;
    if (isHttpUrl(trimmed)) {
      const fetched = await fetchImageAsBase64(trimmed);
      return `data:${fetched.mimeType};base64,${fetched.imageBytes}`;
    }
    const stripped = stripDataUrlFromBase64(trimmed, "image/jpeg");
    return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
  }

  const stripped = stripDataUrlFromBase64(input.imageBytes, input.mimeType || "image/jpeg");
  return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
}

export async function createFlow2ImageRequest(
  params: Flow2CreateImageRequestParams
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const image_base64s = await Promise.all((params.imageInputs || []).map(normalizeImageToDataUrl));
  const image_input_types =
    params.imageInputTypes && params.imageInputTypes.length > 0
      ? params.imageInputTypes
      : new Array(image_base64s.length).fill("reference");

  return createFlow2Request({
    type: "gen_image",
    params: {
      prompt: params.prompt,
      aspect_ratio: params.aspectRatio || "16:9",
      image_base64s,
      image_input_types,
      image_model: params.imageModel || DEFAULT_IMAGE_MODEL,
      variant_count: Math.max(1, params.variantCount || 1),
    },
  });
}

function collectImageLikeStrings(value: unknown, out: string[], forceDive = false): void {
  const tryCollect = (input: string) => {
    const trimmed = input.trim();
    if (
      trimmed.startsWith("data:image/") ||
      isHttpUrl(trimmed) ||
      looksLikeRawBase64Image(trimmed)
    ) {
      out.push(trimmed);
    }
  };

  if (typeof value === "string") {
    tryCollect(value);
    return;
  }

  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectImageLikeStrings(item, out, forceDive);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  const candidateKeys = [
    "image",
    "images",
    "imageBytes",
    "imageBase64",
    "image_base64",
    "file_url",
    "fileUrl",
    "url",
    "urls",
    "output",
    "outputs",
    "result",
    "results",
    "data",
  ];

  for (const [key, val] of Object.entries(record)) {
    const shouldDive =
      forceDive ||
      candidateKeys.includes(key) ||
      key.toLowerCase().includes("image") ||
      key.toLowerCase().includes("file") ||
      key.toLowerCase().includes("url") ||
      key.toLowerCase().includes("result") ||
      key.toLowerCase().includes("output");

    if (!shouldDive) continue;

    if (typeof val === "string") {
      tryCollect(val);
      continue;
    }

    collectImageLikeStrings(val, out, true);
  }
}

async function normalizeResultImage(value: string): Promise<GeneratedImage> {
  if (value.startsWith("data:image/")) {
    const stripped = stripDataUrlFromBase64(value, "image/png");
    return { imageBytes: stripped.imageBytes, mimeType: stripped.mimeType };
  }
  if (isHttpUrl(value)) {
    const fetched = await fetchImageAsBase64(value);
    return { imageBytes: fetched.imageBytes, mimeType: fetched.mimeType };
  }
  const stripped = stripDataUrlFromBase64(value, "image/png");
  return { imageBytes: stripped.imageBytes, mimeType: stripped.mimeType };
}

export async function extractFlow2Images(
  statusData: Flow2StatusResponse
): Promise<GeneratedImage[]> {
  const found: string[] = [];
  collectImageLikeStrings(statusData, found);
  const deduped = Array.from(new Set(found)).slice(0, 10);
  if (deduped.length === 0) return [];
  return Promise.all(deduped.map(normalizeResultImage));
}

export async function waitForFlow2ImageResult(params: {
  requestId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
}): Promise<GeneratedImage[]> {
  return waitForFlow2Result({
    requestId: params.requestId,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
    onProgress: params.onProgress,
    extract: extractFlow2Images,
    emptyResultMessage: "Flow2 hoàn tất nhưng không có ảnh đầu ra",
    waitingProgressMessage: "Đang chờ Flow2 xử lý ảnh...",
    doneProgressMessage: "Flow2 đã tạo ảnh xong, đang xử lý kết quả...",
    logTag: "image",
  });
}

export async function generateImageWithFlow2(
  params: Flow2CreateImageRequestParams
): Promise<{ requestId: string; images: GeneratedImage[] }> {
  return runFlow2WithRetry({
    logTag: "image",
    onProgress: params.onProgress,
    createProgressMessage: "Đang gửi request tạo ảnh lên Flow2...",
    createdProgressMessage: () => "",
    retryProgressMessage: (attempt) => `Flow2 gặp lỗi captcha, đang retry lần ${attempt}...`,
    runOnce: async () => {
      const created = await createFlow2ImageRequest(params);
      await safeProgress(
        params.onProgress,
        55,
        `Đã tạo request Flow2 (${created.requestId}), đang chờ kết quả...`
      );
      const images = await waitForFlow2ImageResult({
        requestId: created.requestId,
        onProgress: params.onProgress,
      });
      return { requestId: created.requestId, images };
    },
  });
}
