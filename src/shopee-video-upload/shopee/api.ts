/**
 * Các bước gọi Shopee API (skeleton MLS).
 * Khi dryRun=true: pipeline không gọi các hàm này.
 */
import axios, { AxiosRequestConfig } from "axios";
import fs from "fs";
import { signerClient } from "../signer/signer.client";
import { buildUrls } from "./country";
import { toAxiosProxy } from "./proxy";

const UA_APP =
  "okhttp/3.12.4 App/shopee language=vi appver=34145 app_type=1";

function baseConfig(cookie: string, proxy?: string): AxiosRequestConfig {
  const px = toAxiosProxy(proxy);
  return {
    timeout: 30000,
    headers: {
      cookie,
      "user-agent": UA_APP,
    },
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
  const resp = await axios.post(
    urls.PREUPLOAD,
    { mediatype: 1, biz: 124 },
    { ...cfg, headers: { ...cfg.headers, "content-type": "application/json" } }
  );
  const data = resp.data?.data || resp.data;
  const vid = data?.vid || data?.video_id;
  const upload_token = data?.upload_token || data?.token;
  if (!vid || !upload_token) {
    throw new Error(
      `preupload failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 200)}`
    );
  }
  return { vid: String(vid), upload_token: String(upload_token) };
}

export async function precheck(params: {
  cookie: string;
  country?: string;
  proxy?: string;
  body: unknown;
}): Promise<{ extra_context: unknown; signedHeaders: Record<string, string> }> {
  const urls = buildUrls(params.country);
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
      ...cfg.headers,
      ...signed.data.headers,
      "content-type": "application/json",
    },
  });
  if (resp.status >= 400) {
    throw new Error(`precheck failed: HTTP ${resp.status}`);
  }
  const extra = resp.data?.data?.extra_context ?? resp.data?.extra_context ?? {};
  return { extra_context: extra, signedHeaders: signed.data.headers };
}

/**
 * Upload file lên CDN — dùng stream file + multipart thủ công tối giản.
 * Token CDN lấy từ signer /generate-token.
 */
export async function uploadFileToCdn(params: {
  filePath: string;
  uploadToken: string;
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
  const boundary = `----ShopeeUpload${Date.now()}`;
  const fileBuf = fs.readFileSync(params.filePath);
  const parts: Buffer[] = [];
  const pushField = (name: string, value: string) => {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      )
    );
  };
  pushField("token", tokenRes.data.token);
  pushField("upload_token", params.uploadToken);
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="video.mp4"\r\nContent-Type: video/mp4\r\n\r\n`
    )
  );
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  // Node Buffer.concat typing vs Uint8Array — cast an toàn
  const body = Buffer.concat(parts as any);

  const px = toAxiosProxy(params.proxy);
  const resp = await axios.post(urls.VIDEO_UPLOAD, body, {
    timeout: 120000,
    headers: {
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "user-agent": "WCS-Android-SDK-1.6.8",
      "Content-Length": body.length,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    ...(px ? { proxy: px } : {}),
    validateStatus: () => true,
  });
  if (resp.status >= 400) {
    throw new Error(`CDN upload failed: HTTP ${resp.status}`);
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
  const cfg = baseConfig(params.cookie, params.proxy);
  const body = {
    vid: params.vid,
    fsize: params.fsize,
    duration: params.durationMs ?? 30000,
    width: 720,
    height: 1280,
    fps: 30,
    md5: "00000000000000000000000000000000",
    down_url: urls.VIDEO_DOWNLOAD(params.vid),
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
  const signed = await signerClient.sign({
    url: urls.CREATE_POST,
    body: params.payload,
    cookie: params.cookie,
    country: params.country,
    proxy: params.proxy,
  });
  if (signed.code !== 0 || !signed.data?.headers) {
    throw new Error(signed.message || `signer sign (create) failed code=${signed.code}`);
  }
  const cfg = baseConfig(params.cookie, params.proxy);
  const resp = await axios.post(urls.CREATE_POST, params.payload, {
    ...cfg,
    headers: {
      ...cfg.headers,
      ...signed.data.headers,
      "content-type": "application/json",
    },
  });
  if (resp.status >= 400) {
    throw new Error(
      `createPost failed: HTTP ${resp.status} ${JSON.stringify(resp.data).slice(0, 200)}`
    );
  }
  const postId =
    resp.data?.data?.post_id || resp.data?.data?.id || resp.data?.post_id || "";
  if (!postId) {
    throw new Error(`createPost: missing post_id — ${JSON.stringify(resp.data).slice(0, 200)}`);
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
