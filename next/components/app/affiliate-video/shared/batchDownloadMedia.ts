/**
 * batchDownloadMedia.ts
 * Logic dùng chung: tải tuần tự từng file hoặc nén ZIP rồi tải một lần.
 */
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
  buildSceneImageFileName,
  buildSceneVideoFileName,
  fetchUpsampled1080pVideoBlob,
  fetchUpsampledImageBlob,
  generatedImageToBlob,
  generatedVideoToBlob,
  hasFlow2Upsample1080pVideoMeta,
  hasFlow2UpsampleMeta,
  mimeTypeToFileExtension,
  type GeneratedImageLike,
  type GeneratedVideoLike,
  type UpsampleResolution,
  type VideoDownloadResolution,
} from "./generatedMediaUtils";

export type SceneWithNumber = {
  id: string;
  sceneNumber?: number;
  disabled?: boolean;
};

function resolveSceneNumber(scene: SceneWithNumber, index: number): number {
  return scene.sceneNumber ?? index + 1;
}

/** Download a blob and wait for browser to process before next file. */
export async function downloadBlobSequentially(
  blob: Blob,
  fileName: string,
  waitMs: number
): Promise<void> {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  await new Promise((r) => setTimeout(r, waitMs));

  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

export async function zipAndDownload(
  files: { fileName: string; blob: Blob }[],
  zipFileName: string,
  onPackProgress?: (current: number, total: number) => void
): Promise<void> {
  const zip = new JSZip();
  for (let i = 0; i < files.length; i++) {
    const buffer = await files[i].blob.arrayBuffer();
    zip.file(files[i].fileName, buffer);
    onPackProgress?.(i + 1, files.length);
  }
  const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  saveAs(content, zipFileName);
}

export function buildBatchZipFileName(
  kind: "images" | "videos",
  resolution?: UpsampleResolution | VideoDownloadResolution
): string {
  const date = new Date().toISOString().slice(0, 10);
  if (kind === "videos") {
    if (resolution) return `videos-${resolution}-${date}.zip`;
    return `videos-${date}.zip`;
  }
  if (resolution) return `images-${resolution.toLowerCase()}-${date}.zip`;
  return `images-${date}.zip`;
}

export function filterScenesForUpsample<T extends SceneWithNumber>(
  items: { scene: T; img: GeneratedImageLike }[],
  resolution: UpsampleResolution
): { scene: T; img: GeneratedImageLike }[] {
  return items.filter(({ img }) => hasFlow2UpsampleMeta(img, resolution));
}

export function filterScenesForVideoUpsample1080p<T extends SceneWithNumber>(
  items: { scene: T; vid: GeneratedVideoLike }[]
): { scene: T; vid: GeneratedVideoLike }[] {
  return items.filter(({ vid }) => hasFlow2Upsample1080pVideoMeta(vid));
}

function buildUpsampledSceneVideoFileName(sceneNumber: number, mimeType?: string): string {
  const ext = mimeTypeToFileExtension(mimeType, "mp4");
  return `scene-${sceneNumber}-video-1080p.${ext}`;
}

function buildUpsampledSceneImageFileName(
  sceneNumber: number,
  resolution: UpsampleResolution,
  mimeType?: string
): string {
  const ext = mimeTypeToFileExtension(mimeType, "jpg");
  return `${sceneNumber}-${resolution.toLowerCase()}.${ext}`;
}

export async function collectSceneImageFiles<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedImage: (sceneId: string) => Promise<GeneratedImageLike | null | undefined>
): Promise<{ scene: T; img: GeneratedImageLike }[]> {
  const eligible = scenes.filter((s) => !s.disabled);
  const result: { scene: T; img: GeneratedImageLike }[] = [];
  for (const scene of eligible) {
    const img = await getGeneratedImage(scene.id);
    if (img) result.push({ scene, img });
  }
  return result;
}

export async function collectSceneVideoFiles<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<{ scene: T; vid: GeneratedVideoLike }[]> {
  const eligible = scenes.filter((s) => !s.disabled);
  const result: { scene: T; vid: GeneratedVideoLike }[] = [];
  for (const scene of eligible) {
    const vid = await getGeneratedVideo(scene.id);
    if (vid && (vid.videoUri || vid.videoBytes)) {
      result.push({ scene, vid });
    }
  }
  return result;
}

