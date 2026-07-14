/**
 * Resolve ffmpeg binary: ffmpeg-static package → system PATH.
 * (Ported from Veo3Studio ffmpegResolver, without Electron packaging paths.)
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import logger from "../logger";

function resolveFromPath(tool: "ffmpeg"): string | null {
  try {
    const whichCmd = process.platform === "win32" ? `where ${tool}` : `which ${tool}`;
    const out = execSync(whichCmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

/** Đường dẫn binary ffmpeg, hoặc null nếu không tìm thấy. */
export function resolveFfmpegBinary(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    if (ffmpegStatic && typeof ffmpegStatic === "string") {
      const finalPath = ffmpegStatic.includes("app.asar")
        ? ffmpegStatic.replace("app.asar", "app.asar.unpacked")
        : ffmpegStatic;
      if (fs.existsSync(finalPath)) {
        return path.normalize(finalPath);
      }
    }
  } catch (err) {
    logger.warn(`[ffmpeg] ffmpeg-static not available: ${(err as Error)?.message || err}`);
  }

  const fromPath = resolveFromPath("ffmpeg");
  if (fromPath) return fromPath;

  logger.error("[ffmpeg] Binary not found (install ffmpeg-static or system ffmpeg)");
  return null;
}
