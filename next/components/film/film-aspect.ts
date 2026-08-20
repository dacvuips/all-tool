/**
 * Aspect ratio film:
 * - Character / Prop: luôn 16:9 (sheet asset)
 * - Ảnh cảnh / shot / video: theo project (create dialog / settings project)
 */
import type { FilmAspectRatio } from "./film-types";

/** Ảnh nhân vật & vật phẩm — cố định landscape sheet */
export const FILM_CHARACTER_PROP_ASPECT_RATIO: FilmAspectRatio = "16:9";

/** Chuẩn hoá aspect project (default 16:9) */
export function resolveFilmProjectAspectRatio(
  aspectRatio?: FilmAspectRatio | string | null
): FilmAspectRatio {
  return aspectRatio === "9:16" ? "9:16" : "16:9";
}
