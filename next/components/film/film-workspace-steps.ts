import {
  FilmWorkspaceStep,
  FilmWorkspaceStepId,
} from "./film-types";

export const FILM_WORKSPACE_STEPS: FilmWorkspaceStep[] = [
  {
    id: "original_content",
    section: "script",
    label: "Nội dung gốc",
    stepNo: "01",
  },
  {
    id: "storyboard",
    section: "script",
    label: "Chuỗi Cảnh quay",
  },
  {
    id: "character_images",
    section: "production",
    label: "Nhân vật",
  },
  {
    id: "props",
    section: "production",
    label: "Vật phẩm",
  },
  {
    id: "scene_images",
    section: "production",
    label: "Bối cảnh",
  },
  {
    id: "voice",
    section: "production",
    label: "Tạo Giọng",
  },
  {
    id: "shot_images",
    section: "production",
    label: "Ảnh Cảnh quay",
  },
  {
    id: "create_video",
    section: "production",
    label: "Tạo video",
  },
  {
    id: "studio",
    section: "production",
    label: "Studio",
  },
  {
    id: "settings",
    section: "settings",
    label: "Setting",
  },
];

/** Các bước production tính tiến độ (0/5) */
export const FILM_PRODUCTION_PROGRESS_STEPS: FilmWorkspaceStepId[] = [
  "character_images",
  "props",
  "scene_images",
  "voice",
  "shot_images",
  "create_video",
];

export const FILM_PRODUCTION_PROGRESS_TOTAL = FILM_PRODUCTION_PROGRESS_STEPS.length;

/** Query param sidebar workspace (`?step=scene_images`) */
export const FILM_STEP_QUERY_KEY = "step";

export function parseFilmWorkspaceStepId(value: unknown): FilmWorkspaceStepId | null {
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || !id.trim()) return null;
  return FILM_WORKSPACE_STEPS.some((item) => item.id === id)
    ? (id as FilmWorkspaceStepId)
    : null;
}

export function filmStepFromLocation(): FilmWorkspaceStepId | null {
  if (typeof window === "undefined") return null;
  return parseFilmWorkspaceStepId(
    new URLSearchParams(window.location.search).get(FILM_STEP_QUERY_KEY)
  );
}
