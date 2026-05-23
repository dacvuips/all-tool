/**
 * matchElementVideosInPrompt.ts
 * Tìm video tham chiếu trong danh sách videoRef của elementFormConfig
 * có tên xuất hiện trong visual_prompt của scene.
 * Trả về 1 slot duy nhất (video đầu tiên match).
 */
import { ElementFormConfig, ElementFormVideo } from "../../constants";
import { getTokenFirstIndexInPrompt } from "./matchElementImagesInPrompt";

/** Lấy tên hiển thị của video (bỏ phần mở rộng file). */
export function getVideoDisplayName(video: ElementFormVideo): string {
  const raw = (video.name || "").trim();
  if (!raw) return "";
  return raw.replace(/\.[^./\\]+$/, "").trim();
}

/** Tên dùng để match trong prompt (bỏ phần mở rộng, lowercase). */
export function getVideoMatchToken(video: ElementFormVideo): string {
  return getVideoDisplayName(video).toLowerCase();
}

/**
 * Tìm video match sớm nhất trong prompt.
 * Trả về mảng 1 phần tử: video đầu tiên có tên trong prompt, hoặc [undefined].
 */
export function matchElementVideosInPrompt(
  prompt: string,
  config?: Pick<ElementFormConfig, "videoRef">
): (ElementFormVideo | undefined)[] {
  const empty: (ElementFormVideo | undefined)[] = [undefined];
  const trimmed = prompt.trim();
  if (!trimmed || !config?.videoRef?.length) return empty;

  const videos = config.videoRef.filter((v) => v.videoBytes || v.fifeUrl);
  if (!videos.length) return empty;

  const matches = videos
    .map((vid) => ({
      vid,
      pos: getTokenFirstIndexInPrompt(trimmed, getVideoMatchToken(vid)),
    }))
    .filter((m) => m.pos >= 0)
    .sort((a, b) => a.pos - b.pos);

  if (matches.length === 0) return empty;
  return [matches[0].vid];
}

/**
 * Gộp video đã lưu theo scene với kết quả auto-match.
 * Ưu tiên override thủ công nếu có.
 */
export function resolveSceneElementVideoSlots(
  prompt: string,
  config: Pick<ElementFormConfig, "videoRef"> | undefined,
  savedSlots?: (ElementFormVideo | undefined)[]
): (ElementFormVideo | undefined)[] {
  const auto = matchElementVideosInPrompt(prompt, config);
  if (!savedSlots?.length) return auto;
  // slot 0: nếu đã override thủ công thì giữ, không thì dùng auto-match
  return [savedSlots[0] ?? auto[0]];
}
