/**
 * Client API: gợi ý 10 vật phẩm kèm (Vật phẩm / Bối cảnh).
 * Chỉ gửi field; prompt ghép trên backend.
 */
import { type FilmAiProvider } from "../film-ai-keys";

export type FilmSuggestEntityKind = "prop" | "location";

export type FilmSuggestEntityPropItem = {
  name: string;
  description: string;
};

export type FilmSuggestEntityPropsResult = {
  props: FilmSuggestEntityPropItem[];
  provider: FilmAiProvider;
  model: string;
  language: string;
  entityKind: FilmSuggestEntityKind;
  entityName: string;
};

export async function suggestFilmEntityProps(params: {
  entityKind: FilmSuggestEntityKind;
  projectName: string;
  originalContent: string;
  entityName: string;
  entityMeta?: string;
  entityDescription?: string;
  language?: string;
}): Promise<FilmSuggestEntityPropsResult> {
  const entityName = String(params.entityName || "").trim();
  if (!entityName) throw new Error("Thiếu tên");

  const language = String(params.language || "Vietnamese").trim() || "Vietnamese";

  const res = await fetch("/api/app/film/suggest-entity-props/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      entityKind: params.entityKind,
      projectName: params.projectName,
      originalContent: params.originalContent,
      entityName,
      entityMeta: params.entityMeta,
      entityDescription: params.entityDescription,
      language,
    }),
  });

  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Gợi ý vật phẩm thất bại (${res.status})`);
  }

  const data = body?.data || {};
  const propsRaw = Array.isArray(data.props) ? data.props : [];
  const props: FilmSuggestEntityPropItem[] = propsRaw
    .map((p: any) => ({
      name: String(p?.name || "").trim(),
      description: String(p?.description || "").trim(),
    }))
    .filter((p: FilmSuggestEntityPropItem) => p.name);

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
    entityKind: params.entityKind,
    entityName: String(data.entityName || entityName),
  };
}
