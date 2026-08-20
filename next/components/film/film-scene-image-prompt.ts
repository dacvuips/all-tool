/**
 * Prompt ảnh phân cảnh — ghép từ Chuỗi Cảnh quay.
 * Nguồn: Cỡ cảnh, Góc máy, [Hành động nhân vật], [Hình ảnh cảnh quay], [Không khí cảnh]
 * (+ tuỳ chọn suffix cấu hình Setting).
 */
import type { FilmSceneRecord } from "./film-types";

/** Ràng buộc chống ảnh bị chia nhiều panel / storyboard trong một ảnh. */
export const FILM_SINGLE_FRAME_IMAGE_CONSTRAINT = `[Định dạng ảnh]
- Chỉ MỘT khung hình duy nhất, liền mạch (single unified cinematic frame).
- KHÔNG chia ô, KHÔNG storyboard panel, KHÔNG comic strip, KHÔNG lưới ảnh, KHÔNG xếp nhiều cảnh trong cùng một ảnh.
- Single continuous still — no split panels, no multi-frame collage, no contact sheet, no diptych/triptych.`;

/** Ghép ràng buộc 1 khung nếu prompt chưa có (tránh trùng khi hydrate lại). */
export function appendFilmSingleFrameImageConstraint(prompt: string): string {
  const text = String(prompt || "").trim();
  if (!text) return FILM_SINGLE_FRAME_IMAGE_CONSTRAINT;
  if (
    /single unified frame|single continuous still|khung hình duy nhất|no split panel|không chia ô/i.test(
      text
    )
  ) {
    return text;
  }
  return `${text}\n\n${FILM_SINGLE_FRAME_IMAGE_CONSTRAINT}`;
}

export type FilmSceneImagePromptSource = Pick<
  FilmSceneRecord,
  | "visualDescription"
  | "atmosphere"
  | "action"
  | "shotSize"
  | "cameraAngle"
  | "location"
  | "summary"
>;

/**
 * Một field → khối riêng:
 * [Nhãn]
 * - dòng 1
 * - dòng 2
 */
export function formatFilmPromptBracketBlock(
  label: string,
  value?: string | null
): string {
  let raw = String(value || "").trim();
  if (!raw || /^none$/i.test(raw)) return "";
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tagRe = new RegExp(`^\\[${escaped}\\]\\s*`, "i");
  raw = raw.replace(tagRe, "");
  const lines = raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s+/, "").trim())
    .map((line) => line.replace(tagRe, "").trim())
    .filter((line) => line && !/^none$/i.test(line));
  if (!lines.length) return "";
  return [`[${label}]`, ...lines.map((line) => `- ${line}`)].join("\n");
}

/** Thay khối [Nhãn] (hoặc dòng "Nhãn: ...") trong prompt đã ghép / sửa tay. */
export function replaceFilmPromptBracketBlock(
  prompt: string,
  label: string,
  value?: string | null
): string {
  const text = String(prompt || "");
  const nextBlock = formatFilmPromptBracketBlock(label, value);
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockRe = new RegExp(`\\[${escaped}\\](?:\\n- [^\\n]*)*`, "i");
  const legacyRe = new RegExp(`^${escaped}:\\s*.*$`, "im");

  if (blockRe.test(text)) {
    if (!nextBlock) {
      return text.replace(blockRe, "").replace(/\n{3,}/g, "\n\n").trim();
    }
    return text.replace(blockRe, nextBlock);
  }
  if (legacyRe.test(text)) {
    if (!nextBlock) {
      return text.replace(legacyRe, "").replace(/\n{3,}/g, "\n\n").trim();
    }
    return text.replace(legacyRe, nextBlock);
  }
  if (!nextBlock) return text.trim();
  if (!text.trim()) return nextBlock;
  return `${nextBlock}\n\n${text.trim()}`;
}

export function syncFilmPromptShotStructure(
  prompt: string,
  scene: Pick<FilmSceneRecord, "shotSize" | "cameraAngle" | "cameraMovement">,
  labels: Array<"Cỡ cảnh" | "Góc máy" | "Lia máy">
): string {
  let next = String(prompt || "");
  if (labels.includes("Cỡ cảnh")) {
    next = replaceFilmPromptBracketBlock(next, "Cỡ cảnh", scene.shotSize);
  }
  if (labels.includes("Góc máy")) {
    next = replaceFilmPromptBracketBlock(next, "Góc máy", scene.cameraAngle);
  }
  if (labels.includes("Lia máy")) {
    next = replaceFilmPromptBracketBlock(next, "Lia máy", scene.cameraMovement);
  }
  return next;
}

