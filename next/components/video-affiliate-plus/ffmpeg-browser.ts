/**
 * ffmpeg-browser.ts
 * Nối video bằng ffmpeg.wasm — chạy hoàn toàn trong browser, không tốn server.
 *
 * - Lazy load wasm lần đầu (~25MB, cache trình duyệt lần sau)
 * - Queue: chỉ 1 job chạy cùng lúc (tránh OOM)
 * - @ffmpeg/core ESM single-thread → không cần SharedArrayBuffer / COEP
 * - classWorkerURL → /ffmpeg/worker.js (bypass webpack; tránh Cannot find module blob/http)
 */

export type FfmpegMergeProgress = {
  /** 0..1 */
  ratio: number;
  message: string;
};

export type FfmpegMergeOptions = {
  onProgress?: (p: FfmpegMergeProgress) => void;
};

// ─── Queue: serialize job, 1 job tại 1 thời điểm ─────────────────────────────

type QueueJob = () => Promise<void>;
let _queueRunning = false;
const _queue: Array<{ run: QueueJob; resolve: () => void; reject: (e: unknown) => void }> = [];

function enqueue(run: QueueJob): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    _queue.push({ run, resolve, reject });
    void drainQueue();
  });
}

export function abortFfmpegBrowser() {
  const pending = _queue.splice(0);
  pending.forEach((job) => {
    try {
      job.reject(new DOMException("Đã dừng", "AbortError"));
    } catch {
      // ignore
    }
  });
  destroyFFmpegInstance();
}

async function drainQueue() {
  if (_queueRunning || _queue.length === 0) return;
  _queueRunning = true;
  while (_queue.length > 0) {
    const job = _queue.shift()!;
    try {
      await job.run();
      job.resolve();
    } catch (err) {
      job.reject(err);
    }
  }
  _queueRunning = false;
}

// ─── ffmpeg instance (lazy, tái dùng) ───────────────────────────────────────

let _ffmpegInstance: import("@ffmpeg/ffmpeg").FFmpeg | null = null;
let _loadPromise: Promise<import("@ffmpeg/ffmpeg").FFmpeg> | null = null;

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const name = err instanceof Error ? err.name : "";
  return (
    name === "ChunkLoadError" ||
    /Loading chunk .+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg)
  );
}

/** Dynamic import kèm 1 lần retry (Next có thể 404 chunk lúc vừa compile). */
async function importFfmpegPackages(): Promise<{
  FFmpeg: typeof import("@ffmpeg/ffmpeg").FFmpeg;
}> {
  const load = async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    return { FFmpeg };
  };

  try {
    return await load();
  } catch (err) {
    if (!isChunkLoadError(err)) throw err;
    await new Promise((r) => setTimeout(r, 400));
    return await load();
  }
}

async function getFFmpeg(
  onProgress?: FfmpegMergeOptions["onProgress"]
): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    onProgress?.({ ratio: 0.02, message: "Đang tải ffmpeg.wasm..." });
    const { FFmpeg } = await importFfmpegPackages();

    // classWorkerURL: Worker native ESM (không qua webpack) — import() được
    // http/blob URL. Worker webpack cũ biến import(coreURL) → Cannot find module.
    // Core phải là ESM (export default) vì Worker type: "module".
    // Worker luôn same-origin (CSP worker-src chỉ 'self' + blob).
    const sameOriginBase = `${window.location.origin}/ffmpeg`;
    const cdnBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
    const classWorkerURL = `${sameOriginBase}/worker.js`;

    const loadFrom = async (baseURL: string) => {
      const ff = new FFmpeg();
      await ff.load({
        classWorkerURL,
        coreURL: `${baseURL}/ffmpeg-core.js`,
        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
      });
      return ff;
    };

    let hasWorker = false;
    let hasWasm = false;
    try {
      const [wasmHead, workerHead] = await Promise.all([
        fetch(`${sameOriginBase}/ffmpeg-core.wasm`, { method: "HEAD" }),
        fetch(classWorkerURL, { method: "HEAD" }),
      ]);
      hasWasm = wasmHead.ok;
      hasWorker = workerHead.ok;
    } catch {
      // ignore
    }

    if (!hasWorker) {
      throw new Error(
        "Thiếu /ffmpeg/worker.js — chạy: yarn fetch-ffmpeg-core (hoặc yarn next:build)"
      );
    }

    let ff: import("@ffmpeg/ffmpeg").FFmpeg;
    try {
      ff = await loadFrom(hasWasm ? sameOriginBase : cdnBase);
    } catch (firstErr) {
      if (!hasWasm) throw firstErr;
      console.warn("[ffmpeg] same-origin core failed, fallback CDN", firstErr);
      ff = await loadFrom(cdnBase);
    }

    _ffmpegInstance = ff;
    return ff;
  })().catch((err) => {
    _loadPromise = null;
    const msg = err instanceof Error ? err.message : String(err ?? "unknown");
    throw new Error(`Không tải được ffmpeg.wasm: ${msg}`);
  });

  return _loadPromise;
}

