/**
 * Các bước gọi Shopee API — port từ MLS V13.3 handle-upload.service.js.
 * Khi dryRun=true: pipeline không gọi các hàm này.
 */
import axios, { AxiosRequestConfig } from "axios";
import FormData from "form-data";
import fs from "fs";
import { signerClient } from "../signer/signer.client";
import { buildUrls, getCountry } from "./country";
import { toAxiosProxy } from "./proxy";

const UA_APP = "okhttp/3.12.4 app_type=1";
const UA_CDN = "WCS-Android-SDK-1.6.8";

/** Trích csrftoken từ cookie string */
function extractCsrf(cookie: string): string {
  const m = cookie.match(/csrftoken=([^;]+)/);
  return m ? m[1] : "";
}

/** Trích SPC_U (userId) từ cookie string */
function extractUserId(cookie: string): string {
  const m = cookie.match(/SPC_U=([^;]+)/);
  return m ? m[1] : "";
}

function baseConfig(cookie: string, proxy?: string): AxiosRequestConfig {
  const px = toAxiosProxy(proxy);
  return {
    timeout: 30000,
    headers: { cookie, "user-agent": UA_APP },
    ...(px ? { proxy: px } : {}),
    validateStatus: () => true,
  };
}

export type PreuploadResult = { vid: string; upload_token: string };

export async function getUploadInfo(params: {
  cookie: string;
  country?: string;
  proxy?: string;
}): Promise<PreuploadResult> {
  const urls = buildUrls(params.country);
  const cfg = baseConfig(params.cookie, params.proxy);
  const body = {
    biz: 124,
    ver: 3,
    mediatype: 1,
    reportdata: {
      sdkversion: "1.6.8",
      appversion: "34145",
      ostype: "0",
      osversion: "34",
      token_type: 0,
      reporttime: Date.now(),
    },
  };
  const resp = await axios.post(urls.PREUPLOAD, body, {
    ...cfg,
    headers: { ...cfg.headers, "content-type": "application/json" },
  });
  const data = resp.data?.data || resp.data;
  const vid = data?.vid || data?.video_id;
  const upload_token = data?.upload_token || data?.token;
  if (!vid || !upload_token) {
    throw new Error(
      `preupload failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 300)}`
    );
  }
  return { vid: String(vid), upload_token: String(upload_token) };
}

/** Bước precheck — ký qua signer rồi POST tới Shopee, trả extra_context */
export async function precheck(params: {
  cookie: string;
  country?: string;
  proxy?: string;
  body: unknown;
}): Promise<{ extra_context: unknown; signedHeaders: Record<string, string> }> {
  const urls = buildUrls(params.country);
  const c = getCountry(params.country);
  const csrf = extractCsrf(params.cookie);

  const signed = await signerClient.sign({
    url: urls.PRECHECK,
    body: params.body,
    cookie: params.cookie,
    country: params.country,
    proxy: params.proxy,
  });
  if (signed.code !== 0 || !signed.data?.headers) {
    throw new Error(signed.message || `signer sign failed code=${signed.code}`);
  }

  const cfg = baseConfig(params.cookie, params.proxy);
  const resp = await axios.post(urls.PRECHECK, params.body, {
    ...cfg,
    headers: {
      "Accept-Encoding": "gzip",
      "af-ac-enc-sz-token": "",
      "Cache-Control": "no-cache, no-store",
      "client-info":
        "device_id=Qs89IS%2BDlxAYPzSRpvyXF1fld5iOiKGEE47uEZ64IFI%3D;device_model=SM-G991B;os=0;os_version=34;client_version=35943;network=1;platform=1;rn_version=6.97.5;api_source=na",
      "Client-Request-Id": `${Date.now()}.${Math.random().toString(36).slice(2, 8)}`,
      "Content-Type": "application/json; charset=UTF-8",
      Cookie: params.cookie,
      Host: urls.SV_HOST,
      language: c.language,
      sfid: "",
      SHOPEE_HTTP_DNS_MODE: "1",
      "User-Agent": UA_APP,
      "X-CSRFToken": csrf,
      "X-SAP-Type": "1",
      "X-Shopee-Client-Timezone": c.timezone,
      ...signed.data.headers,
    },
  });
  if (resp.status >= 400) {
    throw new Error(`precheck failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 200)}`);
  }
  const extra = resp.data?.data?.extra_context ?? resp.data?.extra_context ?? {};
  return { extra_context: extra, signedHeaders: signed.data.headers };
}

/**
 * Upload file lên CDN Shopee (WCS).
 * Token CDN lấy từ signer /generate_token; MLS FormData: field "token" + "key" + "file".
 */
