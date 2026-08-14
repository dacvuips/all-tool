/**
 * Client API: viết lại prompt Ảnh Cảnh quay tránh content policy.
 * Chỉ gửi field cảnh; system/user prompt ghép trên backend.
 */
import { type FilmAiProvider } from "../film-ai-keys";

export type FilmRewriteShotFramePromptResult = {
  rewrittenPrompt: string;
  changesSummary: string;
  provider: FilmAiProvider;
  model: string;
  language: string;
};

export async function rewriteFilmShotFramePrompt(params: {
  /** Prompt ảnh đang lưu (field), không phải system prompt */
  prompt?: string;
  visualDescription?: string;
  atmosphere?: string;
  action?: string;
  shotSize?: string;
  cameraAngle?: string;
  summary?: string;
  storyboardImagePrompt?: string;
  errorMessage?: string;
  sceneTitle?: string;
  characterNames?: string[];
  propNames?: string[];
  locationNames?: string[];
  language?: string;
}): Promise<FilmRewriteShotFramePromptResult> {
  const language = String(params.language || "Vietnamese").trim() || "Vietnamese";

  const res = await fetch("/api/app/film/rewrite-shot-frame-prompt/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      visualDescription: params.visualDescription,
      atmosphere: params.atmosphere,
      action: params.action,
      shotSize: params.shotSize,
      cameraAngle: params.cameraAngle,
      summary: params.summary,
      storyboardImagePrompt: params.storyboardImagePrompt,
      errorMessage: params.errorMessage,
      sceneTitle: params.sceneTitle,
      characterNames: params.characterNames || [],
      propNames: params.propNames || [],
      locationNames: params.locationNames || [],
      language,
    }),
  });

  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Gợi ý prompt thất bại (${res.status})`);
  }

  const data = body?.data || {};
  const rewrittenPrompt = String(data.rewrittenPrompt || "").trim();
  if (!rewrittenPrompt) throw new Error("AI không trả về prompt đã viết lại");

  const providerRaw = String(data.provider || "");
  const provider: FilmAiProvider =
    providerRaw === "gemini"
      ? "gemini"
      : providerRaw === "gateway"
        ? "gateway"
        : "openai";

  return {
    rewrittenPrompt,
    changesSummary: String(data.changesSummary || "").trim(),
    provider,
    model: String(data.model || ""),
    language: String(data.language || language),
  };
}
