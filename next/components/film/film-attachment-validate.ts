/**
 * Validate gắn nhân vật / vật phẩm / bối cảnh trước khi tạo ảnh cảnh quay hoặc video.
 * - Gắn Cảnh bắt buộc (≥1) và có ảnh
 * - Tổng NV + Vật phẩm + Cảnh ≤ 10
 * - Item đã gắn phải tồn tại + có ảnh
 */
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import type {
  FilmCharacterRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
} from "./film-types";
import {
  filmCharacterLinkedToEpisode,
  filmLocationLinkedToEpisode,
  filmPropLinkedToEpisode,
} from "./film-types";

/** Tổng ảnh tham chiếu gắn trên 1 cảnh quay (NV + vật phẩm + bối cảnh) */
export const FILM_SCENE_ATTACH_IMAGE_LIMIT = 10;

export type FilmAttachEntity = {
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
};

export function filmAttachEntityHasImage(entity: FilmAttachEntity | null | undefined): boolean {
  if (!entity) return false;
  return !!getFilmEntityImageSrc(entity);
}

function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Tìm NV theo tên. Khi có `episodeId` chỉ khớp bản đã gắn thẻ tập đó.
 */
export function findFilmCharacterByName(
  characters: FilmCharacterRecord[],
  name: string,
  episodeId?: string | null
): FilmCharacterRecord | undefined {
  const k = nameKey(name);
  if (!k) return undefined;
  const matches = characters.filter((c) => nameKey(c.name) === k);
  if (!matches.length) return undefined;
  if (episodeId) {
    return matches.find((c) => filmCharacterLinkedToEpisode(c, episodeId));
  }
  return matches[0];
}

export function findFilmPropByName(
  props: FilmPropRecord[],
  name: string,
  episodeId?: string | null
): FilmPropRecord | undefined {
  const k = nameKey(name);
  if (!k) return undefined;
  const matches = props.filter((p) => nameKey(p.name) === k);
  if (!matches.length) return undefined;
  if (episodeId) {
    return matches.find((p) => filmPropLinkedToEpisode(p, episodeId));
  }
  return matches[0];
}

export function findFilmLocationByName(
  sceneImages: FilmSceneImageRecord[],
  name: string,
  episodeId?: string | null
): FilmSceneImageRecord | undefined {
  const k = nameKey(name);
  if (!k) return undefined;
  const matches = sceneImages.filter((s) => nameKey(s.name) === k);
  if (!matches.length) return undefined;
  if (episodeId) {
    return matches.find((s) => filmLocationLinkedToEpisode(s, episodeId));
  }
  return matches[0];
}

/**
 * Danh sách bối cảnh gắn trên scene (multi).
 * Fallback: locationNames → sceneTag → location (legacy single).
 */
export function getFilmSceneLocationNames(scene: FilmSceneRecord): string[] {
  const multi = (scene.locationNames || []).map((n) => n.trim()).filter(Boolean);
  if (multi.length) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of multi) {
      const k = nameKey(n);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  }
  const tag = (scene.sceneTag || "").trim();
  if (tag) return [tag];
  const loc = (scene.location || "").trim();
  if (loc) return [loc];
  return [];
}

/** Tổng số slot gắn (NV + VP + Cảnh) trên scene — Gắn Cảnh đếm tối đa 1 */
export function countFilmSceneAttachSlots(scene: FilmSceneRecord): number {
  const chars = (scene.characterNames || []).map((n) => n.trim()).filter(Boolean).length;
  const propsCount = (scene.propNames || []).map((n) => n.trim()).filter(Boolean).length;
  const locs = Math.min(1, getFilmSceneLocationNames(scene).length);
  return chars + propsCount + locs;
}

/**
 * Entity ảnh gắn trên scene cho Image API.
 * Thứ tự: Gắn Cảnh trước (tối đa 1) → Gắn Nhân vật → Gắn Vật phẩm (tổng ≤ limit).
 */