/** Giải phóng instance (gọi khi tab unload hoặc muốn free RAM). */
export function destroyFFmpegInstance() {
  if (_ffmpegInstance) {
    try {
      _ffmpegInstance.terminate();
    } catch {
      // ignore
    }
    _ffmpegInstance = null;
  }
  _loadPromise = null;
}

// ─── Core merge ─────────────────────────────────────────────────────────────

/**
 * Nối danh sách Blob video thành 1 Blob MP4.
 * Chạy trong queue (1 job tại 1 lúc) để tránh tranh chấp wasm memory.
 */
export async function mergeVideosInBrowser(
  inputs: Blob[],
  options: FfmpegMergeOptions = {}
): Promise<Blob> {
  if (!Array.isArray(inputs) || inputs.length < 2) {
    throw new Error("Cần ít nhất 2 video để nối");
  }

  let resultBlob: Blob | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);

    options.onProgress?.({ ratio: 0.05, message: "Đang chuẩn bị..." });

    const inputNames: string[] = [];
    try {
      for (let i = 0; i < inputs.length; i++) {
        const name = `input${i}.mp4`;
        options.onProgress?.({
          ratio: 0.05 + (i / inputs.length) * 0.55,
          message: `Đang ghi video ${i + 1}/${inputs.length}...`,
        });

        const blob = inputs[i];
        if (!blob || blob.size <= 0) {
          throw new Error(`Video số ${i + 1} rỗng — hãy generate lại`);
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        await ff.writeFile(name, buf);
        inputNames.push(name);
      }

      const concatList = inputNames.map((n) => `file '${n}'`).join("\n");
      await ff.writeFile("concat.txt", concatList);

      options.onProgress?.({ ratio: 0.65, message: "Đang nối video..." });

      // Ưu tiên copy (nhanh); re-encode nếu codec/container lệch.
      // Lưu ý: ff.exec trả exit code, không throw khi ffmpeg fail.
      let copyOk = false;
      try {
        const code = await ff.exec([
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat.txt",
          "-c",
          "copy",
          "-y",
          "output.mp4",
        ]);
        copyOk = code === 0;
      } catch {
        copyOk = false;
      }

      if (!copyOk) {
        options.onProgress?.({ ratio: 0.7, message: "Đang re-encode video..." });
        await ff.deleteFile("output.mp4").catch(() => undefined);
        const code = await ff.exec([
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          "concat.txt",
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
          "-y",
          "output.mp4",
        ]);
        if (code !== 0) {
          throw new Error(`ffmpeg re-encode thất bại (exit ${code})`);
        }
      }

      options.onProgress?.({ ratio: 0.92, message: "Đang đọc kết quả..." });

      const outData = await ff.readFile("output.mp4");
      if (typeof outData === "string") {
        throw new Error("ffmpeg trả về text thay vì video binary");
      }
      const bytes =
        outData instanceof Uint8Array ? outData : new Uint8Array(outData as ArrayBuffer);
      if (bytes.byteLength <= 0) {
        throw new Error("ffmpeg tạo file rỗng — codec video có thể không tương thích");
      }
      const ab = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;
      resultBlob = new Blob([ab], { type: "video/mp4" });
    } finally {
      options.onProgress?.({ ratio: 0.98, message: "Dọn dẹp..." });
      for (const name of inputNames) {
        await ff.deleteFile(name).catch(() => undefined);
      }
      await ff.deleteFile("concat.txt").catch(() => undefined);
      await ff.deleteFile("output.mp4").catch(() => undefined);
    }

    options.onProgress?.({ ratio: 1, message: "Hoàn tất" });
  });

  if (!resultBlob) throw new Error("Nối video thất bại — không có kết quả");
  return resultBlob;
}

function toMediaBlob(outData: Uint8Array | string | ArrayBuffer, mimeType: string): Blob {
  if (typeof outData === "string") {
    throw new Error("ffmpeg trả về text thay vì media binary");
  }
  const bytes = outData instanceof Uint8Array ? outData : new Uint8Array(outData);
  if (bytes.byteLength <= 0) {
    throw new Error("ffmpeg tạo file rỗng — codec có thể không tương thích");
  }
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  return new Blob([ab], { type: mimeType });
}

function toVideoBlob(outData: Uint8Array | string | ArrayBuffer): Blob {
  return toMediaBlob(outData, "video/mp4");
}

export type TrimMediaResult = {
  blob: Blob;
  mimeType: string;
  ext: string;
};

function fileExtOf(name?: string, fallback = "mp4"): string {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
  return (m?.[1] || fallback).toLowerCase();
}

export function isAudioMediaFile(file: { name?: string; type?: string } | null | undefined): boolean {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  if (type.startsWith("audio/")) return true;
  return /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(String(file.name || ""));
}

