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

function isWasmMemoryError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /memory access out of bounds|out of bounds memory|Cannot enlarge memory|out of memory|OOM|Aborted\(native code\)|ArrayBuffer is detached|could not be cloned/i.test(
    msg
  );
}

/**
 * ffmpeg.wasm `writeFile` transfer ArrayBuffer sang Worker → buffer gốc bị detach.
 * Luôn `.slice()` trước khi ghi (đặc biệt với cache font / ghi 2 lần).
 */
function u8ForFfmpegWrite(data: Uint8Array): Uint8Array {
  return data.slice();
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
          ...H264_COMPAT_VIDEO_ARGS,
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

/** H.264 mở được trên Windows Movies & TV / hầu hết player. */
const H264_COMPAT_VIDEO_ARGS = [
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-profile:v",
  "main",
  "-level",
  "4.0",
] as const;

const VIDEO_ENCODE_ARGS = [
  ...H264_COMPAT_VIDEO_ARGS,
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

/** Scale video về 1080p (landscape: cao 1080; portrait 9:16: rộng 1080). */
export async function scaleVideoInBrowser(
  input: Blob,
  options: FfmpegMergeOptions & { portrait?: boolean } = {}
): Promise<Blob> {
  destroyFFmpegInstance();
  const vf = options.portrait
    ? "scale=1080:-2:flags=lanczos,setsar=1"
    : "scale=-2:1080:flags=lanczos,setsar=1";
  const result = await processMediaInBrowser(input, {
    ...options,
    message: options.portrait ? "Đang xuất 1080×1920..." : "Đang xuất 1920×1080...",
    args: [
      "-vf",
      `${vf},format=yuv420p`,
      ...H264_COMPAT_VIDEO_ARGS,
      "-preset",
      "ultrafast",
      "-crf",
      "28",
      "-threads",
      "1",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
    ],
    outExt: "mp4",
    outMime: "video/mp4",
  });
  destroyFFmpegInstance();
  return result.blob;
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

/**
 * Trộn nhiều audio theo mốc startSec tuyệt đối → 1 file MP3 dài totalSec.
 * Dùng adelay + amix (độc lập track video).
 */
export async function mixTimedAudioClipsInBrowser(
  clips: Array<{ blob: Blob; startSec: number; name?: string }>,
  totalSec: number,
  options: FfmpegMergeOptions = {}
): Promise<Blob> {
  const list = (clips || []).filter((c) => c?.blob && c.blob.size > 0);
  if (!list.length) throw new Error("Chưa có audio để xuất");
  const duration = Math.max(0.5, Number(totalSec) || 0.5);
  let resultBlob: Blob | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const names: string[] = [];
    try {
      options.onProgress?.({ ratio: 0.08, message: "Đang ghi audio..." });
      for (let i = 0; i < list.length; i += 1) {
        const ext = fileExtOf(list[i].name, "mp3");
        const name = `mix_in_${stamp}_${i}.${ext}`;
        await ff.writeFile(name, new Uint8Array(await list[i].blob.arrayBuffer()));
        names.push(name);
      }

      const outName = `mix_out_${stamp}.mp3`;
      options.onProgress?.({ ratio: 0.45, message: "Đang mix audio theo timeline..." });

      const filterParts: string[] = [];
      for (let i = 0; i < list.length; i += 1) {
        const ms = Math.max(0, Math.round((list[i].startSec || 0) * 1000));
        filterParts.push(
          `[${i}:a]adelay=${ms}|${ms},aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${i}]`
        );
      }
      const mixIn = list.map((_, i) => `[a${i}]`).join("");
      filterParts.push(
        `${mixIn}amix=inputs=${list.length}:duration=longest:dropout_transition=0:normalize=0,apad=whole_dur=${duration.toFixed(
          3
        )}[aout]`
      );
      const args: string[] = [];
      for (const n of names) args.push("-i", n);
      args.push(
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        "[aout]",
        "-t",
        duration.toFixed(3),
        "-c:a",
        "libmp3lame",
        "-q:a",
        "2",
        "-y",
        outName
      );
      let code = await ff.exec(args);
      if (code !== 0) {
        await ff.deleteFile(outName).catch(() => undefined);
        const wav = `mix_out_${stamp}.wav`;
        const argsWav = [...args];
        argsWav[argsWav.length - 1] = wav;
        const cIdx = argsWav.indexOf("-c:a");
        if (cIdx >= 0) {
          argsWav[cIdx + 1] = "pcm_s16le";
          if (argsWav[cIdx + 2] === "-q:a") {
            argsWav.splice(cIdx + 2, 2);
          }
        }
        code = await ff.exec(argsWav);
        if (code !== 0) throw new Error(`Mix audio thất bại (exit ${code})`);
        resultBlob = toMediaBlob((await ff.readFile(wav)) as Uint8Array | string, "audio/wav");
        await ff.deleteFile(wav).catch(() => undefined);
      } else {
        resultBlob = toMediaBlob(
          (await ff.readFile(outName)) as Uint8Array | string,
          "audio/mpeg"
        );
      }
      await ff.deleteFile(outName).catch(() => undefined);
    } finally {
      for (const name of names) await ff.deleteFile(name).catch(() => undefined);
    }
    options.onProgress?.({ ratio: 1, message: "Hoàn tất audio" });
  });

  if (!resultBlob) throw new Error("Mix audio thất bại");
  return resultBlob;
}

/** Ghép video + audio thành 1 MP4 — giữ tiếng gốc video và mix thêm audio timeline. */
export async function muxVideoAndAudioInBrowser(
  video: Blob,
  audio: Blob,
  options: FfmpegMergeOptions = {}
): Promise<Blob> {
  if (!video?.size) throw new Error("Thiếu video");
  if (!audio?.size) throw new Error("Thiếu audio");
  let resultBlob: Blob | null = null;

  await enqueue(async () => {
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const vName = `mux_v_${stamp}.mp4`;
    const aExt = /\bwav\b/i.test(audio.type || "") ? "wav" : "mp3";
    const aName = `mux_a_${stamp}.${aExt}`;
    const outName = `mux_out_${stamp}.mp4`;
    options.onProgress?.({ ratio: 0.1, message: "Đang mux video + audio..." });
    await ff.writeFile(vName, new Uint8Array(await video.arrayBuffer()));
    await ff.writeFile(aName, new Uint8Array(await audio.arrayBuffer()));

    const mixFilter =
      "[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[va];" +
      "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[oa];" +
      "[va][oa]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]";

    const runMux = async (opts: {
      reencodeVideo: boolean;
      mixVideoAudio: boolean;
    }) => {
      const args = ["-i", vName, "-i", aName];
      if (opts.mixVideoAudio) {
        args.push("-filter_complex", mixFilter, "-map", "0:v:0", "-map", "[aout]");
      } else {
        args.push("-map", "0:v:0", "-map", "1:a:0");
      }
      if (opts.reencodeVideo) {
        args.push(
          ...H264_COMPAT_VIDEO_ARGS,
          "-preset",
          "veryfast",
          "-crf",
          "23"
        );
      } else {
        args.push("-c:v", "copy");
      }
      args.push(
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        "-movflags",
        "+faststart",
        "-y",
        outName
      );
      return ff.exec(args);
    };

    try {
      // 1) Giữ tiếng video + mix audio timeline (copy video)
      let code = await runMux({ reencodeVideo: false, mixVideoAudio: true });
      // 2) Cùng mix nhưng re-encode video
      if (code !== 0) {
        await ff.deleteFile(outName).catch(() => undefined);
        code = await runMux({ reencodeVideo: true, mixVideoAudio: true });
      }
      // 3) Video không có audio track → chỉ dùng audio timeline
      if (code !== 0) {
        await ff.deleteFile(outName).catch(() => undefined);
        code = await runMux({ reencodeVideo: false, mixVideoAudio: false });
      }
      if (code !== 0) {
        await ff.deleteFile(outName).catch(() => undefined);
        code = await runMux({ reencodeVideo: true, mixVideoAudio: false });
      }
      if (code !== 0) throw new Error(`Mux thất bại (exit ${code})`);
      resultBlob = toVideoBlob((await ff.readFile(outName)) as Uint8Array | string);
    } finally {
      await ff.deleteFile(vName).catch(() => undefined);
      await ff.deleteFile(aName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
    }
    options.onProgress?.({ ratio: 1, message: "Hoàn tất mux" });
  });

  if (!resultBlob) throw new Error("Mux video/audio thất bại");
  return resultBlob;
}

export type FfmpegSubtitleCue = {
  startSec: number;
  endSec: number;
  text: string;
};

function wrapSubtitleLines(text: string, maxChars = 36): string {
  const raw = String(text || "").trim().replace(/\s+/g, " ");
  if (!raw) return "";
  const words = raw.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3).join("\n");
}

function buildSrtContent(cues: FfmpegSubtitleCue[]): string {
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");
  const fmt = (sec: number) => {
    const s = Math.max(0, sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const whole = Math.floor(s % 60);
    const ms = Math.min(999, Math.round((s - Math.floor(s)) * 1000));
    return `${pad(h)}:${pad(m)}:${pad(whole)},${String(ms).padStart(3, "0")}`;
  };
  return cues
    .filter((c) => c.endSec > c.startSec && String(c.text || "").trim())
    .map((c, i) => {
      const body = wrapSubtitleLines(c.text);
      return `${i + 1}\n${fmt(c.startSec)} --> ${fmt(c.endSec)}\n${body}\n`;
    })
    .join("\n");
}

function normalizeBurnHex(input: string | undefined, fallback: string): string {
  const s = String(input || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const h = s.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return fallback;
}

/**
 * Burn phụ đề vào video (chữ nằm sẵn trong khung hình).
 * Ưu tiên: Canvas (font browser, tiếng Việt đúng) → PNG overlay 1 pass ffmpeg.
 * Tránh ASS/libass (hay ra khối trắng khi thiếu glyph / BorderStyle box).
 */
export type BurnSubtitlesResult = {
  blob: Blob;
  mode: "hard" | "soft" | "none";
};

type BurnSubStyle = {
  fontSizePx?: number;
  xPercent?: number;
  yPercent?: number;
  widthPercent?: number;
  textColor?: string;
  bgColor?: string;
  bgTransparent?: boolean;
  borderColor?: string;
  borderTransparent?: boolean;
};

function probeVideoBlobMeta(
  blob: Blob
): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.playsInline = true;
    const cleanup = () => {
      URL.revokeObjectURL(url);
      el.removeAttribute("src");
      el.load();
    };
    el.onloadedmetadata = () => {
      const width = Math.max(2, el.videoWidth || 720);
      const height = Math.max(2, el.videoHeight || 1280);
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      cleanup();
      resolve({ width, height, duration });
    };
    el.onerror = () => {
      cleanup();
      reject(new Error("Không đọc được metadata video"));
    };
    el.src = url;
  });
}