export function collectFilmSceneAttachImageEntities(
  scene: FilmSceneRecord,
  characters: FilmCharacterRecord[],
  props: FilmPropRecord[],
  sceneImages: FilmSceneImageRecord[],
  limit = FILM_SCENE_ATTACH_IMAGE_LIMIT
): Array<{
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
  label?: string;
}> {
  const entities: Array<{
    imageBlob?: Blob | null;
    imageUrl?: string;
    imageUrls?: string[];
    label?: string;
  }> = [];

  // Chỉ 1 bối cảnh
  for (const name of getFilmSceneLocationNames(scene).slice(0, 1)) {
    if (entities.length >= limit) break;
    const loc = findFilmLocationByName(sceneImages, name, scene.episodeId);
    if (loc && filmAttachEntityHasImage(loc)) {
      entities.push({
        imageBlob: loc.imageBlob,
        imageUrl: loc.imageUrl,
        imageUrls: loc.imageUrls,
        label: loc.name,
      });
    }
  }

  for (const name of scene.characterNames || []) {
    if (entities.length >= limit) break;
    const n = name.trim();
    if (!n) continue;
    const c = findFilmCharacterByName(characters, n, scene.episodeId);
    if (c && filmAttachEntityHasImage(c)) {
      entities.push({
        imageBlob: c.imageBlob,
        imageUrl: c.imageUrl,
        imageUrls: c.imageUrls,
        label: c.name,
      });
    }
  }

  for (const name of scene.propNames || []) {
    if (entities.length >= limit) break;
    const n = name.trim();
    if (!n) continue;
    const p = findFilmPropByName(props, n, scene.episodeId);
    if (p && filmAttachEntityHasImage(p)) {
      entities.push({
        imageBlob: p.imageBlob,
        imageUrl: p.imageUrl,
        imageUrls: p.imageUrls,
        label: p.name,
      });
    }
  }

  return entities;
}

/** Khớp bối cảnh chính (đầu danh sách) theo sceneTag / location / locationNames */
export function findFilmSceneLocation(
  scene: FilmSceneRecord,
  sceneImages: FilmSceneImageRecord[]
): FilmSceneImageRecord | undefined {
  for (const name of getFilmSceneLocationNames(scene)) {
    const hit = findFilmLocationByName(sceneImages, name, scene.episodeId);
    if (hit) return hit;
  }
  return undefined;
}

export type FilmAttachIssueKind = "character" | "prop" | "location";

export type FilmSceneAttachIssue = {
  kind: FilmAttachIssueKind;
  name: string;
  id?: string;
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
  reason: "missing_entity" | "missing_image";
};

/**
 * Item đã gắn trên phân cảnh nhưng chưa có entity / chưa có ảnh.
 */
export function listFilmSceneAttachIssues(
  scene: FilmSceneRecord,
  characters: FilmCharacterRecord[],
  props: FilmPropRecord[],
  sceneImages: FilmSceneImageRecord[]
): FilmSceneAttachIssue[] {
  const issues: FilmSceneAttachIssue[] = [];
  const episodeId = scene.episodeId;

  const pushIssue = (
    kind: FilmAttachIssueKind,
    name: string,
    entity:
      | FilmCharacterRecord
      | FilmPropRecord
      | FilmSceneImageRecord
      | undefined
  ) => {
    if (!entity) {
      issues.push({ kind, name, reason: "missing_entity" });
      return;
    }
    if (!filmAttachEntityHasImage(entity)) {
      issues.push({
        kind,
        name: entity.name || name,
        id: entity.id,
        imageBlob: entity.imageBlob,
        imageUrl: entity.imageUrl,
        imageUrls: entity.imageUrls,
        reason: "missing_image",
      });
    }
  };

  for (const name of (scene.characterNames || []).map((n) => n.trim()).filter(Boolean)) {
    pushIssue("character", name, findFilmCharacterByName(characters, name, episodeId));
  }
  for (const name of (scene.propNames || []).map((n) => n.trim()).filter(Boolean)) {
    pushIssue("prop", name, findFilmPropByName(props, name, episodeId));
  }
  for (const name of getFilmSceneLocationNames(scene)) {
    pushIssue("location", name, findFilmLocationByName(sceneImages, name, episodeId));
  }
  return issues;
}

export function isFilmAttachErrorMessage(message?: string | null): boolean {
  const msg = String(message || "");
  if (!msg) return false;
  return /không có trong project|chưa có ảnh|bỏ gắn item|Bắt buộc Gắn Cảnh|Tổng Gắn|Gắn Cảnh chỉ được/i.test(
    msg
  );
}

/** Bỏ 1 tên gắn khỏi scene (NV / VP / Cảnh). */
export function detachFilmSceneAttachName(
  scene: FilmSceneRecord,
  kind: FilmAttachIssueKind,
  name: string
): FilmSceneRecord {
  const key = name.trim().toLowerCase();
  if (!key) return scene;
  if (kind === "character") {
    return {
      ...scene,
      characterNames: (scene.characterNames || []).filter(
        (n) => n.trim().toLowerCase() !== key
      ),
      updatedAt: new Date().toISOString(),
    };
  }
  if (kind === "prop") {
    return {
      ...scene,
      propNames: (scene.propNames || []).filter((n) => n.trim().toLowerCase() !== key),
      updatedAt: new Date().toISOString(),
    };
  }
  const nextLocs = getFilmSceneLocationNames(scene).filter(
    (n) => n.trim().toLowerCase() !== key
  );
  const first = nextLocs[0] || "";
  return {
    ...scene,
    locationNames: nextLocs,
    sceneTag: first,
    location: first,
    updatedAt: new Date().toISOString(),
  };
}