function audioTargetOf(
  fileName?: string,
  mimeType?: string
): { ext: string; mime: string; encodeArgs: string[] } {
  const hay = `${fileName || ""} ${mimeType || ""}`.toLowerCase();
  if (hay.includes("wav") || hay.includes("x-wav") || hay.includes("wave")) {
    return { ext: "wav", mime: "audio/wav", encodeArgs: ["-c:a", "pcm_s16le"] };
  }
  if (hay.includes("m4a") || hay.includes("audio/mp4") || hay.includes("x-m4a") || hay.includes("aac")) {
    return { ext: "m4a", mime: "audio/mp4", encodeArgs: ["-c:a", "aac", "-b:a", "192k"] };
  }
  if (hay.includes("ogg") || hay.includes("vorbis")) {
    return { ext: "ogg", mime: "audio/ogg", encodeArgs: ["-c:a", "libvorbis", "-q:a", "5"] };
  }
  return { ext: "mp3", mime: "audio/mpeg", encodeArgs: ["-c:a", "libmp3lame", "-q:a", "2"] };
}

/**
 * Cắt một đoạn video (start → end, giây) trong browser.
 * Ưu tiên stream copy; nếu điểm cắt không khớp keyframe thì re-encode.
 */
export async function trimVideoInBrowser(
  input: Blob,
  startSec: number,
  endSec: number,
  options: FfmpegMergeOptions = {}
): Promise<Blob> {
  if (!input || input.size <= 0) {
    throw new Error("Chưa có file video");
  }
  const start = Math.max(0, Number(startSec) || 0);
  const end = Math.max(start + 0.05, Number(endSec) || 0);
  const duration = Math.max(0.05, end - start);
  const startArg = start.toFixed(3);
  const durArg = duration.toFixed(3);

  let resultBlob: Blob | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `trim_in_${stamp}.mp4`;
    const outName = `trim_out_${stamp}.mp4`;

    options.onProgress?.({ ratio: 0.08, message: "Đang ghi video..." });
    const buf = new Uint8Array(await input.arrayBuffer());
    await ff.writeFile(inName, buf);

    try {
      options.onProgress?.({ ratio: 0.35, message: "Đang cắt video..." });
      let copyOk = false;
      try {
        const code = await ff.exec([
          "-ss",
          startArg,
          "-i",
          inName,
          "-t",
          durArg,
          "-c",
          "copy",
          "-avoid_negative_ts",
          "make_zero",
          "-movflags",
          "+faststart",
          "-y",
          outName,
        ]);
        copyOk = code === 0;
      } catch {
        copyOk = false;
      }

      if (!copyOk) {
        options.onProgress?.({ ratio: 0.45, message: "Đang re-encode đoạn cắt..." });
        await ff.deleteFile(outName).catch(() => undefined);
        const encode = async (withAudio: boolean) => {
          const args = [
            "-ss",
            startArg,
            "-i",
            inName,
            "-t",
            durArg,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-movflags",
            "+faststart",
            "-y",
            outName,
          ];
          if (withAudio) {
            args.splice(args.indexOf("-movflags"), 0, "-c:a", "aac", "-b:a", "192k");
          } else {
            args.splice(args.indexOf("-movflags"), 0, "-an");
          }
          return ff.exec(args);
        };
        let code = await encode(true);
        if (code !== 0) {
          await ff.deleteFile(outName).catch(() => undefined);
          code = await encode(false);
        }
        if (code !== 0) {
          throw new Error(`ffmpeg cắt video thất bại (exit ${code})`);
        }
      }

      options.onProgress?.({ ratio: 0.9, message: "Đang đọc kết quả..." });
      const outData = await ff.readFile(outName);
      resultBlob = toVideoBlob(outData as Uint8Array | string);
    } finally {
      options.onProgress?.({ ratio: 0.97, message: "Dọn dẹp..." });
      await ff.deleteFile(inName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
    }

    options.onProgress?.({ ratio: 1, message: "Hoàn tất" });
  });

  if (!resultBlob) throw new Error("Cắt video thất bại — không có kết quả");
  return resultBlob;
}

/**
 * Cắt một đoạn audio (start → end, giây) — giữ MP3 / WAV / M4A khi có thể.
 */
