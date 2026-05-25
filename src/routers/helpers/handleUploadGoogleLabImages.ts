import logger from "../../helpers/logger";

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

/**
 * Fetch ảnh từ URL và chuyển thành base64 string.
 * Trả về { imageBytes (base64), mimeType }.
 */
export async function fetchImageAsBase64(url: string): Promise<{ imageBytes: string; mimeType: string }> {
  logger.info(`[processImages] Đang fetch ảnh từ URL: ${url}`);
  const resp = await fetch(url);
  if (!resp.ok) {
    const err: any = new Error(`Không thể fetch ảnh từ URL (${resp.status}): ${url}`);
    err.statusCode = 400;
    throw err;
  }
  const contentType = resp.headers.get("content-type") || undefined;
  const mimeType = getMimeTypeFromUrl(url, contentType);
  const arrayBuffer = await resp.arrayBuffer();
  const imageBytes = Buffer.from(arrayBuffer).toString("base64");
  logger.info(
    `[processImages] Fetch thành công, size: ${imageBytes.length} chars, mimeType: ${mimeType}`
  );
  return { imageBytes, mimeType };
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
      // Kiểm tra xem có phải URL không
      if (isImageUrl(item)) {
        const fetched = await fetchImageAsBase64(item);
        imageBytes = fetched.imageBytes;
        mimeType = fetched.mimeType;
      } else {
        // Coi như là base64 string trực tiếp
        imageBytes = item;
        mimeType = "image/jpeg";
      }
    } else {
      // Object { imageBytes, mimeType }
      imageBytes = item.imageBytes;
      mimeType = item.mimeType || "image/jpeg";
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