export async function uploadFileToCdn(params: {
  filePath: string;
  vid: string;
  cookie?: string;
  country?: string;
  proxy?: string;
}): Promise<void> {
  const tokenRes = await signerClient.generateToken({
    cookie: params.cookie,
    country: params.country,
  });
  if (tokenRes.code !== 0 || !tokenRes.data?.token) {
    throw new Error(tokenRes.message || `generate_token failed code=${tokenRes.code}`);
  }

  const urls = buildUrls(params.country);
  const form = new FormData();
  // MLS uploadFileToShopee: append("token", tokenValue) — không phải "uploadid"
  form.append("token", tokenRes.data.token);
  form.append("key", `${params.vid}.mp4`);
  form.append("file", fs.createReadStream(params.filePath), {
    filename: `${params.vid}.mp4`,
    contentType: "video/mp4",
  });

  const px = toAxiosProxy(params.proxy);
  const resp = await axios.post(urls.VIDEO_UPLOAD, form, {
    timeout: 180000,
    headers: {
      ...form.getHeaders(),
      "user-agent": UA_CDN,
      Accept: "*/*",
      Connection: "Keep-Alive",
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    ...(px ? { proxy: px } : {}),
    validateStatus: () => true,
  });
  if (resp.status >= 400) {
    throw new Error(`CDN upload failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 200)}`);
  }
}

export async function reportUpload(params: {
  cookie: string;
  country?: string;
  proxy?: string;
  vid: string;
  fsize: number;
  durationMs?: number;
}): Promise<void> {
  const urls = buildUrls(params.country);
  const c = getCountry(params.country);
  const cfg = baseConfig(params.cookie, params.proxy);

  const randomMd5 = () =>
    Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  const body = {
    ver: 0,
    extendid: params.vid,
    code: 0,
    vid: params.vid,
    biz: 124,
    cover_md5: randomMd5(),
    fsize: params.fsize || 40500000,
    videourl: urls.VIDEO_DOWNLOAD(params.vid),
    ab_test: "",
    reportdata: { ostype: "0", app_id: c.code === "vn" ? "vn_shopee" : "shopee" },
    serviceid: "",
    fileinfos: {
      duration: params.durationMs ?? 0,
      vbitrate: 0,
      abitrate: 0,
      width: 0,
      fps: 0,
      mediatype: 1,
      height: 0,
    },
    cover_fsize: 32393,
    md5: randomMd5(),
  };
  const resp = await axios.post(urls.REPORT_UPLOAD, body, {
    ...cfg,
    headers: { ...cfg.headers, "content-type": "application/json" },
  });
  if (resp.status >= 400) {
    throw new Error(`report upload failed: HTTP ${resp.status}`);
  }
}

export async function createPost(params: {
  cookie: string;
  country?: string;
  proxy?: string;
  payload: unknown;
}): Promise<{ postId: string }> {
  const urls = buildUrls(params.country);

  // 1) MLS processLocalVideoUpload: proxy /api/createpost (ký + gọi Shopee)
  const viaCredit = await signerClient.createPost({
    url: urls.CREATE_POST,
    cookie: params.cookie,
    country: params.country,
    proxy: params.proxy,
    payload: params.payload,
  });
  if (viaCredit.code === 0) {
    const postId =
      viaCredit.data?.post_id || viaCredit.data?.postId || viaCredit.data?.id || "";
    if (postId) return { postId: String(postId) };
  }

  // 2) Fallback: ký header rồi POST thẳng tới Shopee (MLS createPost remote path)
  if (viaCredit.code !== 501) {
    // eslint-disable-next-line no-console
    console.warn(
      `[shopee-upload] create_post credit code=${viaCredit.code}: ${viaCredit.message || ""} — fallback sign+direct`
    );
  }

  const signed = await signerClient.sign({
    url: urls.CREATE_POST,
    body: params.payload,
    cookie: params.cookie,
    country: params.country,
    proxy: params.proxy,
  });
  if (signed.code !== 0 || !signed.data?.headers) {
    throw new Error(
      viaCredit.message ||
        signed.message ||
        `signer sign (create) failed code=${signed.code}`
    );
  }
  const cfg = baseConfig(params.cookie, params.proxy);
  const csrf = extractCsrf(params.cookie);
  const resp = await axios.post(urls.CREATE_POST, params.payload, {
    ...cfg,
    headers: {
      ...cfg.headers,
      ...signed.data.headers,
      "content-type": "application/json; charset=UTF-8",
      "X-CSRFToken": csrf,
      Host: urls.SV_HOST,
    },
  });
  if (resp.status >= 400) {
    throw new Error(
      `createPost failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 300)}`
    );
  }
  const d = resp.data?.data || resp.data;
  const postId = d?.post_id || d?.id || "";
  if (!postId) {
    throw new Error(`createPost: missing post_id — ${JSON.stringify(resp.data).slice(0, 300)}`);
  }
  return { postId: String(postId) };
}

export async function check24hPosts(params: {
  cookie: string;
  country?: string;
  proxy?: string;
}): Promise<{ count24h: number; canPost: boolean }> {
  const urls = buildUrls(params.country);
  const cfg = baseConfig(params.cookie, params.proxy);
  const resp = await axios.get(urls.TIMELINE_ME, {
    ...cfg,
    params: { need_product_v2: true, limit: 50 },
  });
  if (resp.status === 401 || resp.status === 403) {
    throw new Error("Cookie hết hạn hoặc bị hạn chế");
  }
  if (resp.status >= 400) {
    throw new Error(`check-24h failed: HTTP ${resp.status}`);
  }
  const list = resp.data?.data?.list || resp.data?.data?.posts || resp.data?.list || [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  let count24h = 0;
  if (Array.isArray(list)) {
    for (const item of list) {
      const ts = Number(item?.ctime || item?.create_time || item?.created_at || 0);
      const ms = ts > 1e12 ? ts : ts * 1000;
      if (ms && now - ms <= dayMs) count24h += 1;
    }
  }
  return { count24h, canPost: count24h < 50 };
}