export async function trimAudioInBrowser(
  input: Blob,
  startSec: number,
  endSec: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  if (!input || input.size <= 0) {
    throw new Error("Chưa có file audio");
  }
  const start = Math.max(0, Number(startSec) || 0);
  const end = Math.max(start + 0.05, Number(endSec) || 0);
  const duration = Math.max(0.05, end - start);
  const startArg = start.toFixed(3);
  const durArg = duration.toFixed(3);
  const target = audioTargetOf(options.fileName, options.mimeType || input.type);
  const inExt = fileExtOf(options.fileName, target.ext);

  let result: TrimMediaResult | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `trim_in_${stamp}.${inExt}`;
    const outName = `trim_out_${stamp}.${target.ext}`;

    options.onProgress?.({ ratio: 0.08, message: "Đang ghi audio..." });
    const buf = new Uint8Array(await input.arrayBuffer());
    await ff.writeFile(inName, buf);

    try {
      options.onProgress?.({ ratio: 0.35, message: "Đang cắt audio..." });
      let copyOk = false;
      try {
        const code = await ff.exec([
          "-ss",
          startArg,
          "-i",
          inName,
          "-t",
          durArg,
          "-c",
          "copy",
          "-y",
          outName,
        ]);
        copyOk = code === 0;
      } catch {
        copyOk = false;
      }

      if (!copyOk) {
        options.onProgress?.({ ratio: 0.5, message: "Đang encode đoạn audio..." });
        await ff.deleteFile(outName).catch(() => undefined);
        const tryEncode = async (args: string[], ext: string, mime: string) => {
          const name = `trim_out_${stamp}.${ext}`;
          const code = await ff.exec([
            "-ss",
            startArg,
            "-i",
            inName,
            "-t",
            durArg,
            ...args,
            "-y",
            name,
          ]);
          return { code, name, ext, mime };
        };

        let encoded = await tryEncode(target.encodeArgs, target.ext, target.mime);
        if (encoded.code !== 0) {
          await ff.deleteFile(encoded.name).catch(() => undefined);
          encoded = await tryEncode(["-c:a", "aac", "-b:a", "192k"], "m4a", "audio/mp4");
        }
        if (encoded.code !== 0) {
          await ff.deleteFile(encoded.name).catch(() => undefined);
          encoded = await tryEncode(["-c:a", "pcm_s16le"], "wav", "audio/wav");
        }
        if (encoded.code !== 0) {
          throw new Error(`ffmpeg cắt audio thất bại (exit ${encoded.code})`);
        }
        const outData = await ff.readFile(encoded.name);
        result = {
          blob: toMediaBlob(outData as Uint8Array | string, encoded.mime),
          mimeType: encoded.mime,
          ext: encoded.ext,
        };
        await ff.deleteFile(encoded.name).catch(() => undefined);
      } else {
        const outData = await ff.readFile(outName);
        result = {
          blob: toMediaBlob(outData as Uint8Array | string, target.mime),
          mimeType: target.mime,
          ext: target.ext,
        };
      }
    } finally {
      options.onProgress?.({ ratio: 0.97, message: "Dọn dẹp..." });
      await ff.deleteFile(inName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
    }

    options.onProgress?.({ ratio: 1, message: "Hoàn tất" });
  });

  if (!result) throw new Error("Cắt audio thất bại — không có kết quả");
  return result;
}

export async function trimMediaInBrowser(
  input: Blob,
  startSec: number,
  endSec: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  if (isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type })) {
    return trimAudioInBrowser(input, startSec, endSec, options);
  }
  const blob = await trimVideoInBrowser(input, startSec, endSec, options);
  return { blob, mimeType: "video/mp4", ext: "mp4" };
}

function atempoChain(speed: number): string {
  let s = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const parts: string[] = [];
  while (s > 2.0001) {
    parts.push("atempo=2.0");
    s /= 2;
  }
  while (s < 0.5 - 1e-6) {
    parts.push("atempo=0.5");
    s /= 0.5;
  }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(",");
}

const VIDEO_ENCODE_ARGS = [
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
];

export async function processMediaInBrowser(
  input: Blob,
  options: FfmpegMergeOptions & {
    fileName?: string;
    mimeType?: string;
    args: string[];
    outExt?: string;
    outMime?: string;
    message?: string;
  }
): Promise<TrimMediaResult> {
  if (!input || input.size <= 0) throw new Error("Chưa có file");
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  const inExt = fileExtOf(options.fileName, audio ? "mp3" : "mp4");
  const outExt = options.outExt || (audio ? "wav" : "mp4");
  const outMime = options.outMime || (audio ? "audio/wav" : "video/mp4");
  let result: TrimMediaResult | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `proc_in_${stamp}.${inExt}`;
    const outName = `proc_out_${stamp}.${outExt}`;
    options.onProgress?.({ ratio: 0.08, message: "Đang ghi file..." });
    await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
    try {
      options.onProgress?.({ ratio: 0.4, message: options.message || "Đang xử lý..." });
      const code = await ff.exec(["-i", inName, ...options.args, "-y", outName]);
      if (code !== 0) throw new Error(`Xử lý media thất bại (exit ${code})`);
      result = {
        blob: toMediaBlob((await ff.readFile(outName)) as Uint8Array | string, outMime),
        mimeType: outMime,
        ext: outExt,
      };
    } finally {
      await ff.deleteFile(inName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
    }
    options.onProgress?.({ ratio: 1, message: "Hoàn tất" });
  });

  if (!result) throw new Error("Xử lý media thất bại");
  return result;
}

