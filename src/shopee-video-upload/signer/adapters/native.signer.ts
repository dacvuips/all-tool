/**
 * Native signer — gọi credit/signer server ngoài.
 *
 * Contract port từ MLS V13.3 handle-upload.service.js:
 *   POST <base>/api/sign  (fallback /sign)  body { url, body } — body = JSON string
 *   POST <base>/generate_token              body {}
 *   POST <base>/api/createpost              body { url, data, cookie, proxy }
 *   GET  <base>/api/me
 */
import axios, { AxiosRequestConfig } from "axios";
import https from "https";
import logger from "../../../helpers/logger";
import { shopeeUploadConfig } from "../../config";
import { resolveSignerMeRoots } from "../../signer-me-url";
import {
  resolveSignerApiKey,
  resolveSignerBaseUrl,
  SignerCreds,
} from "../creds-context";
import { buildSignerEndpoints, meCandidateUrls, normalizeSignerBaseUrl } from "../url";
import {
  ISignerAdapter,
  SignerCreatePostRequest,
  SignerCreatePostResult,
  SignerMeResult,
  SignerSignRequest,
  SignerSignResult,
  SignerTokenResult,
} from "../signer.interface";

export { normalizeSignerBaseUrl } from "../url";

/** credit.toolshopee.vn / self-host thường dùng cert self-signed */
const insecureHttpsAgent = new https.Agent({ rejectUnauthorized: false });

/** MLS spreads response.data.data vào headers — flat map hoặc { headers } */
function extractSignedHeaders(data: any): Record<string, string> | null {
  if (!data || typeof data !== "object") return null;
  if (data.headers && typeof data.headers === "object" && !Array.isArray(data.headers)) {
    return data.headers as Record<string, string>;
  }
  // Flat header map (x-sap-*, af-ac-enc-*, …)
  const keys = Object.keys(data);
  if (!keys.length) return null;
  if (keys.some((k) => /^(x-|af-|sz-|authorization)/i.test(k) || k.toLowerCase() === "signature")) {
    return data as Record<string, string>;
  }
  // Một số server trả toàn bộ object không có prefix rõ — dùng nếu không phải wrapper lỗi
  if (!("code" in data) && !("msg" in data) && !("message" in data) && !("error" in data)) {
    return data as Record<string, string>;
  }
  return null;
}

/** MLS: proxy string "host:port" hoặc "host:port:user:pass" */
function formatProxyForCredit(proxy?: string): string {
  const raw = String(proxy || "").trim();
  if (!raw) return "";
  // Đã đúng dạng host:port[:user:pass]
  if (!/^https?:\/\//i.test(raw) && raw.includes(":")) return raw;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const auth = u.username ? `${u.username}:${decodeURIComponent(u.password || "")}` : "";
    return auth ? `${u.hostname}:${u.port || "80"}:${auth}` : `${u.hostname}:${u.port || "80"}`;
  } catch {
    return raw;
  }
}

function axiosOpts(extra: AxiosRequestConfig = {}): AxiosRequestConfig {
  return {
    timeout: 20000,
    validateStatus: () => true,
    httpsAgent: insecureHttpsAgent,
    ...extra,
  };
}
function parseMePayload(data: any, httpStatus?: number): SignerMeResult | null {
  if (!data || typeof data !== "object") return null;

  const errText = String(data.msg || data.message || data.error || "").trim();

  if (typeof data.code === "number") {
    if (data.code === 0 && data.data) {
      const d = data.data;
      return {
        code: 0,
        data: {
          username: String(d.username ?? d.user ?? d.name ?? ""),
          credits: Number(d.credits ?? d.credit ?? d.balance ?? 0),
          is_active: d.is_active !== false && d.active !== false,
        },
      };
    }
    return {
      code: data.code || httpStatus || 500,
      message:
        errText ||
        `API Key không hợp lệ hoặc hết hạn (code=${data.code}). Lấy key tại https://credit.toolshopee.vn`,
    };
  }

  if (data.username != null || data.credits != null || data.credit != null) {
    return {
      code: 0,
      data: {
        username: String(data.username ?? data.user ?? ""),
        credits: Number(data.credits ?? data.credit ?? data.balance ?? 0),
        is_active: data.is_active !== false && data.active !== false,
      },
    };
  }

  if (errText) {
    return { code: httpStatus && httpStatus >= 400 ? httpStatus : 1, message: errText };
  }

  return null;
}

export class NativeSignerAdapter implements ISignerAdapter {
  readonly name = "native";

