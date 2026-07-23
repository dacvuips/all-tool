/**
 * Shopee Scrape Local Agent
 *
 * Chạy trên máy user (cùng GemLogin). Web product gọi http://127.0.0.1:17890
 * thay vì nhờ server production nối CDP máy user (không thể).
 *
 * Start: yarn scrape-agent
 * (cần build-ts trước, hoặc yarn watch-ts đang chạy)
 */
import http from "http";
import { URL } from "url";
import {
  exportCsvViaCdp,
  fetchProductPageViaCdp,
  getCdpStatus,
  getGemLoginStatus,
  listGemLoginProfiles,
  openAffiliateBrowser,
  buildCsvSession,
} from "../../helpers/shopee-affiliate-scrape";
import logger from "./console-logger";

const HOST = process.env.SCRAPE_AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.SCRAPE_AGENT_PORT || 17890);

type Json = Record<string, unknown>;

function sendJson(res: http.ServerResponse, status: number, body: Json) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(text);
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function parseFilterShopTypes(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return list.length ? list : undefined;
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const method = (req.method || "GET").toUpperCase();
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  try {
    if (method === "GET" && (path === "/" || path === "/status" || path === "/api/status")) {
      const gem = await getGemLoginStatus();
      const cdp = await getCdpStatus().catch((): null => null);
      sendJson(res, 200, {
        ok: true,
        agent: true,
        name: "shopee-scrape-agent",
        version: "1.0.0",
        gemlogin: gem,
        cdp: cdp || { hasCookies: false, connected: false, cdpAlive: false },
      });
      return;
    }

    if (method === "GET" && (path === "/gemlogin-status" || path === "/api/gemlogin-status")) {
      const status = await getGemLoginStatus();
      sendJson(res, 200, { ok: true, ...status });
      return;
    }

    if (method === "GET" && (path === "/gemlogin-profiles" || path === "/api/gemlogin-profiles")) {
      const profiles = await listGemLoginProfiles();
      sendJson(res, 200, { ok: true, profiles });
      return;
    }

    if (method === "GET" && (path === "/cdp-status" || path === "/api/cdp-status")) {
      const status = await getCdpStatus();
      sendJson(res, 200, { ok: true, ...status });
      return;
    }

    if (method === "POST" && (path === "/open-browser" || path === "/api/open-browser")) {
      const body = await readBody(req);
      const result = await openAffiliateBrowser({
        marketHost: String(body?.marketHost || "affiliate.shopee.vn").trim(),
        gemloginProfileId: body?.gemloginProfileId
          ? String(body.gemloginProfileId).trim()
          : body?.profileId
          ? String(body.profileId).trim()
          : undefined,
        allowChromeFallback: body?.allowChromeFallback === true,
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === "POST" && (path === "/product-page" || path === "/api/product-page")) {
      const body = await readBody(req);
      const result = await fetchProductPageViaCdp({
        marketHost: String(body?.marketHost || "affiliate.shopee.vn").trim(),
        keyword: body?.keyword != null ? String(body.keyword) : "",
        sortType: Number(body?.sortType),
        pageOffset: Number(body?.pageOffset) || 0,
        pageLimit: Number(body?.pageLimit) || 20,
        listType: Number.isFinite(Number(body?.listType)) ? Number(body.listType) : 0,
        filterShopTypes: parseFilterShopTypes(body?.filterShopTypes),
      });
      sendJson(res, 200, { ok: true, ...result });
      return;
    }

    if (method === "POST" && (path === "/export-csv" || path === "/api/export-csv")) {
      const body = await readBody(req);
      const exported = await exportCsvViaCdp({
        marketHost: String(body?.marketHost || "affiliate.shopee.vn").trim(),
        keyword: body?.keyword != null ? String(body.keyword) : "",
        sortType: Number(body?.sortType),
        listType: Number.isFinite(Number(body?.listType)) ? Number(body.listType) : 0,
        filterShopTypes: parseFilterShopTypes(body?.filterShopTypes),
        maxProducts: Number(body?.maxProducts) || 500,
        delayMs: Number(body?.delayMs) || 400,
        pageLimit: Number(body?.pageLimit) || 20,
        withShortLinks: body?.withShortLinks !== false,
      });
      const session = buildCsvSession(exported);
      sendJson(res, 200, { ok: true, session });
      return;
    }

    sendJson(res, 404, { ok: false, message: `Not found: ${method} ${path}` });
  } catch (err: any) {
    logger.error(`[scrape-agent] ${method} ${path}: ${err?.message || err}`);
    sendJson(res, 400, { ok: false, message: err?.message || "Agent error" });
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[scrape-agent] listening http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[scrape-agent] GemLogin expected at http://127.0.0.1:1010`);
  // eslint-disable-next-line no-console
  console.log(`[scrape-agent] Keep this process running while using Cào dữ liệu on the web.`);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `[scrape-agent] Port ${PORT} đang dùng. Đóng process cũ hoặc đặt SCRAPE_AGENT_PORT.`
    );
  } else {
    // eslint-disable-next-line no-console
    console.error(`[scrape-agent] ${err.message}`);
  }
  process.exit(1);
});
