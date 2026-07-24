/**
 * Gắn flow2RequestId / media upscale fields với apiMediaTokenId — chống upscale chéo token.
 */
import redis from "../../helpers/redis";

const TTL_SEC = 7 * 24 * 60 * 60; // 7 ngày

function reqKey(flow2RequestId: string): string {
  return `api-media:owner:req:${flow2RequestId.trim()}`;
}

function mediaKey(mediaId: string, projectId: string, profileId: string): string {
  return `api-media:owner:media:${mediaId}:${projectId}:${profileId}`;
}

export async function registerApiMediaFlow2RequestOwner(
  apiMediaTokenId: string,
  flow2RequestId: string
): Promise<void> {
  const id = flow2RequestId?.trim();
  if (!id || !apiMediaTokenId) return;
  await redis.set(reqKey(id), apiMediaTokenId, "EX", TTL_SEC);
}

export async function registerApiMediaMediaUpscaleOwner(
  apiMediaTokenId: string,
  fields: { mediaId?: string; projectId?: string; profileId?: string }
): Promise<void> {
  const { mediaId, projectId, profileId } = fields;
  if (!apiMediaTokenId || !mediaId || !projectId || !profileId) return;
  await redis.set(mediaKey(mediaId, projectId, profileId), apiMediaTokenId, "EX", TTL_SEC);
}

export async function assertApiMediaFlow2RequestOwner(
  apiMediaTokenId: string,
  flow2RequestId: string
): Promise<void> {
  const id = flow2RequestId?.trim();
  if (!id) {
    const err: any = new Error("Thiếu flow2RequestId");
    err.statusCode = 400;
    throw err;
  }
  const owner = await redis.get(reqKey(id));
  if (!owner) {
    const err: any = new Error(
      "Không tìm thấy quyền upscale cho request này (đã hết hạn hoặc không phải request của bạn)"
    );
    err.statusCode = 403;
    throw err;
  }
  if (owner !== apiMediaTokenId) {
    const err: any = new Error("Bạn không có quyền upscale request này");
    err.statusCode = 403;
    throw err;
  }
}

export async function assertApiMediaMediaUpscaleOwner(
  apiMediaTokenId: string,
  mediaId: string,
  projectId: string,
  profileId: string
): Promise<void> {
  const owner = await redis.get(mediaKey(mediaId, projectId, profileId));
  if (owner && owner !== apiMediaTokenId) {
    const err: any = new Error("Bạn không có quyền upscale media này");
    err.statusCode = 403;
    throw err;
  }
}
