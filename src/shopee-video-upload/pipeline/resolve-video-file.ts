/**
 * Resolve video file: URL http(s) / data URI → temp file trên server.
 */
import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import crypto from "crypto";

export async function resolveVideoToTempFile(params: {
  videoUrl?: string;
  /** base64 raw (không data: prefix) */
  videoBase64?: string;
  filenameHint?: string;
}): Promise<{ filePath: string; cleanup: () => void }> {
  const dir = path.join(os.tmpdir(), "shopee-video-upload");
  fs.mkdirSync(dir, { recursive: true });
  const id = crypto.randomBytes(8).toString("hex");
  const filePath = path.join(dir, `${params.filenameHint || "video"}-${id}.mp4`);

  if (params.videoBase64) {
    const buf = Buffer.from(params.videoBase64, "base64");
    fs.writeFileSync(filePath, buf);
  } else if (params.videoUrl) {
    const url = String(params.videoUrl).trim();
    if (url.startsWith("data:")) {
      const m = url.match(/^data:[^;]+;base64,(.+)$/);
      if (!m) throw new Error("data URI video không hợp lệ");
      fs.writeFileSync(filePath, Buffer.from(m[1], "base64"));
    } else if (url.startsWith("http://") || url.startsWith("https://")) {
      const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 120000,
        maxContentLength: 200 * 1024 * 1024,
      });
      fs.writeFileSync(filePath, Buffer.from(resp.data));
    } else if (fs.existsSync(url)) {
      fs.copyFileSync(url, filePath);
    } else {
      throw new Error(
        `videoUrl không hỗ trợ (${url.slice(0, 60)}) — cần http(s), data URI, base64, hoặc đường dẫn local`
      );
    }
  } else {
    throw new Error("Thiếu videoUrl hoặc videoBase64");
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  };
  return { filePath, cleanup };
}
