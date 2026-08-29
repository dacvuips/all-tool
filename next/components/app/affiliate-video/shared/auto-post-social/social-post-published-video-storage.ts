import { DB_NAME } from "../../constants";
import type { GeneratedVideoData } from "../../elements/hook/useElementApi";
import { openIndexedDBStore } from "../../hook/useIndexedDB";
import {
  ensureGeneratedVideoBinary,
  getGeneratedVideoPreviewSrc,
  prepareGeneratedVideoForIdb,
  toUiGeneratedVideo,
} from "../generatedMediaUtils";

const VIDEO_STORE_NAME = "generated-videos";

let videoDb: ReturnType<typeof openIndexedDBStore<GeneratedVideoData>> | null = null;

function getVideoDb() {
  if (!videoDb) {
    videoDb = openIndexedDBStore<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);
  }
  return videoDb;
}

export function socialPostPublishedVideoKey(groupId: string): string {
  return `social-post:${groupId}`;
}

export async function saveSocialPostPublishedVideo(
  groupId: string,
  blob: Blob
): Promise<string> {
  const key = socialPostPublishedVideoKey(groupId);
  const record: GeneratedVideoData = {
    videoUri: null,
    mediaBlob: blob,
    mimeType: blob.type || "video/mp4",
  };
  await getVideoDb().set(key, await prepareGeneratedVideoForIdb(record));
  return key;
}

export async function loadSocialPostPublishedVideoPreviewUrl(
  videoStorageKey: string | undefined
): Promise<string | null> {
  if (!videoStorageKey) return null;
  const raw = await getVideoDb().get(videoStorageKey);
  if (!raw) return null;
  const withBinary = await ensureGeneratedVideoBinary(raw);
  const ui = toUiGeneratedVideo(withBinary);
  return getGeneratedVideoPreviewSrc(ui) || ui.previewUrl || null;
}
