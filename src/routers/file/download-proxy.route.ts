import axios from "axios";
import { Request, Response } from "express";

export default [
  {
    method: "get",
    path: "/api/file/download-proxy",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const { url } = req.query;

        if (!url || typeof url !== "string") {
          return res.status(400).json({ error: "URL parameter is required" });
        }

        // Validate URL format
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ error: "Invalid URL format" });
        }

        // Fetch image from external URL
        const response = await axios.get(url, {
          responseType: "arraybuffer",
          timeout: 30000, // 30 seconds timeout
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        });

        // Set appropriate headers
        const contentType = response.headers["content-type"] || "image/jpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", "attachment");
        res.setHeader("Access-Control-Allow-Origin", "*");

        // Send image data
        res.send(Buffer.from(response.data));
      } catch (error: any) {
        console.error("Download proxy error:", error.message);
        res.status(500).json({
          error: "Failed to download image",
          details: error.message,
        });
      }
    },
  },
];
