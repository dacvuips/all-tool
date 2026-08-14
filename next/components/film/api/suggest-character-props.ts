/**
 * Client API: gợi ý 10 vật phẩm trên người nhân vật.
 * Chỉ gửi field; prompt ghép trên backend.
 */
import { type FilmAiProvider } from "../film-ai-keys";

export type FilmSuggestCharacterPropItem = {
  name: string;
  description: string;
};

export type FilmSuggestCharacterPropsResult = {
  props: FilmSuggestCharacterPropItem[];
  provider: FilmAiProvider;
  model: string;
  language: string;
  characterName: string;
};

export async function suggestFilmCharacterProps(params: {
  projectName: string;
  originalContent: string;
  characterName: string;
  characterRole?: string;
  characterDescription?: string;
  clothingAccessories?: string;
  language?: string;
}): Promise<FilmSuggestCharacterPropsResult> {
  const characterName = String(params.characterName || "").trim();
  if (!characterName) throw new Error("Thiếu tên nhân vật");

  const language = String(params.language || "Vietnamese").trim() || "Vietnamese";

  const res = await fetch("/api/app/film/suggest-character-props/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectName: params.projectName,
      originalContent: params.originalContent,
      characterName,
      characterRole: params.characterRole,
      characterDescription: params.characterDescription,
      clothingAccessories: params.clothingAccessories,
      language,
    }),
  });

  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Gợi ý vật phẩm thất bại (${res.status})`);
  }

  const data = body?.data || {};
  const propsRaw = Array.isArray(data.props) ? data.props : [];
  const props: FilmSuggestCharacterPropItem[] = propsRaw
    .map((p: any) => ({
      name: String(p?.name || "").trim(),
      description: String(p?.description || "").trim(),
    }))
    .filter((p: FilmSuggestCharacterPropItem) => p.name);

  if (!props.length) throw new Error("AI không trả về vật phẩm");

  const providerRaw = String(data.provider || "");
  const provider: FilmAiProvider =
    providerRaw === "gemini"
      ? "gemini"
      : providerRaw === "gateway"
        ? "gateway"
        : "openai";

  return {
    props,
    provider,
    model: String(data.model || ""),
    language: String(data.language || language),
    characterName: String(data.characterName || characterName),
  };
}
