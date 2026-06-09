import logger from "../../helpers/logger";

/** Tách raw base64 khỏi data URL (`data:image/webp;base64,...`). Google upload API cần base64 thuần. */
export function stripDataUrlFromBase64(
  input: string,
  fallbackMimeType = "image/jpeg"
): { imageBytes: string; mimeType: string } {
  const trimmed = input.trim();
  const base64Marker = ";base64,";
  if (trimmed.startsWith("data:")) {
    const idx = trimmed.indexOf(base64Marker);
    if (idx !== -1) {
      return {
        mimeType: trimmed.slice(5, idx) || fallbackMimeType,
        imageBytes: trimmed.slice(idx + base64Marker.length),
      };
    }
  }
  return { imageBytes: trimmed, mimeType: fallbackMimeType };
}

/**
 * Kiểm tra xem chuỗi có phải là URL ảnh không.
 */
function isImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Lấy mimeType từ URL dựa vào extension hoặc Content-Type header.
 */
function getMimeTypeFromUrl(url: string, contentType?: string): string {
  if (contentType && contentType.startsWith("image/")) {
    return contentType;
  }
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    svg: "image/svg+xml",
  };
  return mimeMap[ext || ""] || "image/jpeg";
}

const IMAGE_FETCH_MAX_RETRIES = 3;

function isCloudflare524Html(text: string): boolean {
  if (!text) return false;
  return (
    text.includes("524: A timeout occurred") ||
    text.includes("Error code 524") ||
    (text.includes("cf-error-details") && text.includes("524"))
  );
}

function isRetryableFetchError(status: number, bodyText: string): boolean {
  return status === 524 || status === 504 || status === 408 || isCloudflare524Html(bodyText);
}

/**
 * Fetch ảnh từ URL và chuyển thành base64 string.
 * Trả về { imageBytes (base64), mimeType }.
 * Tự retry khi gặp Cloudflare 524 / gateway timeout.
 */