  constructor(private readonly fixed?: SignerCreds) {}

  private get baseUrl(): string {
    const fixed = String(this.fixed?.baseUrl || "").trim();
    if (fixed) return normalizeSignerBaseUrl(fixed);
    return normalizeSignerBaseUrl(resolveSignerBaseUrl(shopeeUploadConfig.creditBaseUrl));
  }

  private get meBaseUrlOverride(): string | undefined {
    const v = String(this.fixed?.meBaseUrl || "").trim();
    return v || undefined;
  }

  private get apiKey(): string {
    const fixed = String(this.fixed?.apiKey || "").trim();
    const raw = fixed || resolveSignerApiKey(shopeeUploadConfig.creditApiKey);
    // Bỏ ngoặc/Bearer/space thừa khi paste từ UI
    return String(raw || "")
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  private ep() {
    return buildSignerEndpoints(this.baseUrl);
  }

  private headers() {
    if (!this.apiKey) {
      throw new Error(
        "Thiếu API key signer — nhập tại Admin → Settings → Shopee Video Upload (shopee-signer-api-key)"
      );
    }
    return { "Content-Type": "application/json", "X-API-Key": this.apiKey };
  }

  /**
   * MLS getExtra/createPost (VN): POST credit_url với { url, body: JSON.stringify(payload) }
   * Response: data.data được spread thẳng vào headers Shopee (flat map hoặc { headers }).
   */
  async sign(req: SignerSignRequest): Promise<SignerSignResult> {
    const ep = this.ep();
    const urls = [ep.sign, ep.signAlt];
    // MLS luôn gửi body dạng JSON string
    const bodyStr =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
    let lastErr = "sign failed";
    for (const url of urls) {
      try {
        const { data, status } = await axios.post<any>(
          url,
          { url: req.url, body: bodyStr },
          axiosOpts({ headers: this.headers(), timeout: 20000 })
        );
        if (data?.code === 402 || status === 402) {
          logger.warn("[shopee-signer:native] Hết credit — liên hệ admin");
          return { code: 402, message: data?.msg || data?.message || "Hết credit — liên hệ admin" };
        }
        const headers = extractSignedHeaders(data?.data);
        if (headers && (data?.code === 0 || data?.code == null)) {
          return { code: 0, data: { headers } };
        }
        if (status === 404) {
          lastErr = `HTTP 404 ${url}`;
          continue;
        }
        lastErr =
          data?.msg ||
          data?.message ||
          `sign HTTP ${status}: ${JSON.stringify(data).slice(0, 180)}`;
        if (typeof data?.code === "number" && data.code !== 0) {
          return { code: data.code, message: lastErr };
        }
      } catch (err: any) {
        lastErr = err?.message || "signer request failed";
        logger.error(`[shopee-signer:native] sign ${url} error: ${lastErr}`);
      }
    }
    return { code: 500, message: lastErr };
  }

  /** MLS: POST <api_url_key1|default>/generate_token body {} — ta dùng cùng credit base */
  async generateToken(_opts?: { cookie?: string; country?: string }): Promise<SignerTokenResult> {
    const url = this.ep().generateToken;
    try {
      const { data } = await axios.post<any>(
        url,
        {},
        { ...axiosOpts({ headers: this.headers(), timeout: 15000 }) }
      );
      // MLS truyền thẳng response.data vào FormData field "token"
      if (typeof data === "string" && data) {
        return { code: 0, data: { token: data } };
      }
      if (typeof data === "object" && data !== null) {
        if (data.code === 0 && data.data?.token) return data as SignerTokenResult;
        const token =
          (typeof data.data === "string" ? data.data : null) ??
          data.token ??
          data.uploadid ??
          (typeof data.data === "object" && data.data?.token ? data.data.token : null);
        if (token && typeof token === "string") {
          return { code: 0, data: { token } };
        }
        if (typeof data.code === "number" && data.code !== 0) {
          return { code: data.code, message: data.message || data.msg || "generate_token failed" };
        }
      }
      return {
        code: 500,
        message: `generate_token unexpected response: ${JSON.stringify(data).slice(0, 200)}`,
      };
    } catch (err: any) {
      logger.error(`[shopee-signer:native] generate_token ${url} error: ${err?.message}`);
      return { code: 500, message: err?.message || "generate_token failed" };
    }
  }

  /**
   * MLS createPostViaCredit:
   *   POST clean(credit_url)+'/api/createpost'
   *   body { url: CREATE_POST, data: payload, cookie, proxy: "host:port[:user:pass]" }
   */
  async createPost(req: SignerCreatePostRequest): Promise<SignerCreatePostResult> {
    const ep = this.ep();
    const urls = [ep.createPost, ep.createPostAlt];
    const proxyStr = formatProxyForCredit(req.proxy);
    const payload = {
      url: req.url,
      data: req.payload,
      cookie: req.cookie,
      proxy: proxyStr,
    };

    let lastErr = "create_post failed";
    for (const url of urls) {
      try {
        const { data, status } = await axios.post<any>(url, payload, {
          headers: this.headers(),
          ...axiosOpts({ timeout: 90000 }),
        });

        if (typeof data !== "object" || data === null) {
          if (status === 404) {
            lastErr = `HTTP 404 ${url}`;
            continue;
          }
          lastErr = `create_post empty/non-JSON HTTP ${status}`;
          continue;
        }

        if (status === 402 || data.code === 402) {
          return { code: 402, message: data.msg || data.message || "Hết credit — liên hệ admin" };
        }

        if (typeof data.code === "number") {
          const postId =
            data.data?.post_id || data.data?.postId || data.data?.id || data.post_id || data.postId;
          if (data.code === 0 && postId) {
            return { code: 0, data: { post_id: String(postId) } };
          }
          if (data.code === 0 && data.data) {
            const nested = data.data?.data || data.data;
            const pid = nested?.post_id || nested?.postId || nested?.id;
            if (pid) return { code: 0, data: { post_id: String(pid) } };
          }
          // 404 path → thử alt
          if (status === 404) {
            lastErr = `HTTP 404 ${url}`;
            continue;
          }
          return {
            code: data.code || 500,
            message:
              data.msg || data.message || `create_post failed: ${JSON.stringify(data).slice(0, 200)}`,
          };
        }

        const postId = data.post_id || data.postId || data.id;
        if (postId) return { code: 0, data: { post_id: String(postId) } };

        if (status === 404) {
          lastErr = `HTTP 404 ${url}`;
          continue;
        }
        lastErr = `create_post unexpected: ${JSON.stringify(data).slice(0, 200)}`;
      } catch (err: any) {
        lastErr = err?.message || "create_post failed";
        logger.error(`[shopee-signer:native] create_post ${url} error: ${lastErr}`);
      }
    }
    return { code: 500, message: lastErr };
  }

  async me(): Promise<SignerMeResult> {
    const roots = await resolveSignerMeRoots(this.baseUrl, this.meBaseUrlOverride);
    const urls = meCandidateUrls(roots);
    if (!urls.length) {
      return {
        code: 500,
        message: "Chưa có Base URL để gọi /api/me — nhập Signer Base URL trong Admin Settings",
      };
    }

    const tried: string[] = [];
    let lastErr = "me failed";
    let authErr: SignerMeResult | null = null;

    for (const url of urls) {
      tried.push(url);
      try {
        const { data, status } = await axios.get<any>(
          url,
          axiosOpts({ headers: this.headers(), timeout: 10000 })
        );

        const parsed = parseMePayload(data, status);
        if (parsed?.code === 0) {
          logger.info(`[shopee-signer:native] me OK via ${url}`);
          return parsed;
        }

        if (status === 404) {
          lastErr = `HTTP 404 ${url}`;
          continue;
        }

        if (status === 401 || status === 403 || parsed?.code === 1) {
          authErr = {
            code: parsed?.code || status,
            message: `${parsed?.message || data?.msg || data?.message || "API Key không hợp lệ"} (${url})`,
          };
          // Thử host khác (sign IP vs credit.toolshopee.vn) trước khi kết luận
          lastErr = authErr.message!;
          continue;
        }

        if (parsed?.message) {
          lastErr = parsed.message;
          continue;
        }

        lastErr = `HTTP ${status} unexpected: ${JSON.stringify(data).slice(0, 200)}`;
      } catch (err: any) {
        lastErr = `${err?.message || "me request failed"} (${url})`;
        logger.error(`[shopee-signer:native] me ${url} error: ${err?.message}`);
      }
    }

    if (authErr) {
      return {
        ...authErr,
        message: `${authErr.message}. Đã thử: ${tried.join(", ")}. Gợi ý: dùng đúng API key của host đó, hoặc để trống Credit Me URL nếu chỉ sign trên IP.`,
      };
    }

    return {
      code: 500,
      message: `${lastErr}. Đã thử: ${tried.join(
        ", "
      )}. Host sign có thể không có /api/me — check số dư cần host hỗ trợ endpoint này.`,
    };
  }
}