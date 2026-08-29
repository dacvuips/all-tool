/**
 * YouTube Data API v3 — đăng video (resumable upload).
 *
 * Credential `YOUTUBE_OAUTH_KEY` (Customer):
 * - Chuỗi access_token thuần, hoặc
 * - JSON: { access_token, refresh_token?, client_id?, client_secret?, expiry_date? }
 *
 * Env (tuỳ chọn, dùng khi refresh token):
 * - YOUTUBE_OAUTH_CLIENT_ID
 * - YOUTUBE_OAUTH_CLIENT_SECRET
 */
import fs from "fs";
import axios, { AxiosError } from "axios";
import { credentialService } from "../libs/dal/credential";
import { AiProviderKeyEnum } from "../libs/dal/product";
import { decryptProviderSecret } from "../packages/encryption/encrypt-provider";
import { resolveVideoToTempFile } from "../shopee-video-upload/pipeline/resolve-video-file";

export type YoutubePrivacyStatus = "private" | "public" | "unlisted";

export interface PostYoutubeVideoInput {
  customerId: string;
  /** URL http(s) / data URI / local path */
  videoUrl?: string;
  /** base64 raw (không prefix data:) */
  videoBase64?: string;
  title: string;
  description?: string;
  tags?: string[];
  /** Mặc định 22 = People & Blogs */
  categoryId?: string;
  privacyStatus?: YoutubePrivacyStatus;
  madeForKids?: boolean;
  /** Link affiliate — đăng thêm comment trên video (cần scope youtube.force-ssl). */
  affiliateLink?: string;
}

export interface PostYoutubeVideoResult {
  videoId: string;
  url: string;
  title: string;
  privacyStatus: string;
  channelId?: string | null;
  /** Comment chứa link (nếu affiliateLink có và API comment thành công) */
  linkCommentId?: string | null;
  linkCommentWarning?: string | null;
}

