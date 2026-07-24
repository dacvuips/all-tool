/**
 * ffmpeg-browser.ts
 * Nối video bằng ffmpeg.wasm — chạy hoàn toàn trong browser, không tốn server.
 *
 * - Lazy load wasm lần đầu (~25MB, cache trình duyệt lần sau)
 * - Queue: chỉ 1 job chạy cùng lúc (tránh OOM)
 * - Dùng @ffmpeg/core single-thread → không cần SharedArrayBuffer / COEP
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

async function getFFmpeg(
  onProgress?: FfmpegMergeOptions["onProgress"]
): Promise<import("@ffmpeg/ffmpeg").FFmpeg> {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    onProgress?.({ ratio: 0.02, message: "Đang tải ffmpeg.wasm..." });
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");

    // Single-thread core — không cần SharedArrayBuffer / COEP headers
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    const ff = new FFmpeg();

    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });

    _ffmpegInstance = ff;
    return ff;
  })().catch((err) => {
    _loadPromise = null;
    throw err;
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

      // Ưu tiên copy (nhanh); re-encode nếu codec/container lệch
      let copyOk = false;
      try {
        await ff.exec([
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
        copyOk = true;
      } catch {
        copyOk = false;
      }

      if (!copyOk) {
        options.onProgress?.({ ratio: 0.7, message: "Đang re-encode video..." });
        await ff.exec([
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
      }

      options.onProgress?.({ ratio: 0.92, message: "Đang đọc kết quả..." });

      const outData = await ff.readFile("output.mp4");
      if (typeof outData === "string") {
        throw new Error("ffmpeg trả về text thay vì video binary");
      }
      const bytes =
        outData instanceof Uint8Array ? outData : new Uint8Array(outData as ArrayBuffer);
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