export async function fetchImageAsBase64(url: string): Promise<{ imageBytes: string; mimeType: string }> {
  let lastError: any;

  for (let attempt = 1; attempt <= IMAGE_FETCH_MAX_RETRIES; attempt++) {
    try {
      logger.info(`[processImages] Đang fetch ảnh từ URL (lần ${attempt}): ${url}`);
      const resp = await fetch(url);
      const contentType = resp.headers.get("content-type") || "";
      const arrayBuffer = await resp.arrayBuffer();
      const bodyText = contentType.includes("text/html")
        ? Buffer.from(arrayBuffer).toString("utf-8")
        : "";

      if (!resp.ok || isCloudflare524Html(bodyText)) {
        if (isRetryableFetchError(resp.status, bodyText) && attempt < IMAGE_FETCH_MAX_RETRIES) {
          logger.warn(
            `[processImages] Fetch ảnh bị 524/timeout (${resp.status}), retry lần ${attempt}/${IMAGE_FETCH_MAX_RETRIES}: ${url}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
          continue;
        }
        const err: any = new Error(
          isCloudflare524Html(bodyText)
            ? `Timeout 524 khi fetch ảnh: ${url}`
            : `Không thể fetch ảnh từ URL (${resp.status}): ${url}`
        );
        err.statusCode = isCloudflare524Html(bodyText) ? 524 : 400;
        throw err;
      }

      const mimeType = getMimeTypeFromUrl(url, contentType);
      const imageBytes = Buffer.from(arrayBuffer).toString("base64");
      logger.info(
        `[processImages] Fetch thành công, size: ${imageBytes.length} chars, mimeType: ${mimeType}`
      );
      return { imageBytes, mimeType };
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || "").toString();
      const retryable =
        err?.statusCode === 524 ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "ECONNRESET" ||
        msg.includes("524") ||
        msg.includes("timeout");

      if (retryable && attempt < IMAGE_FETCH_MAX_RETRIES) {
        logger.warn(
          `[processImages] Lỗi fetch ảnh, retry lần ${attempt}/${IMAGE_FETCH_MAX_RETRIES}: ${msg}`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}

/**
 * Xử lý mảng ảnh (URL hoặc base64) và upload lên Google Labs.
 * - Nếu item là string URL → fetch về, chuyển base64, rồi upload.
 * - Nếu item là { imageBytes, mimeType } → upload trực tiếp.
 * Trả về mảng các media name đã upload.
 */
export async function processAndUploadImages(
  images: Array<string | { imageBytes: string; mimeType?: string }>,
  accessToken: string,
  projectId: string,
  userId: string
): Promise<string[]> {
  if (!images || images.length === 0) {
    return [];
  }

  logger.info(`[processImages] Bắt đầu xử lý ${images.length} ảnh cho user ${userId}`);

  const uploadPromises = images.map(async (item, index) => {
    let imageBytes: string;
    let mimeType: string;

    if (typeof item === "string") {
      const trimmed = item.trim();
      // Kiểm tra xem có phải URL không
      if (isImageUrl(trimmed)) {
        const fetched = await fetchImageAsBase64(trimmed);
        imageBytes = fetched.imageBytes;
        mimeType = fetched.mimeType;
      } else {
        const stripped = stripDataUrlFromBase64(trimmed);
        imageBytes = stripped.imageBytes;
        mimeType = stripped.mimeType;
      }
    } else {
      const stripped = stripDataUrlFromBase64(item.imageBytes, item.mimeType || "image/jpeg");
      imageBytes = stripped.imageBytes;
      mimeType = stripped.mimeType;
    }

    logger.info(`[processImages] Upload ảnh ${index + 1}/${images.length} (mimeType: ${mimeType})`);
    const mediaName = await uploadImageToGoogleLabs(imageBytes, mimeType, accessToken, projectId);
    logger.info(`[processImages] Upload ảnh ${index + 1} thành công, name: ${mediaName}`);
    return mediaName;
  });

  const results = await Promise.all(uploadPromises);
  logger.info(`[processImages] Hoàn thành upload ${results.length} ảnh cho user ${userId}`);
  return results;
}

/**
 * Thay thế tất cả placeholder {{fieldName}} trong text bằng giá trị từ config
 */

/**
 * Upload ảnh lên Google Labs (aisandbox) và trả về media name.
 * Endpoint: POST https://aisandbox-pa.googleapis.com/v1/flow/uploadImage
 */
export async function uploadImageToGoogleLabs(
  imageBytes: string,
  mimeType: string,
  accessToken: string,
  projectId: string
): Promise<string> {
  const endpoint = "https://aisandbox-pa.googleapis.com/v1/flow/uploadImage";
  const fileName = `photo_${Date.now()}.jpg`;

  const payload = {
    clientContext: {
      projectId,
      tool: "PINHOLE",
    },
    imageBytes,
    isUserUploaded: true,
    isHidden: false,
    mimeType: mimeType || "image/jpeg",
    fileName,
  };

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
    const err: any = new Error(`Upload image API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }

  const result = await resp.json();

  // Response là array, lấy media.name từ phần tử đầu tiên
  const mediaName = Array.isArray(result) ? result[0]?.media?.name : result?.media?.name;

  if (!mediaName) {
    const err: any = new Error("Không lấy được media name từ uploadImage response");
    err.statusCode = 500;
    throw err;
  }

  logger.info(`[uploadImage] Upload thành công, media name: ${mediaName}`);
  return mediaName;
}

function extractMediaNameFromUploadResponse(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  if (Array.isArray(result)) {
    const first = result[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    const media = first.media as { name?: string } | undefined;
    const mediaId = first.mediaId as { mediaId?: string } | string | undefined;
    if (media?.name) return media.name;
    if (typeof mediaId === "string") return mediaId;
    if (mediaId && typeof mediaId === "object" && mediaId.mediaId) return mediaId.mediaId;
    return null;
  }
  const media = r.media as { name?: string } | undefined;
  const mediaId = r.mediaId as { mediaId?: string } | string | undefined;
  if (media?.name) return media.name;
  if (typeof mediaId === "string") return mediaId;
  if (mediaId && typeof mediaId === "object" && mediaId.mediaId) return mediaId.mediaId;
  return null;
}

/**
 * Upload video lên Google Labs (aisandbox) và trả về media name.
 * Endpoint: POST https://aisandbox-pa.googleapis.com/v1/flow/uploadVideo
 */
export async function uploadVideoToGoogleLabs(
  videoBytes: string,
  mimeType: string,
  accessToken: string,
  projectId: string
): Promise<string> {
  const endpoint = "https://aisandbox-pa.googleapis.com/v1/flow/uploadVideo";
  const fileName = `video_${Date.now()}.mp4`;

  const payload = {
    clientContext: {
      projectId,
      tool: "PINHOLE",
    },
    videoBytes,
    isUserUploaded: true,
    isHidden: false,
    mimeType: mimeType || "video/mp4",
    fileName,
  };

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
    const err: any = new Error(`Upload video API error ${resp.status}: ${errText}`);
    err.statusCode = resp.status;
    throw err;
  }

  const result = await resp.json();
  const mediaName = extractMediaNameFromUploadResponse(result);

  if (!mediaName) {
    const err: any = new Error("Không lấy được media name từ uploadVideo response");
    err.statusCode = 500;
    throw err;
  }

  logger.info(`[uploadVideo] Upload thành công, media name: ${mediaName}`);
  return mediaName;
}

/**
 * Upload video tham chiếu (base64) lên Google Labs.
 */
export async function processAndUploadVideo(
  video: { videoBytes: string; mimeType?: string } | null | undefined,
  accessToken: string,
  projectId: string,
  userId: string
): Promise<string | null> {
  if (!video?.videoBytes) return null;

  logger.info(`[processVideo] Bắt đầu upload video cho user ${userId}`);
  const mediaName = await uploadVideoToGoogleLabs(
    video.videoBytes,
    video.mimeType || "video/mp4",
    accessToken,
    projectId
  );
  logger.info(`[processVideo] Hoàn thành upload video cho user ${userId}, name: ${mediaName}`);
  return mediaName;
}
