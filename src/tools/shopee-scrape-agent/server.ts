/**
 * Shopee Scrape Local Agent
 *
 * Chạy trên máy user (cùng GPM Login). Web product gọi http://127.0.0.1:17890
 * thay vì nhờ server production nối CDP máy user (không thể).
 *
 * Start: yarn scrape-agent
 * (cần build-ts trước, hoặc yarn watch-ts đang chạy)
 */
import http from "http";
import { URL } from "url";
import {
  createShopeeAccountGpmProfile,
  exportCsvViaCdp,
  fetchProductPageViaCdp,
  fetchAffiliateShortLinks,
  getCdpStatus,
  getGpmLoginStatus,
  closeGpmLoginProfile,
  createGpmLoginGroup,
  deleteGpmLoginProfile,
  duplicateGpmLoginProfile,
  listGpmLoginGroups,
  listGpmLoginProfiles,
  openGpmLoginProfileFolder,
  openAffiliateBrowser,
  probeGpmLoginRunningStatuses,
  refreshShopeeGpmProfileCookies,
  startGpmLoginProfile,
  updateGpmLoginProfile,
  buildCsvSession,
} from "../../helpers/shopee-affiliate-scrape";
import logger from "./console-logger";

const HOST = process.env.SCRAPE_AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.SCRAPE_AGENT_PORT || 17890);

type Json = Record<string, unknown>;

