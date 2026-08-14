import axios from "axios";
import { Request, Response } from "express";

/** HTML entity &amp; / &#38; trong query khi copy từ outerHTML */
function decodeHtmlAmpersands(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/g, "&")
    .replace(/&#x0*26;/gi, "&");
}

/**
 * true khi inline=1 đúng, hoặc query bị entity hoá: `&amp;inline=1` → key `amp;inline`
 */
function resolveInlinePreview(query: Request["query"]): boolean {
  const raw = query.inline;
  if (raw === "1" || raw === "true" || (Array.isArray(raw) && (raw[0] === "1" || raw[0] === "true"))) {
    return true;
  }
  // &amp;inline=1 không tách param → key literal "amp;inline"
  const mangled = (query as Record<string, unknown>)["amp;inline"];
  if (mangled === "1" || mangled === "true") return true;
  if (Array.isArray(mangled) && (mangled[0] === "1" || mangled[0] === "true")) return true;
  return false;
}

function pickUrlParam(query: Request["query"]): string {
  const raw = query.url;
  const s = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  return decodeHtmlAmpersands(s.trim());
}

export default [
  {
    method: "get",
    path: "/api/file/download-proxy",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const inlinePreview = resolveInlinePreview(req.query);
        let url = pickUrlParam(req.query);

        // Nếu client dán nhầm cả URL proxy vào param url — bóc target thật
        if (url.includes("/api/file/download-proxy")) {
          try {
            const nested = new URL(url, "http://localhost");
            const nestedTarget = nested.searchParams.get("url");
            if (nestedTarget) {
              url = decodeHtmlAmpersands(nestedTarget);
            }
          } catch {
            // keep url
          }
        }

        if (!url) {
          return res.status(400).json({ error: "URL parameter is required" });
        }

        // Validate URL format
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ error: "Invalid URL format" });
        }

        const rangeHeader = req.headers.range;
        const requestHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        };
        if (typeof rangeHeader === "string") {
          requestHeaders.Range = rangeHeader;
        }

        // Fetch media from external URL (supports Range for video preview)
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          timeout: 120000, // video có thể lớn / chậm
          maxContentLength: 500 * 1024 * 1024,
          headers: requestHeaders,
          validateStatus: () => true,
        });

        if (response.status === 404 || response.status === 410) {
          return res.status(response.status).json({
            error: "Video URL không tồn tại hoặc đã hết hạn",
            details: `Upstream HTTP ${response.status}`,
          });
        }

        if (response.status < 200 || (response.status >= 300 && response.status !== 206)) {
          return res.status(502).json({
            error: "Upstream trả lỗi khi tải video",
            details: `Upstream HTTP ${response.status}`,
          });
        }

        const contentType = response.headers["content-type"] || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        if (!inlinePreview) {
          res.setHeader("Content-Disposition", "attachment");
        } else {
          // Explicit inline so browsers + <video> play instead of force-download
          res.setHeader("Content-Disposition", "inline");
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        if (response.headers["accept-ranges"]) {
          res.setHeader("Accept-Ranges", response.headers["accept-ranges"]);
        }
        if (response.headers["content-range"]) {
          res.setHeader("Content-Range", response.headers["content-range"]);
        }
        if (response.headers["content-length"]) {
          res.setHeader("Content-Length", response.headers["content-length"]);
        }

        res.status(response.status).send(Buffer.from(response.data));
      } catch (error: any) {
        console.error("Download proxy error:", error.message);
        const upstreamStatus = error?.response?.status;
        if (upstreamStatus === 404 || upstreamStatus === 410) {
          return res.status(upstreamStatus).json({
            error: "Video URL không tồn tại hoặc đã hết hạn",
            details: error.message,
          });
        }
        res.status(500).json({
          error: "Failed to download file",
          details: error.message,
        });
      }
    },
  },
];
