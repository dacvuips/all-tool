import { ElementAnalysisData, ElementScene, uid, type AspectRatio } from "../../constants";
import { ServiceImageEnum } from "../constants";
import { ensureTabSceneLists } from "../../shared/script-tab-scenes";
import { isAspectRatio } from "../../shared/aspect-ratio-utils";

/** Một dòng prompt = một phân cảnh. */
export interface NumberedPromptItem {
  number: number;
  text: string;
}

/** Bỏ tiền tố "1. " / "2. " ở đầu dòng nếu có (tùy chọn, không bắt buộc). */
function normalizeSceneLine(line: string): string {
  return line.replace(/^\d+\.\s*/, "").trim();
}

/**
 * Tách prompt: mỗi dòng xuống hàng (Enter) = 1 phân cảnh.
 * Dòng trống bỏ qua. "1. mô tả" trên một dòng vẫn là 1 cảnh (bỏ số nếu có).
 */
export function parseNumberedPrompt(prompt: string): NumberedPromptItem[] {
  const trimmed = prompt.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => normalizeSceneLine(line.trim()))
    .filter(Boolean);

  return lines.map((text, index) => ({ number: index + 1, text }));
}

/** Chuyển danh sách prompt thành dữ liệu phân tích (scenes). */
export function buildAnalysisDataFromNumberedPrompt(
  prompt: string,
  aspectRatio?: string,
  artStyleId?: string,
  artStyle?: string,
  serviceImageType?: ServiceImageEnum
): ElementAnalysisData | null {
  const items = parseNumberedPrompt(prompt);
  if (items.length === 0) return null;

  const scenes: ElementScene[] = items.map((item, index) => ({
    id: uid(),
    timestamp: "",
    scene_type: "OBJECT" as const,
    sceneNumber: index + 1,
    visual_prompt: item.text,
    motion_description: "",
    audio_description: "",
    original_content: "",
    translated_content: null,
  }));

  return ensureTabSceneLists({
    scenes,
    aspectRatio: isAspectRatio(String(aspectRatio ?? ""))
      ? (aspectRatio as AspectRatio)
      : undefined,
    artStyleId,
    artStyle,
    serviceImageType,
  });
}
