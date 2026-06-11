import { ElementAnalysisData, ElementScene, uid } from "../../constants";
import { ServiceImageEnum } from "../constants";
import { ensureTabSceneLists } from "../../shared/script-tab-scenes";

/** Một dòng prompt đã tách theo số thứ tự (1., 2., …) */
export interface NumberedPromptItem {
  number: number;
  text: string;
}

/**
 * Tách textarea prompt thành các mục theo đầu dòng "N. ".
 * Nội dung một cảnh có thể xuống dòng; cảnh mới bắt đầu khi gặp dòng "N+1.".
 */
export function parseNumberedPrompt(prompt: string): NumberedPromptItem[] {
  const trimmed = prompt.trim();
  if (!trimmed) return [];

  const regex = /(?:^|\n)\s*(\d+)\.\s*/g;
  const matches = Array.from(trimmed.matchAll(regex));

  if (matches.length === 0) {
    return [{ number: 1, text: trimmed }];
  }

  const items: NumberedPromptItem[] = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = match.index! + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : trimmed.length;
    const text = trimmed.slice(start, end).trim();
    if (text) {
      items.push({ number: parseInt(match[1], 10), text });
    }
  }
  return items;
}

/** Chuyển danh sách prompt đánh số thành dữ liệu phân tích copy-video (scenes). */
export function buildAnalysisDataFromNumberedPrompt(
  prompt: string,
  aspectRatio?: string,
  artStyleId?: string,
  artStyle?: string,
  serviceImageType?: ServiceImageEnum
): ElementAnalysisData | null {
  const items = parseNumberedPrompt(prompt);
  if (items.length === 0) return null;

  const scenes: ElementScene[] = items.map((item) => ({
    id: uid(),
    timestamp: "",
    scene_type: "OBJECT" as const,
    sceneNumber: item.number,
    visual_prompt: item.text,
    motion_description: "",
    audio_description: "",
    original_content: "",
    translated_content: null,
  }));

  return ensureTabSceneLists({
    scenes,
    aspectRatio,
    artStyleId,
    artStyle,
    serviceImageType,
  });
}