export async function downloadSceneImagesSequentially<T extends SceneWithNumber>(
  items: { scene: T; img: GeneratedImageLike }[],
  onProgress?: (current: number, total: number) => void,
  waitMs = 2000
): Promise<number> {
  const total = items.length;
  for (let i = 0; i < total; i++) {
    const { scene, img } = items[i];
    onProgress?.(i + 1, total);
    const blob = await generatedImageToBlob(img);
    const mime = img.mimeType || blob.type || "image/png";
    const fileName = buildSceneImageFileName(resolveSceneNumber(scene, i), mime);
    await downloadBlobSequentially(blob, fileName, waitMs);
  }
  return total;
}

export async function downloadSceneImagesAsZip<T extends SceneWithNumber>(
  items: { scene: T; img: GeneratedImageLike }[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const files: { fileName: string; blob: Blob }[] = [];
  const total = items.length;
  for (let i = 0; i < total; i++) {
    const { scene, img } = items[i];
    onProgress?.(i + 1, total);
    const blob = await generatedImageToBlob(img);
    const mime = img.mimeType || blob.type || "image/png";
    files.push({ fileName: buildSceneImageFileName(resolveSceneNumber(scene, i), mime), blob });
  }
  await zipAndDownload(files, buildBatchZipFileName("images"));
}

export async function downloadSceneImagesUpsampledSequentially<T extends SceneWithNumber>(
  items: { scene: T; img: GeneratedImageLike }[],
  resolution: UpsampleResolution,
  onProgress?: (current: number, total: number) => void,
  waitMs = 2500
): Promise<number> {
  const eligible = filterScenesForUpsample(items, resolution);
  const total = eligible.length;
  for (let i = 0; i < total; i++) {
    const { scene, img } = eligible[i];
    onProgress?.(i + 1, total);
    const blob = await fetchUpsampledImageBlob(img, resolution);
    const mime = blob.type || img.mimeType || "image/jpeg";
    const fileName = buildUpsampledSceneImageFileName(resolveSceneNumber(scene, i), resolution, mime);
    await downloadBlobSequentially(blob, fileName, waitMs);
  }
  return total;
}

export async function downloadSceneImagesUpsampledAsZip<T extends SceneWithNumber>(
  items: { scene: T; img: GeneratedImageLike }[],
  resolution: UpsampleResolution,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const eligible = filterScenesForUpsample(items, resolution);
  const files: { fileName: string; blob: Blob }[] = [];
  const total = eligible.length;
  for (let i = 0; i < total; i++) {
    const { scene, img } = eligible[i];
    onProgress?.(i + 1, total);
    const blob = await fetchUpsampledImageBlob(img, resolution);
    const mime = blob.type || img.mimeType || "image/jpeg";
    files.push({
      fileName: buildUpsampledSceneImageFileName(resolveSceneNumber(scene, i), resolution, mime),
      blob,
    });
  }
  if (files.length === 0) return 0;
  await zipAndDownload(files, buildBatchZipFileName("images", resolution));
  return files.length;
}

export type BatchUpsampleImageDownloadResult = {
  downloaded: number;
  skippedMissingMeta: number;
};

type BatchUpsampleToast = {
  warn: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

/** Logic dùng chung cho handler tải hàng loạt ảnh 2K/4K trong batch action hooks. */
export async function handleBatchUpsampleDownloadAction<T extends SceneWithNumber>(options: {
  scenes: T[];
  getGeneratedImage: (sceneId: string) => Promise<GeneratedImageLike | null | undefined>;
  resolution: UpsampleResolution;
  asZip: boolean;
  setDownloadLabel: (label: string) => void;
  toast: BatchUpsampleToast;
  t: (key: string, options?: Record<string, unknown>) => string;
}): Promise<void> {
  const { scenes, getGeneratedImage, resolution, asZip, setDownloadLabel, toast, t } = options;

  const { downloaded, skippedMissingMeta } = await runBatchUpsampleImageDownload(
    scenes,
    getGeneratedImage,
    resolution,
    asZip,
    (cur, tot) => setDownloadLabel(`${cur}/${tot}`)
  );

  if (downloaded === 0) {
    toast.warn(
      skippedMissingMeta > 0
        ? t("Không có ảnh nào hỗ trợ upscale {{res}} (cần tạo lại ảnh)", { res: resolution })
        : t("Chưa có ảnh nào được tạo để tải")
    );
    return;
  }

  if (asZip) {
    toast.success(`${t("Đã tải")} ${downloaded} ${t("ảnh {{res}} trong file ZIP!", { res: resolution })}`);
  } else {
    toast.success(`${t("Đã tải")} ${downloaded} ${t("ảnh {{res}} thành công!", { res: resolution })}`);
  }

  if (skippedMissingMeta > 0) {
    toast.warn(t("{{n}} ảnh bỏ qua (thiếu metadata {{res}})", { n: skippedMissingMeta, res: resolution }));
  }
}

/** Tải hàng loạt ảnh upscale 2K/4K — bỏ qua scene thiếu metadata Flow2. */
export async function runBatchUpsampleImageDownload<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedImage: (sceneId: string) => Promise<GeneratedImageLike | null | undefined>,
  resolution: UpsampleResolution,
  asZip: boolean,
  onProgress?: (current: number, total: number) => void
): Promise<BatchUpsampleImageDownloadResult> {
  const allItems = await collectSceneImageFiles(scenes, getGeneratedImage);
  if (allItems.length === 0) {
    return { downloaded: 0, skippedMissingMeta: 0 };
  }

  const eligible = filterScenesForUpsample(allItems, resolution);
  const skippedMissingMeta = allItems.length - eligible.length;

  if (eligible.length === 0) {
    return { downloaded: 0, skippedMissingMeta };
  }

  if (asZip) {
    const downloaded = await downloadSceneImagesUpsampledAsZip(eligible, resolution, onProgress);
    return { downloaded, skippedMissingMeta };
  }

  const downloaded = await downloadSceneImagesUpsampledSequentially(
    eligible,
    resolution,
    onProgress
  );
  return { downloaded, skippedMissingMeta };
}

export async function downloadSceneVideosSequentially<T extends SceneWithNumber>(
  items: { scene: T; vid: GeneratedVideoLike }[],
  onProgress?: (current: number, total: number) => void,
  waitMs = 3000
): Promise<number> {
  const total = items.length;
  let downloaded = 0;
  for (let i = 0; i < total; i++) {
    const { scene, vid } = items[i];
    onProgress?.(i + 1, total);
    try {
      const blob = await generatedVideoToBlob(vid);
      const mime = vid.mimeType || blob.type || "video/mp4";
      const fileName = buildSceneVideoFileName(resolveSceneNumber(scene, i), mime);
      await downloadBlobSequentially(blob, fileName, waitMs);
      downloaded++;
    } catch (err) {
      console.error(`[downloadSceneVideosSequentially] Scene #${resolveSceneNumber(scene, i)}:`, err);
    }
  }
  return downloaded;
}

export async function downloadSceneVideosAsZip<T extends SceneWithNumber>(
  items: { scene: T; vid: GeneratedVideoLike }[],
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const files: { fileName: string; blob: Blob }[] = [];
  const total = items.length;
  for (let i = 0; i < total; i++) {
    const { scene, vid } = items[i];
    onProgress?.(i + 1, total);
    try {
      const blob = await generatedVideoToBlob(vid);
      const mime = vid.mimeType || blob.type || "video/mp4";
      const fileName = buildSceneVideoFileName(resolveSceneNumber(scene, i), mime);
      files.push({ fileName, blob });
    } catch (err) {
      console.error(`[downloadSceneVideosAsZip] Scene #${resolveSceneNumber(scene, i)}:`, err);
    }
  }
  if (files.length === 0) return 0;
  await zipAndDownload(files, buildBatchZipFileName("videos"));
  return files.length;
}

export async function downloadSceneVideos1080pSequentially<T extends SceneWithNumber>(
  items: { scene: T; vid: GeneratedVideoLike }[],
  onProgress?: (current: number, total: number) => void,
  waitMs = 3500
): Promise<number> {
  const eligible = filterScenesForVideoUpsample1080p(items);
  const total = eligible.length;
  let downloaded = 0;
  for (let i = 0; i < total; i++) {
    const { scene, vid } = eligible[i];
    onProgress?.(i + 1, total);
    try {
      const blob = await fetchUpsampled1080pVideoBlob(vid);
      const mime = blob.type || vid.mimeType || "video/mp4";
      const fileName = buildUpsampledSceneVideoFileName(resolveSceneNumber(scene, i), mime);
      await downloadBlobSequentially(blob, fileName, waitMs);
      downloaded++;
    } catch (err) {
      console.error(
        `[downloadSceneVideos1080pSequentially] Scene #${resolveSceneNumber(scene, i)}:`,
        err
      );
    }
  }
  return downloaded;
}

export async function downloadSceneVideos1080pAsZip<T extends SceneWithNumber>(
  items: { scene: T; vid: GeneratedVideoLike }[],
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  const eligible = filterScenesForVideoUpsample1080p(items);
  const files: { fileName: string; blob: Blob }[] = [];
  const total = eligible.length;
  for (let i = 0; i < total; i++) {
    const { scene, vid } = eligible[i];
    onProgress?.(i + 1, total);
    try {
      const blob = await fetchUpsampled1080pVideoBlob(vid);
      const mime = blob.type || vid.mimeType || "video/mp4";
      const fileName = buildUpsampledSceneVideoFileName(resolveSceneNumber(scene, i), mime);
      files.push({ fileName, blob });
    } catch (err) {
      console.error(`[downloadSceneVideos1080pAsZip] Scene #${resolveSceneNumber(scene, i)}:`, err);
    }
  }
  if (files.length === 0) return 0;
  await zipAndDownload(files, buildBatchZipFileName("videos", "1080p"));
  return files.length;
}

export type BatchUpsampleVideoDownloadResult = {
  downloaded: number;
  skippedMissingMeta: number;
};

/** Logic dùng chung cho handler tải hàng loạt video 1080p trong batch action hooks. */
export async function handleBatchUpsampleVideoDownloadAction<T extends SceneWithNumber>(options: {
  scenes: T[];
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>;
  asZip: boolean;
  setDownloadVideoLabel: (label: string) => void;
  toast: BatchUpsampleToast;
  t: (key: string, options?: Record<string, unknown>) => string;
}): Promise<void> {
  const { scenes, getGeneratedVideo, asZip, setDownloadVideoLabel, toast, t } = options;

  const { downloaded, skippedMissingMeta } = await runBatchUpsampleVideoDownload(
    scenes,
    getGeneratedVideo,
    asZip,
    (cur, tot) => setDownloadVideoLabel(`${cur}/${tot}`)
  );

  if (downloaded === 0) {
    toast.warn(
      skippedMissingMeta > 0
        ? t("Không có video nào hỗ trợ upscale 1080p (cần tạo lại video)")
        : t("Chưa có video nào được tạo để tải")
    );
    return;
  }

  if (asZip) {
    toast.success(`${t("Đã tải")} ${downloaded} ${t("video 1080p trong file ZIP!")}`);
  } else {
    toast.success(`${t("Đã tải")} ${downloaded} ${t("video 1080p thành công!")}`);
  }

  if (skippedMissingMeta > 0) {
    toast.warn(t("{{n}} video bỏ qua (thiếu metadata 1080p)", { n: skippedMissingMeta }));
  }
}

export async function runBatchUpsampleVideoDownload<T extends SceneWithNumber>(
  scenes: T[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>,
  asZip: boolean,
  onProgress?: (current: number, total: number) => void
): Promise<BatchUpsampleVideoDownloadResult> {
  const allItems = await collectSceneVideoFiles(scenes, getGeneratedVideo);
  if (allItems.length === 0) {
    return { downloaded: 0, skippedMissingMeta: 0 };
  }

  const eligible = filterScenesForVideoUpsample1080p(allItems);
  const skippedMissingMeta = allItems.length - eligible.length;

  if (eligible.length === 0) {
    return { downloaded: 0, skippedMissingMeta };
  }

  if (asZip) {
    const downloaded = await downloadSceneVideos1080pAsZip(eligible, onProgress);
    return { downloaded, skippedMissingMeta };
  }

  const downloaded = await downloadSceneVideos1080pSequentially(eligible, onProgress);
  return { downloaded, skippedMissingMeta };
}