export async function changeSpeedInBrowser(
  input: Blob,
  speed: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const rate = Math.max(0.25, Math.min(4, Number(speed) || 1));
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  const tempo = atempoChain(rate);
  if (audio) {
    return processMediaInBrowser(input, {
      ...options,
      message: `Đang đổi tốc độ ${rate}x...`,
      args: ["-filter:a", tempo, "-c:a", "pcm_s16le"],
      outExt: "wav",
      outMime: "audio/wav",
    });
  }
  try {
    return await processMediaInBrowser(input, {
      ...options,
      message: `Đang đổi tốc độ ${rate}x...`,
      args: ["-filter:v", `setpts=PTS/${rate}`, "-filter:a", tempo, ...VIDEO_ENCODE_ARGS],
    });
  } catch {
    return processMediaInBrowser(input, {
      ...options,
      message: `Đang đổi tốc độ video ${rate}x...`,
      args: ["-filter:v", `setpts=PTS/${rate}`, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"],
    });
  }
}

export async function changeVolumeInBrowser(
  input: Blob,
  db: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const gain = Math.max(-24, Math.min(24, Number(db) || 0));
  const vol = Math.pow(10, gain / 20).toFixed(4);
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  if (audio) {
    return processMediaInBrowser(input, {
      ...options,
      message: "Đang chỉnh âm lượng...",
      args: ["-filter:a", `volume=${vol}`, "-c:a", "pcm_s16le"],
      outExt: "wav",
      outMime: "audio/wav",
    });
  }
  return processMediaInBrowser(input, {
    ...options,
    message: "Đang chỉnh âm lượng...",
    args: ["-filter:a", `volume=${vol}`, ...VIDEO_ENCODE_ARGS],
  });
}

export async function cropAspectInBrowser(
  input: Blob,
  aspect: "9:16" | "1:1" | "16:9",
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const crop =
    aspect === "1:1"
      ? "crop=min(iw\\,ih):min(iw\\,ih)"
      : aspect === "9:16"
      ? "crop=min(iw\\,ih*9/16):min(ih\\,iw*16/9)"
      : "crop=min(iw\\,ih*16/9):min(ih\\,iw*9/16)";
  return processMediaInBrowser(input, {
    ...options,
    message: `Đang crop ${aspect}...`,
    args: ["-vf", crop, ...VIDEO_ENCODE_ARGS],
  });
}

export async function fadeMediaInBrowser(
  input: Blob,
  fadeSec: number,
  totalDuration: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const fade = Math.max(0.1, Math.min(8, Number(fadeSec) || 0.5));
  const dur = Math.max(fade * 2 + 0.2, Number(totalDuration) || fade * 2 + 1);
  const outStart = Math.max(0, dur - fade);
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  const af = `afade=t=in:st=0:d=${fade},afade=t=out:st=${outStart}:d=${fade}`;
  if (audio) {
    return processMediaInBrowser(input, {
      ...options,
      message: "Đang fade audio...",
      args: ["-filter:a", af, "-c:a", "pcm_s16le"],
      outExt: "wav",
      outMime: "audio/wav",
    });
  }
  const vf = `fade=t=in:st=0:d=${fade},fade=t=out:st=${outStart}:d=${fade}`;
  return processMediaInBrowser(input, {
    ...options,
    message: "Đang fade video...",
    args: ["-vf", vf, "-af", af, ...VIDEO_ENCODE_ARGS],
  });
}

export async function reverseMediaInBrowser(
  input: Blob,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  if (audio) {
    return processMediaInBrowser(input, {
      ...options,
      message: "Đang đảo chiều audio...",
      args: ["-filter:a", "areverse", "-c:a", "pcm_s16le"],
      outExt: "wav",
      outMime: "audio/wav",
    });
  }
  try {
    return await processMediaInBrowser(input, {
      ...options,
      message: "Đang đảo chiều video...",
      args: ["-vf", "reverse", "-af", "areverse", ...VIDEO_ENCODE_ARGS],
    });
  } catch {
    return processMediaInBrowser(input, {
      ...options,
      message: "Đang đảo chiều hình...",
      args: ["-vf", "reverse", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-movflags", "+faststart"],
    });
  }
}

export async function compressMediaInBrowser(
  input: Blob,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });
  if (audio) {
    return processMediaInBrowser(input, {
      ...options,
      message: "Đang nén audio...",
      args: ["-c:a", "libmp3lame", "-b:a", "96k"],
      outExt: "mp3",
      outMime: "audio/mpeg",
    });
  }
  return processMediaInBrowser(input, {
    ...options,
    message: "Đang nén video 720p...",
    args: [
      "-vf",
      "scale=-2:720",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
    ],
  });
}

