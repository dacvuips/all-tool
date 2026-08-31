/**
 * Facebook Graph API — đăng video lên Fanpage.
 *
 * Credential `FACEBOOK_OAUTH_KEY` (Customer):
 * - Page Access Token thuần, hoặc
 * - JSON: { access_token, page_id? } — page_id tuỳ chọn, tự lấy từ token nếu thiếu
 */
import fs from "fs";
import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { credentialService } from "../libs/dal/credential";
import { AiProviderKeyEnum } from "../libs/dal/product";
import { decryptProviderSecret } from "../packages/encryption/encrypt-provider";
import { resolveVideoToTempFile } from "../shopee-video-upload/pipeline/resolve-video-file";
import { assertFacebookPageAccessToken } from "./validate-page-access-token";

export type FacebookPrivacyStatus = "private" | "public" | "unlisted";

export interface PostFacebookPageVideoInput {
  customerId: string;
  videoUrl?: string;
  videoBase64?: string;
  title: string;
  description?: string;
  /** private | public | unlisted — unlisted map sang public (FB không có unlisted) */
  privacyStatus?: FacebookPrivacyStatus;
  /** Link affiliate — nối vào mô tả và đăng comment trên video */
  affiliateLink?: string;
  /** Ghi đè page_id từ credential (tuỳ chọn) */
  pageId?: string;
}

export interface PostFacebookPageVideoResult {
  videoId: string;
  url: string;
  title: string;
  pageId: string;
  published: boolean;
  linkCommentId?: string | null;
  linkCommentWarning?: string | null;
}

type FacebookOAuthPayload = {
  accessToken: string;
  pageId?: string;
};

const GRAPH_API_VERSION = "v21.0";

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function parseFacebookErrorPayload(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "object" && !Buffer.isBuffer(data)) {
    return data as Record<string, unknown>;
  }
  const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const trimmed = text.trim();
    return trimmed ? { raw: trimmed.slice(0, 500) } : null;
  }
}

function facebookApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const parsed = parseFacebookErrorPayload(ax.response?.data);
    const fbError =
      parsed?.error && typeof parsed.error === "object"
        ? (parsed.error as Record<string, unknown>)
        : null;
    const code = fbError?.code ?? parsed?.code;
    const msg =
      asString(fbError?.error_user_msg) ||
      asString(fbError?.message) ||
      asString(parsed?.error_description) ||
      (typeof parsed?.error === "string" ? parsed.error : "") ||
      asString(parsed?.raw) ||
      ax.message;

    console.warn("[postFacebookPageVideo] Facebook API error:", {
      status: ax.response?.status,
      code,
      message: msg,
      data: parsed,
    });

    if (code === 190 || /invalid oauth|access token/i.test(String(msg))) {
      return (
        "Facebook API: Token không hợp lệ hoặc đã hết hạn (#190). " +
        "Lấy lại Page Access Token trong Graph API Explorer → chọn đúng Fanpage → Lưu credential."
      );
    }

    if (code === 100 && /no permission to publish the video/i.test(String(msg))) {
      return (
        "Facebook API: Không có quyền đăng video (#100). " +
        "Thường do dán User Token thay vì Page Access Token, hoặc thiếu quyền pages_manage_posts / publish_video. " +
        "Xem Hướng dẫn Facebook → Bước 3: gọi GET /me/accounts → copy access_token của Fanpage."
      );
    }

    if (code === 200 || /permission/i.test(String(msg))) {
      return `Facebook API: Thiếu quyền (#${code ?? "?"}): ${msg}`;
    }

    const status = ax.response?.status;
    if (status) {
      return `Facebook API (${status}${code ? ` #${code}` : ""}): ${msg}`;
    }

    return `Facebook API: ${msg}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function parseOAuthPayload(plain: string): FacebookOAuthPayload {
  const text = asString(plain);
  if (!text) {
    throw new Error("Credential Facebook trống — hãy nhập Page Access Token trong Cài đặt MXH");
  }

  if (text.startsWith("{")) {
    try {
      const obj = JSON.parse(text) as Record<string, unknown>;
      const accessToken = asString(
        obj.access_token ?? obj.accessToken ?? obj.page_access_token ?? obj.token ?? obj.value
      );
      if (!accessToken) {
        throw new Error("JSON credential thiếu access_token");
      }
      return {
        accessToken,
        pageId: asString(obj.page_id ?? obj.pageId) || undefined,
      };
    } catch (e) {
      if (e instanceof Error && e.message.includes("access_token")) throw e;
      throw new Error("Credential Facebook JSON không hợp lệ");
    }
  }

  return { accessToken: text };
}

async function loadFacebookCredential(customerId: string): Promise<FacebookOAuthPayload> {
  const doc = await credentialService.findOne({
    key: AiProviderKeyEnum.FACEBOOK_OAUTH_KEY,
    customerId,
    isCustomerCredential: true,
    active: { $ne: false },
  });
  if (!doc) {
    throw new Error(
      "Chưa kết nối Facebook — thêm credential FACEBOOK_OAUTH_KEY trong Cài đặt Tự động đăng MXH"
    );
  }
  const raw = (doc as any)._doc?.value ?? (doc as any).value;
  const plain = decryptProviderSecret(String(raw || ""));
  return parseOAuthPayload(plain);
}

function buildAffiliateLinkCommentText(link: string): string {
  return `🔗 Link sản phẩm:\n${asString(link)}`;
}

function buildFacebookVideoUrl(videoId: string, pageId?: string): string {
  const id = asString(videoId);
  const page = asString(pageId);
  if (page) {
    return `https://www.facebook.com/${page}/videos/${id}/`;
  }
  return `https://www.facebook.com/watch/?v=${id}`;
}