/** CORS + Private Network Access (Chrome: domain HTTPS → 127.0.0.1). */
function corsHeaders(req?: http.IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Access-Control-Request-Private-Network",
  };
  // Preflight PNA / Local Network Access
  if (
    req?.headers["access-control-request-private-network"] === "true" ||
    req?.method?.toUpperCase() === "OPTIONS"
  ) {
    headers["Access-Control-Allow-Private-Network"] = "true";
  }
  return headers;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Json,
  req?: http.IncomingMessage
) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    ...corsHeaders(req),
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
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  try {
    if (method === "GET" && (path === "/" || path === "/status" || path === "/api/status")) {
      const gpm = await getGpmLoginStatus();
      const cdp = await getCdpStatus().catch((): null => null);
      sendJson(
        res,
        200,
        {
          ok: true,
          agent: true,
          name: "shopee-scrape-agent",
          version: "1.0.0",
          gpmlogin: gpm,
          cdp: cdp || { hasCookies: false, connected: false, cdpAlive: false },
        },
        req
      );
      return;
    }

    if (method === "GET" && (path === "/gpmlogin-status" || path === "/api/gpmlogin-status")) {
      const status = await getGpmLoginStatus();
      sendJson(res, 200, { ok: true, ...status }, req);
      return;
    }

    if (method === "GET" && (path === "/gpmlogin-profiles" || path === "/api/gpmlogin-profiles")) {
      const groupId = String(url.searchParams.get("group_id") || url.searchParams.get("groupId") || "").trim();
      const search = String(url.searchParams.get("search") || "").trim();
      const profiles = await listGpmLoginProfiles({
        groupId: groupId || undefined,
        search: search || undefined,
      });
      sendJson(res, 200, { ok: true, profiles }, req);
      return;
    }

    if (method === "GET" && (path === "/gpmlogin-groups" || path === "/api/gpmlogin-groups")) {
      const groups = await listGpmLoginGroups();
      sendJson(res, 200, { ok: true, groups }, req);
      return;
    }

    if (method === "POST" && (path === "/gpmlogin-groups/create" || path === "/api/gpmlogin-groups/create")) {
      const body = await readBody(req);
      const group = await createGpmLoginGroup({
        name: String(body?.name || "").trim(),
        sortOrder:
          body?.sortOrder != null && Number.isFinite(Number(body.sortOrder))
            ? Number(body.sortOrder)
            : undefined,
      });
      sendJson(res, 200, { ok: true, group }, req);
      return;
    }

    if (method === "POST" && (path === "/gpmlogin-profiles/start" || path === "/api/gpmlogin-profiles/start")) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      const remoteDebuggingPort = Number(body?.remoteDebuggingPort || body?.cdpPort || 0);
      const started = await startGpmLoginProfile(profileId, {
        winPos: body?.winPos ? String(body.winPos) : undefined,
        winSize: body?.winSize ? String(body.winSize) : undefined,
        additionalArgs: body?.additionalArgs ? String(body.additionalArgs) : undefined,
        remoteDebuggingPort:
          Number.isFinite(remoteDebuggingPort) && remoteDebuggingPort > 0
            ? remoteDebuggingPort
            : undefined,
      });
      sendJson(res, 200, { ok: true, ...started }, req);
      return;
    }

    if (method === "POST" && (path === "/gpmlogin-profiles/stop" || path === "/api/gpmlogin-profiles/stop")) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      await closeGpmLoginProfile(profileId);
      sendJson(res, 200, { ok: true, profileId }, req);
      return;
    }

    if (
      method === "POST" &&
      (path === "/gpmlogin-profiles/probe-running" || path === "/api/gpmlogin-profiles/probe-running")
    ) {
      const body = await readBody(req);
      const rawItems = Array.isArray(body?.items)
        ? body.items
        : Array.isArray(body?.profiles)
        ? body.profiles
        : [];
      const items = rawItems.map((it: any) => ({
        profileId: String(it?.profileId || it?.id || "").trim(),
        port: Number(it?.port) || undefined,
      }));
      const statuses = await probeGpmLoginRunningStatuses(items);
      sendJson(res, 200, { ok: true, statuses }, req);
      return;
    }

    if (method === "POST" && (path === "/gpmlogin-profiles/update" || path === "/api/gpmlogin-profiles/update")) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      const updated = await updateGpmLoginProfile(profileId, {
        name: body?.name != null ? String(body.name) : undefined,
        groupId: body?.groupId != null ? String(body.groupId) : undefined,
        rawProxy: body?.rawProxy != null ? String(body.rawProxy) : undefined,
        note: body?.note != null ? String(body.note) : undefined,
        startupUrls: body?.startupUrls != null ? String(body.startupUrls) : undefined,
        taskBarTitle: body?.taskBarTitle != null ? String(body.taskBarTitle) : undefined,
      });
      sendJson(res, 200, { ok: true, profile: updated }, req);
      return;
    }

    if (method === "POST" && (path === "/gpmlogin-profiles/delete" || path === "/api/gpmlogin-profiles/delete")) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      const mode = String(body?.mode || "soft").toLowerCase() === "hard" ? "hard" : "soft";
      await deleteGpmLoginProfile(profileId, mode);
      sendJson(res, 200, { ok: true, profileId }, req);
      return;
    }

    if (
      method === "POST" &&
      (path === "/gpmlogin-profiles/duplicate" || path === "/api/gpmlogin-profiles/duplicate")
    ) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      const newName = body?.name != null ? String(body.name).trim() : undefined;
      const profile = await duplicateGpmLoginProfile(profileId, newName);
      sendJson(res, 200, { ok: true, profile }, req);
      return;
    }

    if (
      method === "POST" &&
      (path === "/gpmlogin-profiles/open-folder" || path === "/api/gpmlogin-profiles/open-folder")
    ) {
      const body = await readBody(req);
      const profileId = String(body?.profileId || body?.id || "").trim();
      const folder = await openGpmLoginProfileFolder(profileId);
      sendJson(res, 200, { ok: true, profileId, folder }, req);
      return;
    }

    if (method === "GET" && (path === "/cdp-status" || path === "/api/cdp-status")) {
      const status = await getCdpStatus();
      sendJson(res, 200, { ok: true, ...status }, req);
      return;
    }

    if (method === "POST" && (path === "/open-browser" || path === "/api/open-browser")) {
      const body = await readBody(req);
      const result = await openAffiliateBrowser({
        marketHost: String(body?.marketHost || "affiliate.shopee.vn").trim(),
        gpmloginProfileId: body?.gpmloginProfileId
          ? String(body.gpmloginProfileId).trim()
          : body?.profileId
          ? String(body.profileId).trim()
          : undefined,
        allowChromeFallback: body?.allowChromeFallback === true,
      });
      sendJson(res, 200, { ok: true, ...result }, req);
      return;
    }

    if (
      method === "POST" &&
      (path === "/create-profile" || path === "/api/create-profile")
    ) {
      const body = await readBody(req);
      const result = await createShopeeAccountGpmProfile({
        profileName: String(body?.profileName || body?.username || body?.name || "").trim(),
        domain: body?.domain != null ? String(body.domain) : undefined,
        cookie: body?.cookie != null ? String(body.cookie) : undefined,
        spcF: body?.spcF != null ? String(body.spcF) : body?.spc_f != null ? String(body.spc_f) : undefined,
        username: body?.username != null ? String(body.username) : undefined,
        password: body?.password != null ? String(body.password) : undefined,
        proxy: body?.proxy != null ? String(body.proxy) : undefined,
        note: body?.note != null ? String(body.note) : undefined,
        groupId: body?.groupId != null ? String(body.groupId).trim() : undefined,
        keepOpen:
          body?.keepOpen !== false &&
          body?.keepOpen !== "false" &&
          body?.stopAfter !== true &&
          body?.stopAfter !== "true",
      });
      sendJson(res, 200, { ok: true, ...result }, req);
      return;
    }

    if (
      method === "POST" &&
      (path === "/refresh-profile-cookies" || path === "/api/refresh-profile-cookies")
    ) {
      const body = await readBody(req);
      const result = await refreshShopeeGpmProfileCookies({
        profileId: String(body?.profileId || body?.id || "").trim(),
        domain: body?.domain != null ? String(body.domain) : undefined,
        username: body?.username != null ? String(body.username) : undefined,
        password: body?.password != null ? String(body.password) : undefined,
        cookie: body?.cookie != null ? String(body.cookie) : undefined,
        spcF: body?.spcF != null ? String(body.spcF) : body?.spc_f != null ? String(body.spc_f) : undefined,
        proxy: body?.proxy != null ? String(body.proxy) : undefined,
      });
      sendJson(res, 200, { ok: true, ...result }, req);
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
      sendJson(res, 200, { ok: true, ...result }, req);
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
      sendJson(res, 200, { ok: true, session }, req);
      return;
    }

    if (method === "POST" && (path === "/short-links" || path === "/api/short-links")) {
      const body = await readBody(req);
      const links = Array.isArray(body?.links)
        ? body.links.map((l: unknown) => String(l || "").trim())
        : [];
      const shortLinks = await fetchAffiliateShortLinks(
        links,
        Number(body?.delayMs) > 0 ? Number(body.delayMs) : 400
      );
      sendJson(res, 200, { ok: true, shortLinks }, req);
      return;
    }

    sendJson(res, 404, { ok: false, message: `Not found: ${method} ${path}` }, req);
  } catch (err: any) {
    logger.error(`[scrape-agent] ${method} ${path}: ${err?.message || err}`);
    sendJson(res, 400, { ok: false, message: err?.message || "Agent error" }, req);
  }
}

const server = http.createServer((req, res) => {
  void handle(req, res);
});

server.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`[scrape-agent] listening http://${HOST}:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[scrape-agent] GPM Login expected at http://127.0.0.1:9495`);
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
