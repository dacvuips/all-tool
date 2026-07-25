/**
 * Nối nhiều file video bằng ffmpeg concat demuxer.
 * Dựa trên Veo3Studio `ffmpegConcat` / GenNormal merge.
 *
 * - Chấp nhận đường dẫn local hoặc URL http(s) (tải về temp trước).
 * - mode `copy` (mặc định): `-c copy` — nhanh, yêu cầu cùng codec/resolution.
 * - mode `reencode`: libx264/aac — chậm hơn, ổn định khi stream lệch nhau.
 */
import axios from "axios";
import { spawn } from "child_process";
import fs from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { id12 } from "../nanoid";
import { resolveFfmpegBinary } from "./resolve-ffmpeg";

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);

const REMOTE_URL = /^https?:\/\//i;

/** Server không tải được URL nguồn — client có thể fallback upload blob. */
export class ConcatUrlDownloadError extends Error {
  readonly code = "URL_DOWNLOAD_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ConcatUrlDownloadError";
    // ES5 target: `instanceof Error` subclass thường gãy prototype — set lại cho chắc.
    Object.setPrototypeOf(this, ConcatUrlDownloadError.prototype);
  }
}

export function isConcatUrlDownloadError(err: unknown): err is ConcatUrlDownloadError {
  // Không chỉ dựa `instanceof` (ES5 + Error subclass hay fail) — duck-type theo code.
  if (err instanceof ConcatUrlDownloadError) return true;
  return (
    !!err &&
    typeof err === "object" &&
    (err as { code?: string }).code === "URL_DOWNLOAD_FAILED"
  );
}

export type ConcatVideosMode = "copy" | "reencode";

export type ConcatVideosOptions = {
  /** Đường dẫn output; mặc định ghi file temp `.mp4` */
  outputPath?: string;
  /** `copy` (mặc định) hoặc `reencode` */
  mode?: ConcatVideosMode;
};

export type ConcatVideosResult = {
  outputPath: string;
  /** true nếu output nằm trong temp (caller nên xoá khi xong) */
  isTemp: boolean;
};

function escapeConcatPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/'/g, "'\\''");
}

async function downloadToTemp(url: string): Promise<string> {
  let res: Awaited<ReturnType<typeof axios.get<ArrayBuffer>>>;
  try {
    res = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
      timeout: 10 * 60 * 1000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      validateStatus: () => true,
    });
  } catch (err: any) {
    throw new ConcatUrlDownloadError(
      `concatVideos: không tải được video (${err?.message || err}) — URL: ${url.slice(0, 120)}`
    );
  }
  if (res.status === 404) {
    throw new ConcatUrlDownloadError(
      `concatVideos: URL video không tồn tại (404) — có thể link CDN đã hết hạn. URL: ${url.slice(0, 120)}`
    );
  }
  if (res.status < 200 || res.status >= 300) {
    throw new ConcatUrlDownloadError(
      `concatVideos: tải video thất bại (HTTP ${res.status}) — URL: ${url.slice(0, 120)}`
    );
  }
  const file = path.join(tmpdir(), `ff_seg_${id12()}.mp4`);
  await writeFile(file, Buffer.from(res.data));
  return file;
}

function spawnFfmpeg(binary: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stderrChunks: Buffer[] = [];
    proc.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      const tail = Buffer.concat(stderrChunks as any).toString("utf8").slice(-800);
      reject(new Error(`ffmpeg exited with code ${code}:\n${tail}`));
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg (${binary}): ${err.message}`));
    });
  });
}

function buildFfmpegArgs(
  listPath: string,
  outputPath: string,
  mode: ConcatVideosMode
): string[] {
  if (mode === "reencode") {
    return [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ];
  }
  return ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath];
}

/**
 * Nối ≥2 input (local path hoặc http(s) URL) thành một file MP4.
 * Caller chịu trách nhiệm xoá `outputPath` nếu `isTemp === true`.
 */
export async function concatVideos(
  inputs: string[],
  options: ConcatVideosOptions = {}
): Promise<ConcatVideosResult> {
  if (!Array.isArray(inputs) || inputs.length < 2) {
    throw new Error(`concatVideos requires ≥2 inputs, got ${inputs ? inputs.length : 0}`);
  }

  const ffmpeg = resolveFfmpegBinary();
  if (!ffmpeg) {
    throw new Error("ffmpeg binary not found — cài ffmpeg-static hoặc ffmpeg trên hệ thống");
  }

  const mode: ConcatVideosMode = options.mode || "copy";
  const isTemp = !options.outputPath;
  const outputPath =
    options.outputPath || path.join(tmpdir(), `ff_merge_${id12()}.mp4`);

  const materialized = await Promise.all(
    inputs.map(async (p) =>
      REMOTE_URL.test(p)
        ? { path: await downloadToTemp(p), temp: true }
        : { path: p, temp: false }
    )
  );
  const localPaths = materialized.map((m) => m.path);
  const tempSegs = materialized.filter((m) => m.temp).map((m) => m.path);

  const listPath = path.join(tmpdir(), `ffconcat_${id12()}.txt`);
  const listContent = localPaths.map((p) => `file '${escapeConcatPath(p)}'`).join("\n");
  await writeFile(listPath, listContent, "utf8");

  try {
    try {
      await spawnFfmpeg(ffmpeg, buildFfmpegArgs(listPath, outputPath, mode));
    } catch (copyErr) {
      // Fallback re-encode nếu copy thất bại (codec/container lệch)
      if (mode === "copy") {
        await spawnFfmpeg(ffmpeg, buildFfmpegArgs(listPath, outputPath, "reencode"));
      } else {
        throw copyErr;
      }
    }
    return { outputPath, isTemp };
  } finally {
    await unlink(listPath).catch((): void => undefined);
    await Promise.all(tempSegs.map((f) => unlink(f).catch((): void => undefined)));
  }
}

/**
 * Nối video rồi đọc về Buffer; tự xoá file temp.
 */
export async function concatVideosToBuffer(
  inputs: string[],
  options: Omit<ConcatVideosOptions, "outputPath"> = {}
): Promise<Buffer> {
  const { outputPath, isTemp } = await concatVideos(inputs, options);
  try {
    return await readFile(outputPath);
  } finally {
    if (isTemp) {
      await unlink(outputPath).catch((): void => undefined);
    }
  }
}
