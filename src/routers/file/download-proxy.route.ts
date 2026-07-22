import axios from "axios";
import { Request, Response } from "express";

export default [
  {
    method: "get",
    path: "/api/file/download-proxy",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const { url, inline } = req.query;
        const inlinePreview = inline === "1" || inline === "true";

        if (!url || typeof url !== "string") {
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