export async function mergeAudioInBrowser(
  inputs: Blob[],
  options: FfmpegMergeOptions = {}
): Promise<TrimMediaResult> {
  if (!Array.isArray(inputs) || inputs.length < 2) {
    throw new Error("Cần ít nhất 2 file audio để ghép");
  }
  let result: TrimMediaResult | null = null;
  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const names: string[] = [];
    try {
      for (let i = 0; i < inputs.length; i += 1) {
        const name = `ain_${stamp}_${i}.mp3`;
        await ff.writeFile(name, new Uint8Array(await inputs[i].arrayBuffer()));
        names.push(name);
      }
      await ff.writeFile("concat.txt", names.map((n) => `file '${n}'`).join("\n"));
      options.onProgress?.({ ratio: 0.6, message: "Đang ghép audio..." });
      const outName = `aout_${stamp}.wav`;
      const code = await ff.exec([
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        "concat.txt",
        "-c:a",
        "pcm_s16le",
        "-y",
        outName,
      ]);
      if (code !== 0) throw new Error(`Ghép audio thất bại (exit ${code})`);
      result = {
        blob: toMediaBlob((await ff.readFile(outName)) as Uint8Array | string, "audio/wav"),
        mimeType: "audio/wav",
        ext: "wav",
      };
      await ff.deleteFile(outName).catch(() => undefined);
    } finally {
      for (const name of names) await ff.deleteFile(name).catch(() => undefined);
      await ff.deleteFile("concat.txt").catch(() => undefined);
    }
  });
  if (!result) throw new Error("Ghép audio thất bại");
  return result;
}

export async function extractAudioTrackInBrowser(
  input: Blob,
  format: "mp3" | "wav",
  options: FfmpegMergeOptions & { fileName?: string } = {}
): Promise<TrimMediaResult> {
  if (!input || input.size <= 0) throw new Error("Chưa có file");
  const inExt = fileExtOf(options.fileName, "mp4");
  const target =
    format === "wav"
      ? { ext: "wav", mime: "audio/wav", args: ["-c:a", "pcm_s16le"] }
      : { ext: "mp3", mime: "audio/mpeg", args: ["-c:a", "libmp3lame", "-q:a", "2"] };
  let result: TrimMediaResult | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `ex_in_${stamp}.${inExt}`;
    const outName = `ex_out_${stamp}.${target.ext}`;
    options.onProgress?.({ ratio: 0.08, message: "Đang ghi file..." });
    await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
    try {
      options.onProgress?.({ ratio: 0.4, message: `Đang tách ${target.ext.toUpperCase()}...` });
      let code = await ff.exec(["-i", inName, "-vn", ...target.args, "-y", outName]);
      if (code !== 0 && format === "mp3") {
        await ff.deleteFile(outName).catch(() => undefined);
        const wavName = `ex_out_${stamp}.wav`;
        code = await ff.exec(["-i", inName, "-vn", "-c:a", "pcm_s16le", "-y", wavName]);
        if (code !== 0) throw new Error(`Tách audio thất bại (exit ${code})`);
        const outData = await ff.readFile(wavName);
        result = {
          blob: toMediaBlob(outData as Uint8Array | string, "audio/wav"),
          mimeType: "audio/wav",
          ext: "wav",
        };
        await ff.deleteFile(wavName).catch(() => undefined);
      } else {
        if (code !== 0) throw new Error(`Tách audio thất bại (exit ${code})`);
        result = {
          blob: toMediaBlob((await ff.readFile(outName)) as Uint8Array | string, target.mime),
          mimeType: target.mime,
          ext: target.ext,
        };
      }
    } finally {
      await ff.deleteFile(inName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
    }
    options.onProgress?.({ ratio: 1, message: "Hoàn tất" });
  });

  if (!result) throw new Error("Tách audio thất bại");
  return result;
}

