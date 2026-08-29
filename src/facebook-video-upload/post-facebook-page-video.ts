/**
 * Facebook Graph API — đăng video lên Fanpage.
 *
 * Credential `FACEBOOK_OAUTH_KEY` (Customer):
 * - JSON: { access_token, page_id }
 * - Hoặc chuỗi Page Access Token thuần (khi page_id gửi kèm trong request)
 */
import fs from "fs";
import axios, { AxiosError } from "axios";
import FormData from "form-data";
import { credentialService } from "../libs/dal/credential";
import { AiProviderKeyEnum } from "../libs/dal/product";
import { decryptProviderSecret } from "../packages/encryption/encrypt-provider";
import { resolveVideoToTempFile } from "../shopee-video-upload/pipeline/resolve-video-file";

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

function facebookApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const data = ax.response?.data;
    const msg =
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === "string" ? data.error : null) ||
      ax.message;
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

function buildFacebookVideoUrl(videoId: string): string {
  return `https://www.facebook.com/watch/?v=${videoId}`;
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

  const privacyStatus: FacebookPrivacyStatus = input.privacyStatus || "private";
  const published = resolvePublished(privacyStatus);
  const description = asString(input.description);
  const affiliateLink = asString(input.affiliateLink);

  const credential = await loadFacebookCredential(input.customerId);
  const pageId = asString(input.pageId) || credential.pageId;
  if (!pageId) {
    throw new Error(
      "Thiếu Page ID — thêm page_id vào credential Facebook (JSON: { access_token, page_id })"
    );
  }

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
      url: buildFacebookVideoUrl(videoId),
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
