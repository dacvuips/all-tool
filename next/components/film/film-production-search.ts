import type { FilmSceneRecord } from "./film-types";

export function normalizeFilmSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesFilmNameSearch(
  names: Array<string | null | undefined>,
  query: string
): boolean {
  const q = normalizeFilmSearchQuery(query);
  if (!q) return true;
  return names.some((name) => (name || "").trim().toLowerCase().includes(q));
}

export function getFilmSceneDisplayNames(scene: FilmSceneRecord): string[] {
  return [
    scene.title,
    scene.summary,
    scene.location,
    ...(scene.characterNames || []),
    ...(scene.locationNames || []),
    ...(scene.propNames || []),
    `#${scene.index}`,
    String(scene.index),
  ];
}