/** MicroX/Vercel từ chối body > ~4.5MB (`FUNCTION_PAYLOAD_TOO_LARGE`). */
const STT_MAX_BYTES = Math.floor(3.2 * 1024 * 1024);
/** 32 kbps mono ≈ 4 KB/s → 10 phút ~ 2.4 MB. */
const STT_CHUNK_SEC = 10 * 60;
const SPEECH_MP3_ARGS = ["-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "32k"];

export type SpeechAudioChunk = {
  blob: Blob;
  mimeType: string;
  ext: string;
  startSec: number;
  durationSec: number;
};

function isLikelyWav(fileName?: string, mimeType?: string) {
  const hay = `${fileName || ""} ${mimeType || ""}`.toLowerCase();
  return hay.includes("wav") || hay.includes("wave");
}

/**
 * Nén audio (mono 16kHz 32kbps MP3) và cắt đoạn để STT không vượt payload.
 */
export async function prepareSpeechAudioChunksInBrowser(
  input: Blob,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string; durationSec?: number } = {}
): Promise<SpeechAudioChunk[]> {
  if (!input || input.size <= 0) throw new Error("Chưa có file");
  const fileName = options.fileName || "audio.mp3";
  const mimeType = options.mimeType || input.type || "";
  const durationHint = Math.max(0, Number(options.durationSec) || 0);

  const smallAudio =
    input.size <= STT_MAX_BYTES &&
    isAudioMediaFile({ name: fileName, type: mimeType }) &&
    !isLikelyWav(fileName, mimeType);
  if (smallAudio) {
    return [
      {
        blob: input,
        mimeType: mimeType || "audio/mpeg",
        ext: fileExtOf(fileName, "mp3"),
        startSec: 0,
        durationSec: durationHint,
      },
    ];
  }

  const inExt = fileExtOf(fileName, isAudioMediaFile({ name: fileName, type: mimeType }) ? "mp3" : "mp4");
  const ranges: { start: number; duration: number }[] = [];
  if (durationHint > STT_CHUNK_SEC + 1) {
    for (let start = 0; start < durationHint; start += STT_CHUNK_SEC) {
      ranges.push({ start, duration: Math.min(STT_CHUNK_SEC, durationHint - start) });
    }
  } else {
    ranges.push({ start: 0, duration: durationHint });
  }

  const chunks: SpeechAudioChunk[] = [];
  let retryDuration = 0;
  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `stt_in_${stamp}.${inExt}`;
    options.onProgress?.({ ratio: 0.06, message: "Đang nén audio cho chép lời..." });
    await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
    try {
      for (let i = 0; i < ranges.length; i += 1) {
        const range = ranges[i];
        const outName = `stt_out_${stamp}_${i}.mp3`;
        options.onProgress?.({
          ratio: 0.1 + (i / Math.max(1, ranges.length)) * 0.85,
          message:
            ranges.length > 1
              ? `Đang nén đoạn ${i + 1}/${ranges.length}...`
              : "Đang nén MP3 (mono 16kHz)...",
        });
        const args = ["-i", inName];
        if (range.start > 0) args.push("-ss", range.start.toFixed(3));
        if (range.duration > 0) args.push("-t", range.duration.toFixed(3));
        args.push(...SPEECH_MP3_ARGS, "-y", outName);
        const code = await ff.exec(args);
        if (code !== 0) {
          await ff.deleteFile(outName).catch(() => undefined);
          throw new Error(`Nén audio STT thất bại (exit ${code})`);
        }
        const blob = toMediaBlob((await ff.readFile(outName)) as Uint8Array | string, "audio/mpeg");
        await ff.deleteFile(outName).catch(() => undefined);
        if (blob.size > STT_MAX_BYTES) {
          if (ranges.length === 1 && range.duration <= 0) {
            retryDuration = Math.max(STT_CHUNK_SEC * 2, blob.size / (32000 / 8));
            chunks.length = 0;
            break;
          }
          throw new Error(
            "Đoạn audio vẫn quá lớn sau khi nén. Hãy cắt video ngắn hơn rồi xuất phụ đề."
          );
        }
        chunks.push({
          blob,
          mimeType: "audio/mpeg",
          ext: "mp3",
          startSec: range.start,
          durationSec: range.duration || 0,
        });
      }
    } finally {
      await ff.deleteFile(inName).catch(() => undefined);
    }
    options.onProgress?.({ ratio: 1, message: "Đã nén audio" });
  });

  if (retryDuration > STT_CHUNK_SEC) {
    return prepareSpeechAudioChunksInBrowser(input, { ...options, durationSec: retryDuration });
  }

  if (!chunks.length) throw new Error("Nén audio STT thất bại");
  return chunks;
}

function parseSilenceLog(logs: string[]): { start: number; end: number }[] {
  const starts: number[] = [];
  const ranges: { start: number; end: number }[] = [];
  logs.forEach((line) => {
    const s = /silence_start:\s*([0-9.]+)/i.exec(line);
    if (s) starts.push(Number(s[1]));
    const e = /silence_end:\s*([0-9.]+)/i.exec(line);
    if (e) {
      const end = Number(e[1]);
      const start = starts.length ? starts.shift()! : 0;
      if (end > start) ranges.push({ start, end });
    }
  });
  return ranges;
}

function keepRangesFromSilence(
  silences: { start: number; end: number }[],
  duration: number
): { start: number; end: number }[] {
  const keep: { start: number; end: number }[] = [];
  let cursor = 0;
  silences.forEach((gap) => {
    if (gap.start - cursor >= 0.12) keep.push({ start: cursor, end: gap.start });
    cursor = Math.max(cursor, gap.end);
  });
  if (duration - cursor >= 0.12) keep.push({ start: cursor, end: duration });
  return keep;
}

