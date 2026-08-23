/**
 * Shared film job payload markers — phân biệt với affiliate / API Media.
 * Dùng trên Redis payload + metadata Mongo để filter/debug job.
 */

/** Loại asset film gắn với job generate */
export type FilmMediaAssetKind =
  | "character"
  | "prop"
  | "scene_location"
  | "shot_frame"
  | "shot_video";

/** Context film luôn gửi kèm payload (và/hoặc metadata) */
export type FilmJobContext = {
  /** Nguồn job — luôn "film" */
  filmSource: "film";
  filmProjectId?: string;
  filmEpisodeId?: string;
  filmSceneId?: string;
  filmCharacterId?: string;
  filmPropId?: string;
  filmSceneImageId?: string;
  filmAssetKind?: FilmMediaAssetKind;
};

export function buildFilmJobMetadata(
  ctx: Partial<FilmJobContext> & { filmAssetKind?: FilmMediaAssetKind }
): Record<string, unknown> {
  return {
    filmSource: "film",
    filmProjectId: ctx.filmProjectId || null,
    filmEpisodeId: ctx.filmEpisodeId || null,
    filmSceneId: ctx.filmSceneId || null,
    filmCharacterId: ctx.filmCharacterId || null,
    filmPropId: ctx.filmPropId || null,
    filmSceneImageId: ctx.filmSceneImageId || null,
    filmAssetKind: ctx.filmAssetKind || null,
  };
}

/**
 * Khối art style đặt Ở ĐẦU prompt Film (ảnh / video).
 * Không có prompt (không chọn / ID không tìm thấy) → trả chuỗi gốc.
 */
export function prependFilmArtStyleToPrompt(
  basePrompt: string,
  artStylePrompt?: string | null
): string {
  const prompt = String(basePrompt || "").trim();
  const style = String(artStylePrompt || "").trim();
  if (!style) return prompt;

  const artStyleBlock = [
    "Art style (mandatory — apply first):",
    "Strictly follow this art style for the entire output. Keep the look consistent; do not mix other styles.",
    "",
    "Art style:",
    style,
  ].join("\n");

  return prompt ? `${artStyleBlock}\n\n${prompt}` : artStyleBlock;
}