export type FilmAttachmentCheckResult =
  | { ok: true; message?: undefined }
  | { ok: false; message: string };

/**
 * Kiểm tra asset gắn trên scene trước khi tạo ảnh/video cảnh quay.
 * - Gắn Cảnh: bắt buộc ≥1 và mỗi item có ảnh
 * - Tổng NV + VP + Cảnh ≤ FILM_SCENE_ATTACH_IMAGE_LIMIT
 * - NV / VP: nếu gắn thì phải có entity + ảnh
 */
export function checkFilmSceneAttachmentsForMedia(
  scene: FilmSceneRecord,
  characters: FilmCharacterRecord[],
  props: FilmPropRecord[],
  sceneImages: FilmSceneImageRecord[]
): FilmAttachmentCheckResult {
  const charNames = (scene.characterNames || []).map((n) => n.trim()).filter(Boolean);
  const propNames = (scene.propNames || []).map((n) => n.trim()).filter(Boolean);
  const locationNames = getFilmSceneLocationNames(scene);

  const total = charNames.length + propNames.length + locationNames.length;
  if (total > FILM_SCENE_ATTACH_IMAGE_LIMIT) {
    return {
      ok: false,
      message: `Tổng Gắn Nhân vật + Vật phẩm + Cảnh vượt quá ${FILM_SCENE_ATTACH_IMAGE_LIMIT} ảnh (${total}/${FILM_SCENE_ATTACH_IMAGE_LIMIT}). Bỏ bớt gắn trước khi tạo.`,
    };
  }

  if (!locationNames.length) {
    return {
      ok: false,
      message:
        "Bắt buộc Gắn Cảnh (bối cảnh) trước khi tạo ảnh/video. Mỗi cảnh quay cần đúng 1 ảnh bối cảnh.",
    };
  }
  if (locationNames.length > 1) {
    return {
      ok: false,
      message:
        "Gắn Cảnh chỉ được 1 bối cảnh (không gắn 2). Bỏ bớt trước khi tạo ảnh/video.",
    };
  }

  const missingCharImages: string[] = [];
  const unknownChars: string[] = [];
  for (const name of charNames) {
    const c = findFilmCharacterByName(characters, name, scene.episodeId);
    if (!c) {
      unknownChars.push(name);
      continue;
    }
    if (!filmAttachEntityHasImage(c)) missingCharImages.push(name);
  }

  const missingPropImages: string[] = [];
  const unknownProps: string[] = [];
  for (const name of propNames) {
    const p = findFilmPropByName(props, name, scene.episodeId);
    if (!p) {
      unknownProps.push(name);
      continue;
    }
    if (!filmAttachEntityHasImage(p)) missingPropImages.push(name);
  }

  const missingSceneImages: string[] = [];
  const unknownScenes: string[] = [];
  for (const name of locationNames) {
    const loc = findFilmLocationByName(sceneImages, name, scene.episodeId);
    if (!loc) {
      unknownScenes.push(name);
      continue;
    }
    if (!filmAttachEntityHasImage(loc)) missingSceneImages.push(name);
  }

  const parts: string[] = [];
  if (unknownChars.length) {
    parts.push(`Nhân vật không có trong project: ${unknownChars.join(", ")}`);
  }
  if (missingCharImages.length) {
    parts.push(`Nhân vật chưa có ảnh: ${missingCharImages.join(", ")}`);
  }
  if (unknownProps.length) {
    parts.push(`Vật phẩm không có trong project: ${unknownProps.join(", ")}`);
  }
  if (missingPropImages.length) {
    parts.push(`Vật phẩm chưa có ảnh: ${missingPropImages.join(", ")}`);
  }
  if (unknownScenes.length) {
    parts.push(`Bối cảnh không có trong project: ${unknownScenes.join(", ")}`);
  }
  if (missingSceneImages.length) {
    parts.push(
      `Bối cảnh chưa có ảnh: ${missingSceneImages.join(", ")} — tạo ảnh Bối cảnh trước`
    );
  }

  if (parts.length) {
    return {
      ok: false,
      message: `${parts.join(". ")}. Tạo/upload ảnh trước hoặc bỏ gắn item chưa sẵn sàng.`,
    };
  }
  return { ok: true };
}

/** Kiểm tra list nhân vật chọn (ids) đều có ảnh */
export function checkFilmCharactersHaveImages(
  characters: FilmCharacterRecord[],
  characterIds: string[]
): FilmAttachmentCheckResult {
  if (!characterIds.length) return { ok: true };
  const missing = characters
    .filter((c) => characterIds.includes(c.id) && !filmAttachEntityHasImage(c))
    .map((c) => c.name);
  if (!missing.length) return { ok: true };
  return {
    ok: false,
    message: `Nhân vật tham chiếu chưa có ảnh: ${missing.join(", ")}. Tạo ảnh nhân vật trước.`,
  };
}