export async function removeSilenceInBrowser(
  input: Blob,
  totalDuration: number,
  options: FfmpegMergeOptions & { fileName?: string; mimeType?: string } = {}
): Promise<TrimMediaResult> {
  if (!input || input.size <= 0) throw new Error("Chưa có file");
  const duration = Math.max(0.2, Number(totalDuration) || 0);
  const audio = isAudioMediaFile({ name: options.fileName, type: options.mimeType || input.type });

  if (audio) {
    const inExt = fileExtOf(options.fileName, "mp3");
    let result: TrimMediaResult | null = null;
    await enqueue(async () => {
      const ff = await getFFmpeg(options.onProgress);
      const stamp = Date.now();
      const inName = `sil_in_${stamp}.${inExt}`;
      const outName = `sil_out_${stamp}.wav`;
      await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
      try {
        options.onProgress?.({ ratio: 0.4, message: "Đang bỏ im lặng..." });
        const code = await ff.exec([
          "-i",
          inName,
          "-af",
          "silenceremove=start_periods=1:start_silence=0.25:start_threshold=-32dB:stop_periods=-1:stop_duration=0.4:stop_threshold=-32dB",
          "-c:a",
          "pcm_s16le",
          "-y",
          outName,
        ]);
        if (code !== 0) throw new Error(`Bỏ im lặng thất bại (exit ${code})`);
        result = {
          blob: toMediaBlob((await ff.readFile(outName)) as Uint8Array | string, "audio/wav"),
          mimeType: "audio/wav",
          ext: "wav",
        };
      } finally {
        await ff.deleteFile(inName).catch(() => undefined);
        await ff.deleteFile(outName).catch(() => undefined);
      }
    });
    if (!result) throw new Error("Bỏ im lặng thất bại");
    return result;
  }

  const logs: string[] = [];
  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const inName = `sil_in_${stamp}.mp4`;
    const onLog = ({ message }: { message: string }) => {
      logs.push(message);
    };
    ff.on("log", onLog);
    await ff.writeFile(inName, new Uint8Array(await input.arrayBuffer()));
    try {
      options.onProgress?.({ ratio: 0.2, message: "Đang dò đoạn im lặng..." });
      await ff.exec(["-i", inName, "-af", "silencedetect=noise=-30dB:d=0.35", "-f", "null", "-"]);
    } finally {
      try {
        (ff as { off?: (event: string, cb: (e: { message: string }) => void) => void }).off?.(
          "log",
          onLog
        );
      } catch {
        // ignore
      }
      await ff.deleteFile(inName).catch(() => undefined);
    }
  });

  const keep = keepRangesFromSilence(parseSilenceLog(logs), duration);
  if (!keep.length) throw new Error("Không còn đoạn có tiếng sau khi bỏ im lặng");
  options.onProgress?.({ ratio: 0.35, message: `Cắt ${keep.length} đoạn có tiếng...` });

  const clips: Blob[] = [];
  for (let i = 0; i < keep.length; i += 1) {
    const part = await trimVideoInBrowser(input, keep[i].start, keep[i].end, {
      onProgress: (p) =>
        options.onProgress?.({
          ratio: 0.35 + ((i + p.ratio) / keep.length) * 0.5,
          message: `Đoạn ${i + 1}/${keep.length}: ${p.message}`,
        }),
    });
    clips.push(part);
  }
  if (clips.length === 1) {
    return { blob: clips[0], mimeType: "video/mp4", ext: "mp4" };
  }
  options.onProgress?.({ ratio: 0.88, message: "Đang nối các đoạn..." });
  const merged = await mergeVideosInBrowser(clips, {
    onProgress: (p) => options.onProgress?.({ ratio: 0.88 + p.ratio * 0.1, message: p.message }),
  });
  return { blob: merged, mimeType: "video/mp4", ext: "mp4" };
}

/**
 * Xóa metadata container video (title, creation_time, encoder…) trước khi tải xuống.
 * Remux stream copy + `-map_metadata -1`; nếu fail trả blob gốc.
 */
export async function stripVideoMetadataInBrowser(input: Blob): Promise<Blob> {
  if (!input || input.size <= 0) return input;

  let resultBlob: Blob | null = null;

  try {
    await enqueue(async () => {
      const ff = await getFFmpeg();
      const inName = "strip_in.mp4";
      const outName = "strip_out.mp4";
      try {
        const buf = new Uint8Array(await input.arrayBuffer());
        await ff.writeFile(inName, buf);

        // Bỏ metadata file + stream (encoder, creation_time, title…)
        const code = await ff.exec([
          "-i",
          inName,
          "-map_metadata",
          "-1",
          "-map_chapters",
          "-1",
          "-c",
          "copy",
          "-movflags",
          "+faststart",
          "-y",
          outName,
        ]);
        if (code !== 0) {
          throw new Error(`strip metadata exit ${code}`);
        }

        const outData = await ff.readFile(outName);
        if (typeof outData === "string") {
          throw new Error("ffmpeg strip returned text");
        }
        const bytes =
          outData instanceof Uint8Array ? outData : new Uint8Array(outData as ArrayBuffer);
        if (bytes.byteLength <= 0) {
          throw new Error("strip metadata empty");
        }
        const ab = bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength
        ) as ArrayBuffer;
        resultBlob = new Blob([ab], { type: input.type || "video/mp4" });
      } finally {
        await ff.deleteFile(inName).catch(() => undefined);
        await ff.deleteFile(outName).catch(() => undefined);
      }
    });
  } catch (err) {
    console.warn("[stripVideoMetadataInBrowser] fallback original", err);
    return input;
  }

  return resultBlob || input;
}
