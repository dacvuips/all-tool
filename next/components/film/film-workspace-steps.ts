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
    label: "Storyboard",
  },
  {
    id: "character_images",
    section: "production",
    label: "Hình ảnh Nhân vật",
  },
  {
    id: "props",
    section: "production",
    label: "Vật phẩm",
  },
  {
    id: "scene_images",
    section: "production",
    label: "Ảnh Cảnh",
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