async function resolvePageIdFromToken(accessToken: string): Promise<string> {
  const info = await assertFacebookPageAccessToken(accessToken);
  return info.pageId;
}

async function resolvePageId(
  accessToken: string,
  explicitPageId?: string
): Promise<string> {
  const pageId = asString(explicitPageId);
  if (pageId) return pageId;
  return resolvePageIdFromToken(accessToken);
}

function resolvePublished(privacyStatus: FacebookPrivacyStatus): boolean {
  return privacyStatus !== "private";
}

async function postFacebookAffiliateLinkComment(input: {
  accessToken: string;
  videoId: string;
  link: string;
}): Promise<string> {
  const videoId = asString(input.videoId);
  const link = asString(input.link);
  if (!videoId || !link) {
    throw new Error("Thiếu videoId hoặc link để đăng comment");
  }

  const resp = await axios.post(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${videoId}/comments`,
    null,
    {
      params: {
        access_token: input.accessToken,
        message: buildAffiliateLinkCommentText(link).slice(0, 8000),
      },
      timeout: 30000,
    }
  );

  const commentId = asString(resp.data?.id);
  if (!commentId) {
    throw new Error("Facebook không trả comment id");
  }
  return commentId;
}

/**
 * Upload video lên Fanpage qua Graph API (multipart).
 */
export async function postFacebookPageVideo(
  input: PostFacebookPageVideoInput
): Promise<PostFacebookPageVideoResult> {
  const title = asString(input.title);
  if (!title) throw new Error("Thiếu tiêu đề video (title)");
  if (!input.videoUrl && !input.videoBase64) {
    throw new Error("Thiếu videoUrl hoặc videoBase64");
  }

  const privacyStatus: FacebookPrivacyStatus = input.privacyStatus || "public";
  const published = resolvePublished(privacyStatus);
  const description = asString(input.description);
  const affiliateLink = asString(input.affiliateLink);

  const credential = await loadFacebookCredential(input.customerId);
  const pageId = await resolvePageId(
    credential.accessToken,
    asString(input.pageId) || credential.pageId
  );

  const { filePath, cleanup } = await resolveVideoToTempFile({
    videoUrl: input.videoUrl,
    videoBase64: input.videoBase64,
    filenameHint: "facebook",
  });

  try {
    const form = new FormData();
    form.append("access_token", credential.accessToken);
    form.append("title", title.slice(0, 255));
    if (description) {
      form.append("description", description.slice(0, 5000));
    }
    form.append("published", published ? "true" : "false");
    form.append("source", fs.createReadStream(filePath));

    const uploadUrl = `https://graph-video.facebook.com/${GRAPH_API_VERSION}/${pageId}/videos`;

    const resp = await axios.post(uploadUrl, form, {
      headers: form.getHeaders(),
      timeout: 10 * 60 * 1000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const videoId = asString(resp.data?.id);
    if (!videoId) {
      throw new Error("Upload xong nhưng Facebook không trả video id");
    }

    const result: PostFacebookPageVideoResult = {
      videoId,
      url: buildFacebookVideoUrl(videoId, pageId),
      title,
      pageId,
      published,
    };

    if (affiliateLink) {
      try {
        result.linkCommentId = await postFacebookAffiliateLinkComment({
          accessToken: credential.accessToken,
          videoId,
          link: affiliateLink,
        });
      } catch (err) {
        result.linkCommentWarning =
          err instanceof Error
            ? err.message
            : "Không thể đăng comment link — kiểm tra quyền pages_manage_engagement";
        console.warn("[postFacebookPageVideo] affiliate link comment failed:", err);
      }
    }

    return result;
  } catch (err) {
    throw new Error(facebookApiErrorMessage(err));
  } finally {
    cleanup();
  }
}
