/**
 * batchDownloadMedia.ts
 * Logic dùng chung: tải tuần tự từng file hoặc nén ZIP rồi tải một lần.
 */
import { saveAs } from "file-saver";
import JSZip from "jszip";
import {
  buildSceneImageFileName,
  buildSceneVideoFileName,
  generatedImageToBlob,
  generatedVideoToBlob,
  type GeneratedImageLike,
  type GeneratedVideoLike,
} from "./generatedMediaUtils";

export type SceneWithNumber = {
  id: string;
  sceneNumber: number;
  disabled?: boolean;
};

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

export function buildBatchZipFileName(kind: "images" | "videos"): string {
  const date = new Date().toISOString().slice(0, 10);
  return kind === "images" ? `images-${date}.zip` : `videos-${date}.zip`;
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
    const fileName = buildSceneImageFileName(scene.sceneNumber, mime);
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
    files.push({ fileName: buildSceneImageFileName(scene.sceneNumber, mime), blob });
  }
  await zipAndDownload(files, buildBatchZipFileName("images"));
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
      const fileName = buildSceneVideoFileName(scene.sceneNumber, mime);
      await downloadBlobSequentially(blob, fileName, waitMs);
      downloaded++;
    } catch (err) {
      console.error(`[downloadSceneVideosSequentially] Scene #${scene.sceneNumber}:`, err);
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
      const fileName = buildSceneVideoFileName(scene.sceneNumber, mime);
      files.push({ fileName, blob });
    } catch (err) {
      console.error(`[downloadSceneVideosAsZip] Scene #${scene.sceneNumber}:`, err);
    }
  }
  if (files.length === 0) return 0;
  await zipAndDownload(files, buildBatchZipFileName("videos"));
  return files.length;
}