type YoutubeOAuthPayload = {
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  expiryDate?: number;
  rawWasJson: boolean;
};

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function youtubeApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const data = ax.response?.data;
    const msg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === "string" ? data.error : null) ||
      ax.message;
    return `YouTube API: ${msg}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function parseOAuthPayload(plain: string): YoutubeOAuthPayload {
  const text = asString(plain);
  if (!text) {
    throw new Error("Credential YouTube trống — hãy nhập OAuth token trong Cài đặt MXH");
  }

  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const accessToken = asString(
        obj.access_token ?? obj.accessToken ?? obj.token ?? obj.value
      );
      if (!accessToken) {
        throw new Error("JSON credential thiếu access_token");
      }
      return {
        accessToken,
        refreshToken: asString(obj.refresh_token ?? obj.refreshToken) || undefined,
        clientId: asString(obj.client_id ?? obj.clientId) || undefined,
        clientSecret: asString(obj.client_secret ?? obj.clientSecret) || undefined,
        expiryDate: Number(obj.expiry_date ?? obj.expiryDate) || undefined,
        rawWasJson: true,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("access_token")) throw e;
      throw new Error("Credential YouTube JSON không hợp lệ");
    }
  }

  return { accessToken: text, rawWasJson: false };
}

async function loadYoutubeCredential(customerId: string): Promise<{
  credentialId: string;
  payload: YoutubeOAuthPayload;
}> {
  const doc = await credentialService.findOne({
    key: AiProviderKeyEnum.YOUTUBE_OAUTH_KEY,
    customerId,
    isCustomerCredential: true,
    active: { $ne: false },
  });
  if (!doc) {
    throw new Error(
      "Chưa kết nối YouTube — thêm credential YOUTUBE_OAUTH_KEY trong Cài đặt Tự động đăng MXH"
    );
  }
  const raw = (doc as any)._doc?.value ?? (doc as any).value;
  const plain = decryptProviderSecret(String(raw || ""));
  return {
    credentialId: String((doc as any)._id || (doc as any).id),
    payload: parseOAuthPayload(plain),
  };
}

async function refreshAccessToken(
  payload: YoutubeOAuthPayload
): Promise<YoutubeOAuthPayload> {
  const clientId =
    payload.clientId || asString(process.env.YOUTUBE_OAUTH_CLIENT_ID);
  const clientSecret =
    payload.clientSecret || asString(process.env.YOUTUBE_OAUTH_CLIENT_SECRET);
  if (!payload.refreshToken || !clientId || !clientSecret) {
    throw new Error(
      "Access token hết hạn và thiếu refresh_token / client_id / client_secret để làm mới"
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: payload.refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await axios.post("https://oauth2.googleapis.com/token", body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
  });

  const accessToken = asString(resp.data?.access_token);
  if (!accessToken) {
    throw new Error("Refresh token YouTube thất bại — không nhận được access_token");
  }

  const expiresIn = Number(resp.data?.expires_in) || 3600;
  return {
    ...payload,
    accessToken,
    expiryDate: Date.now() + expiresIn * 1000,
    clientId,
    clientSecret,
  };
}

async function persistRefreshedCredential(
  credentialId: string,
  payload: YoutubeOAuthPayload
): Promise<void> {
  if (!payload.rawWasJson) return;
  const next = {
    access_token: payload.accessToken,
    refresh_token: payload.refreshToken,
    client_id: payload.clientId,
    client_secret: payload.clientSecret,
    expiry_date: payload.expiryDate,
  };
  // credentialService.updateOne tự encrypt value
  await credentialService.updateOne(credentialId, {
    value: JSON.stringify(next),
  } as any);
}

async function ensureFreshAccessToken(
  customerId: string
): Promise<{ accessToken: string; credentialId: string }> {
  const { credentialId, payload } = await loadYoutubeCredential(customerId);
  const needsRefresh =
    !!payload.refreshToken &&
    !!payload.expiryDate &&
    payload.expiryDate < Date.now() + 60_000;

  if (!needsRefresh) {
    return { accessToken: payload.accessToken, credentialId };
  }

  const refreshed = await refreshAccessToken(payload);
  await persistRefreshedCredential(credentialId, refreshed);
  return { accessToken: refreshed.accessToken, credentialId };
}

async function withTokenRetry<T>(
  customerId: string,
  accessToken: string,
  credentialId: string,
  run: (token: string) => Promise<T>
): Promise<T> {
  try {
    return await run(accessToken);
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : 0;
    if (status !== 401) throw err;

    const { payload } = await loadYoutubeCredential(customerId);
    if (!payload.refreshToken) throw err;

    const refreshed = await refreshAccessToken(payload);
    await persistRefreshedCredential(credentialId, refreshed);
    return run(refreshed.accessToken);
  }
}

function buildAffiliateLinkCommentText(link: string): string {
  const url = asString(link);
  return `🔗 Link sản phẩm:\n${url}`;
}

/**
 * Đăng comment chứa link lên video (YouTube Data API — commentThreads.insert).
 * Card / end screen không có public API; đây là cách chính thức gần nhất.
 */
async function postYoutubeAffiliateLinkComment(input: {
  customerId: string;
  accessToken: string;
  credentialId: string;
  videoId: string;
  channelId: string;
  link: string;
}): Promise<string> {
  const channelId = asString(input.channelId);
  const videoId = asString(input.videoId);
  const link = asString(input.link);
  if (!channelId || !videoId || !link) {
    throw new Error("Thiếu channelId, videoId hoặc link để đăng comment");
  }

  const insert = async (token: string) => {
    const resp = await axios.post(
      "https://www.googleapis.com/youtube/v3/commentThreads",
      {
        snippet: {
          channelId,
          videoId,
          topLevelComment: {
            snippet: {
              textOriginal: buildAffiliateLinkCommentText(link).slice(0, 10_000),
            },
          },
        },
      },
      {
        params: { part: "snippet" },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const threadId = asString(resp.data?.id);
    if (!threadId) {
      throw new Error("YouTube không trả commentThread id");
    }
    return threadId;
  };

  return withTokenRetry(input.customerId, input.accessToken, input.credentialId, insert);
}

/**
 * Resumable upload → trả videoId trên YouTube.
 */
export async function postYoutubeVideo(
  input: PostYoutubeVideoInput
): Promise<PostYoutubeVideoResult> {
  const title = asString(input.title);
  if (!title) throw new Error("Thiếu tiêu đề video (title)");
  if (!input.videoUrl && !input.videoBase64) {
    throw new Error("Thiếu videoUrl hoặc videoBase64");
  }

  const privacyStatus: YoutubePrivacyStatus = input.privacyStatus || "private";
  const categoryId = asString(input.categoryId) || "22";
  const description = asString(input.description);
  const tags = (input.tags || []).map((t) => asString(t)).filter(Boolean);

  const { accessToken, credentialId } = await ensureFreshAccessToken(input.customerId);
  const { filePath, cleanup } = await resolveVideoToTempFile({
    videoUrl: input.videoUrl,
    videoBase64: input.videoBase64,
    filenameHint: "youtube",
  });

  try {
    const fileSize = fs.statSync(filePath).size;
    const fileBuffer = fs.readFileSync(filePath);

    const metadata = {
      snippet: {
        title: title.slice(0, 100),
        description,
        tags,
        categoryId,
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: !!input.madeForKids,
      },
    };

    const initUpload = async (token: string) => {
      const initResp = await axios.post(
        "https://www.googleapis.com/upload/youtube/v3/videos",
        metadata,
        {
          params: {
            uploadType: "resumable",
            part: "snippet,status",
          },
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Length": String(fileSize),
            "X-Upload-Content-Type": "video/*",
          },
          timeout: 60000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          validateStatus: (s) => s >= 200 && s < 400,
        }
      );

      const uploadUrl =
        initResp.headers?.location ||
        initResp.headers?.Location ||
        (initResp.headers as any)?.["location"];
      if (!uploadUrl) {
        throw new Error("YouTube không trả Location URL cho resumable upload");
      }
      return String(uploadUrl);
    };

    const uploadUrl = await withTokenRetry(
      input.customerId,
      accessToken,
      credentialId,
      initUpload
    );

    const putUpload = async (token: string) => {
      const putResp = await axios.put(uploadUrl, fileBuffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "video/*",
          "Content-Length": String(fileSize),
        },
        timeout: 10 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return putResp.data;
    };

    let videoData: any;
    try {
      videoData = await putUpload(accessToken);
    } catch (err) {
      // Session upload URL gắn với token ban đầu — nếu 401 thì refresh rồi init lại toàn bộ
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        const { payload } = await loadYoutubeCredential(input.customerId);
        const refreshed = await refreshAccessToken(payload);
        await persistRefreshedCredential(credentialId, refreshed);
        const retryUrl = await initUpload(refreshed.accessToken);
        const putResp = await axios.put(retryUrl, fileBuffer, {
          headers: {
            Authorization: `Bearer ${refreshed.accessToken}`,
            "Content-Type": "video/*",
            "Content-Length": String(fileSize),
          },
          timeout: 10 * 60 * 1000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        });
        videoData = putResp.data;
      } else {
        throw err;
      }
    }

    const videoId = asString(videoData?.id);
    if (!videoId) {
      throw new Error("Upload xong nhưng YouTube không trả videoId");
    }

    const channelId = asString(videoData?.snippet?.channelId) || null;
    const result: PostYoutubeVideoResult = {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: asString(videoData?.snippet?.title) || title,
      privacyStatus: asString(videoData?.status?.privacyStatus) || privacyStatus,
      channelId,
    };

    const affiliateLink = asString(input.affiliateLink);
    if (affiliateLink && channelId) {
      try {
        result.linkCommentId = await postYoutubeAffiliateLinkComment({
          customerId: input.customerId,
          accessToken,
          credentialId,
          videoId,
          channelId,
          link: affiliateLink,
        });
      } catch (err) {
        result.linkCommentWarning =
          err instanceof Error
            ? err.message
            : "Không thể đăng comment link — kiểm tra scope youtube.force-ssl";
        console.warn("[postYoutubeVideo] affiliate link comment failed:", err);
      }
    }

    return result;
  } catch (err) {
    throw new Error(youtubeApiErrorMessage(err));
  } finally {
    cleanup();
  }
}
