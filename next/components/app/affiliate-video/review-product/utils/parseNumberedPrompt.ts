import { uid } from "../../constants";
import { ReviewAnalysisData, ReviewScene } from "../constants";

export interface NumberedPromptItem {
  number: number;
  text: string;
}

function normalizeSceneLine(line: string): string {
  return line.replace(/^\d+\.\s*/, "").trim();
}

/** Mỗi dòng xuống hàng = 1 phân cảnh. */
export function parseNumberedPrompt(prompt: string): NumberedPromptItem[] {
  const trimmed = prompt.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => normalizeSceneLine(line.trim()))
    .filter(Boolean);

  return lines.map((text, index) => ({ number: index + 1, text }));
}

export function buildAnalysisDataFromNumberedPrompt(
  prompt: string,
  aspectRatio?: string,
  artStyleId?: string,
  artStyle?: string
): ReviewAnalysisData | null {
  const items = parseNumberedPrompt(prompt);
  if (items.length === 0) return null;

  const scenes: ReviewScene[] = items.map((item, index) => ({
    id: uid(),
    sceneNumber: index + 1,
    camera: "",
    topicTitle: "",
    visualPrompt: item.text,
    imageGenPrompt: item.text,
    motionPrompt: "",
    dialogue: "",
    audio: "",
  }));

  return {
    scenes,
    aspectRatio,
    artStyleId,
    artStyle,
  };
}