/**
 * Gắn field scene → Prompt ảnh.
 * Thứ tự: Cỡ cảnh → Góc máy → [Hành động] → [Hình ảnh] → [Không khí] → (suffix Setting).
 * Ba field ngữ nghĩa là 3 khối riêng, không gộp.
 */
export function buildFilmSceneImagePrompt(
  scene: FilmSceneImagePromptSource,
  globalStyle?: string | null
): string {
  const parts: string[] = [];

  const shotSizeBlock = formatFilmPromptBracketBlock("Cỡ cảnh", scene.shotSize);
  const cameraAngleBlock = formatFilmPromptBracketBlock("Góc máy", scene.cameraAngle);
  const style = String(globalStyle || "").trim();

  if (shotSizeBlock) parts.push(shotSizeBlock);
  if (cameraAngleBlock) parts.push(cameraAngleBlock);

  const actionBlock = formatFilmPromptBracketBlock(
    "Hành động nhân vật",
    scene.action
  );
  const visualBlock = formatFilmPromptBracketBlock(
    "Hình ảnh cảnh quay",
    scene.visualDescription
  );
  const atmosphereBlock = formatFilmPromptBracketBlock(
    "Không khí cảnh",
    scene.atmosphere
  );
  if (actionBlock) parts.push(actionBlock);
  if (visualBlock) parts.push(visualBlock);
  if (atmosphereBlock) parts.push(atmosphereBlock);
  if (style) parts.push(style);

  if (parts.length) return appendFilmSingleFrameImageConstraint(parts.join("\n\n"));

  const summary = String(scene.summary || "").trim();
  if (summary) return summary;

  return "";
}

/** Có field nguồn để ghép prompt (không chỉ fallback summary rỗng). */
export function sceneHasImagePromptSources(scene: FilmSceneImagePromptSource): boolean {
  return Boolean(
    String(scene.shotSize || "").trim() ||
      String(scene.cameraAngle || "").trim() ||
      String(scene.visualDescription || "").trim() ||
      String(scene.atmosphere || "").trim() ||
      String(scene.action || "").trim()
  );
}

/** Prompt hiển thị / lưu: ưu tiên ghép từ field; fallback imagePrompt cũ. */
export function resolveFilmSceneImagePrompt(
  scene: FilmSceneRecord,
  globalStyle?: string | null
): string {
  const built = buildFilmSceneImagePrompt(scene, globalStyle);
  if (built) return built;
  return String(scene.imagePrompt || "").trim();
}

/** Ghi imagePrompt đã ghép vào scene (giữ field khác). */
export function withBuiltSceneImagePrompt<T extends FilmSceneRecord>(
  scene: T,
  globalStyle?: string | null
): T {
  if (scene.imagePromptCustom) return scene;
  const imagePrompt = resolveFilmSceneImagePrompt(scene, globalStyle);
  if ((scene.imagePrompt || "") === imagePrompt) return scene;
  return {
    ...scene,
    imagePrompt,
  };
}

/**
 * Đồng bộ imagePrompt cho list scene (load / mở tab).
 * Cập nhật khi field nguồn có dữ liệu và prompt hiện tại khác bản ghép.
 */
export function hydrateScenesImagePrompts(
  scenes: FilmSceneRecord[],
  globalStyle?: string | null
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((s) => {
    if (s.imagePromptCustom) return s;
    if (!sceneHasImagePromptSources(s) && !String(globalStyle || "").trim()) {
      return s;
    }
    const imagePrompt = resolveFilmSceneImagePrompt(s, globalStyle);
    if (!imagePrompt || (s.imagePrompt || "") === imagePrompt) return s;
    const synced: FilmSceneRecord = {
      ...s,
      imagePrompt,
      updatedAt: new Date().toISOString(),
    };
    changed.push(synced);
    return synced;
  });
  return { scenes: next, changed };
}