function hexToCssRgba(hex: string, alpha: number): string {
  const h = normalizeBurnHex(hex, "#000000").slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r},${g},${b},${a})`;
}

/** Vẽ 1 cue ra PNG full-frame trong suốt (Canvas = font hệ thống, không tofu trắng). */
async function renderSubtitleCuePng(
  cueText: string,
  width: number,
  height: number,
  style: BurnSubStyle
): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D không khả dụng");

  ctx.clearRect(0, 0, width, height);

  const xPercent = Math.max(0, Math.min(100, style.xPercent ?? 50));
  const yPercent = Math.max(0, Math.min(100, style.yPercent ?? 88));
  const widthPercent = Math.max(20, Math.min(100, style.widthPercent ?? 90));
  // Preview Studio ~320–480px cao; scale font theo chiều cao video thật.
  const basePx = Math.max(12, Math.round(style.fontSizePx ?? 16));
  const fontSize = Math.max(18, Math.min(72, Math.round(basePx * (height / 360))));
  const textColor = normalizeBurnHex(style.textColor, "#ffffff");
  const bgColor = normalizeBurnHex(style.bgColor, "#000000");
  const borderColor = normalizeBurnHex(style.borderColor, "#000000");
  const bgTransparent = !!style.bgTransparent;
  const borderTransparent = !!style.borderTransparent;

  const maxBoxW = (widthPercent / 100) * width;
  const cx = (xPercent / 100) * width;
  const cy = (yPercent / 100) * height;
  const lineHeight = fontSize * 1.25;
  const padX = Math.round(fontSize * 0.55);
  const padY = Math.round(fontSize * 0.4);

  const approxChars = Math.max(8, Math.floor(maxBoxW / (fontSize * 0.55)));
  const body = wrapSubtitleLines(cueText, approxChars);
  const lines = body.split("\n").filter(Boolean);
  if (!lines.length) {
    return new Uint8Array();
  }

  ctx.font = `600 ${fontSize}px "Segoe UI", "Roboto", "Noto Sans", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  let textW = 0;
  for (const line of lines) {
    textW = Math.max(textW, ctx.measureText(line).width);
  }
  const boxW = Math.min(maxBoxW, textW + padX * 2);
  const boxH = lines.length * lineHeight + padY * 2;
  const boxX = cx - boxW / 2;
  const boxY = cy - boxH / 2;
  const radius = Math.min(12, fontSize * 0.35);

  if (!bgTransparent) {
    ctx.fillStyle = hexToCssRgba(bgColor, 0.8);
    roundRectPath(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.fill();
  }
  if (!borderTransparent) {
    ctx.strokeStyle = hexToCssRgba(borderColor, 0.9);
    ctx.lineWidth = Math.max(1, Math.round(fontSize / 18));
    roundRectPath(ctx, boxX, boxY, boxW, boxH, radius);
    ctx.stroke();
  }

  const strokeW = Math.max(2, Math.round(fontSize / 12));
  for (let i = 0; i < lines.length; i++) {
    const ly = boxY + padY + lineHeight * (i + 0.5);
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = borderTransparent ? "rgba(0,0,0,0.85)" : hexToCssRgba(borderColor, 0.95);
    ctx.strokeText(lines[i], cx, ly, maxBoxW - padX);
    ctx.fillStyle = textColor;
    ctx.fillText(lines[i], cx, ly, maxBoxW - padX);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob PNG thất bại"))),
      "image/png"
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export async function burnSubtitlesOntoVideoInBrowser(
  video: Blob,
  cues: FfmpegSubtitleCue[],
  options: FfmpegMergeOptions & {
    style?: BurnSubStyle;
    /** false = không chấp nhận soft-sub (chỉ hard-burn hoặc video gốc) */
    allowSoftSub?: boolean;
  } = {}
): Promise<BurnSubtitlesResult> {
  if (!video?.size) throw new Error("Thiếu video");
  const list = (cues || [])
    .map((c) => ({
      startSec: Math.max(0, Number(c.startSec) || 0),
      endSec: Math.max(0, Number(c.endSec) || 0),
      text: String(c.text || "").trim(),
    }))
    .filter((c) => c.text && c.endSec > c.startSec + 0.05);
  if (!list.length) return { blob: video, mode: "none" };

  const style = options.style || {};
  const allowSoftSub = options.allowSoftSub !== false;
  let result: BurnSubtitlesResult = { blob: video, mode: "none" };

  options.onProgress?.({ ratio: 0.08, message: "Đang vẽ phụ đề (Canvas)..." });
  let meta: { width: number; height: number; duration: number };
  try {
    meta = await probeVideoBlobMeta(video);
  } catch {
    meta = { width: 720, height: 1280, duration: 0 };
  }

  const pngs: Uint8Array[] = [];
  for (let i = 0; i < list.length; i++) {
    options.onProgress?.({
      ratio: 0.08 + (i / Math.max(1, list.length)) * 0.2,
      message: `Đang vẽ phụ đề ${i + 1}/${list.length}...`,
    });
    pngs.push(await renderSubtitleCuePng(list[i].text, meta.width, meta.height, style));
  }

  const runOverlay = async (): Promise<BurnSubtitlesResult> => {
    destroyFFmpegInstance();
    const ff = await getFFmpeg(options.onProgress);
    const stamp = Date.now();
    const vName = `sub_v_${stamp}.mp4`;
    const outName = `sub_out_${stamp}.mp4`;
    const pngNames: string[] = [];
    const srtName = `sub_${stamp}.srt`;

    await ff.writeFile(vName, new Uint8Array(await video.arrayBuffer()));
    await ff.writeFile(srtName, buildSrtContent(list));

    try {
      for (let i = 0; i < pngs.length; i++) {
        if (!pngs[i]?.byteLength) continue;
        const name = `cue_${stamp}_${i}.png`;
        pngNames.push(name);
        await ff.writeFile(name, u8ForFfmpegWrite(pngs[i]));
      }

      if (!pngNames.length) return { blob: video, mode: "none" };

      // Overlay cụm ≤10 ảnh / pass — ít pass hơn = nhanh hơn (vẫn tránh OOM).
      const chunkSize = 10;
      let currentIn = vName;
      const temps: string[] = [];
      let code = 0;

      const activeIdx = list
        .map((c, i) => ({ c, i }))
        .filter(({ i }) => pngs[i]?.byteLength > 0);

      for (let offset = 0; offset < activeIdx.length; offset += chunkSize) {
        const chunk = activeIdx.slice(offset, offset + chunkSize);
        const midOut =
          offset + chunkSize >= activeIdx.length
            ? outName
            : `sub_mid_${stamp}_${offset}.mp4`;

        const args: string[] = ["-i", currentIn];
        for (const { i } of chunk) {
          args.push("-i", `cue_${stamp}_${i}.png`);
        }

        let filter = "";
        let lastLabel = "[0:v]";
        for (let j = 0; j < chunk.length; j++) {
          const { c } = chunk[j];
          const outLabel = j === chunk.length - 1 ? "[vout]" : `[v${offset}_${j}]`;
          const enable = `between(t\\,${c.startSec.toFixed(3)}\\,${c.endSec.toFixed(3)})`;
          // format=yuv420 — tránh RGBA/444 (Windows báo unsupported encoding)
          filter += `${lastLabel}[${j + 1}:v]overlay=0:0:format=yuv420:enable='${enable}'${outLabel};`;
          lastLabel = outLabel;
        }
        // Ép yuv420p + kích thước chẵn (Windows / H.264)
        filter += `${lastLabel}format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2[vfinal]`;

        options.onProgress?.({
          ratio: 0.3 + (offset / Math.max(1, activeIdx.length)) * 0.55,
          message: `Đang burn phụ đề ${Math.min(offset + chunkSize, activeIdx.length)}/${activeIdx.length}...`,
        });

        const videoEncode = [
          ...H264_COMPAT_VIDEO_ARGS,
          "-preset",
          "ultrafast",
          "-crf",
          "28",
          "-threads",
          "1",
          "-movflags",
          "+faststart",
        ];
        code = await ff.exec([
          ...args,
          "-filter_complex",
          filter,
          "-map",
          "[vfinal]",
          "-map",
          "0:a",
          ...videoEncode,
          "-c:a",
          "copy",
          "-shortest",
          "-y",
          midOut,
        ]);
        if (code !== 0) {
          await ff.deleteFile(midOut).catch(() => undefined);
          code = await ff.exec([
            ...args,
            "-filter_complex",
            filter,
            "-map",
            "[vfinal]",
            "-an",
            ...videoEncode,
            "-shortest",
            "-y",
            midOut,
          ]);
        }
        if (code !== 0) break;
        if (currentIn !== vName) temps.push(currentIn);
        currentIn = midOut;
      }

      for (const t of temps) await ff.deleteFile(t).catch(() => undefined);

      if (code === 0) {
        return {
          blob: toVideoBlob((await ff.readFile(outName)) as Uint8Array | string),
          mode: "hard",
        };
      }

      // Soft-sub nhanh (không hiện chữ trừ khi bật CC) — chỉ khi cho phép.
      if (allowSoftSub) {
        await ff.deleteFile(outName).catch(() => undefined);
        options.onProgress?.({ ratio: 0.9, message: "Đang gắn soft-sub..." });
        code = await ff.exec([
          "-i",
          vName,
          "-i",
          srtName,
          "-c",
          "copy",
          "-c:s",
          "mov_text",
          "-metadata:s:s:0",
          "language=vie",
          "-movflags",
          "+faststart",
          "-y",
          outName,
        ]);
        if (code === 0) {
          return {
            blob: toVideoBlob((await ff.readFile(outName)) as Uint8Array | string),
            mode: "soft",
          };
        }
      }

      return { blob: video, mode: "none" };
    } finally {
      await ff.deleteFile(vName).catch(() => undefined);
      await ff.deleteFile(srtName).catch(() => undefined);
      await ff.deleteFile(outName).catch(() => undefined);
      for (const n of pngNames) await ff.deleteFile(n).catch(() => undefined);
      destroyFFmpegInstance();
    }
  };

  await enqueue(async () => {
    try {
      result = await runOverlay();
    } catch (err) {
      if (!isWasmMemoryError(err)) throw err;
      console.warn("[burnSubtitles] OOM overlay, thử lại:", err);
      destroyFFmpegInstance();
      try {
        result = await runOverlay();
      } catch (err2) {
        if (isWasmMemoryError(err2)) {
          console.warn("[burnSubtitles] OOM lần 2 — bỏ burn", err2);
          destroyFFmpegInstance();
          result = { blob: video, mode: "none" };
        } else {
          throw err2;
        }
      }
    }
    options.onProgress?.({ ratio: 1, message: "Hoàn tất phụ đề" });
  });

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
