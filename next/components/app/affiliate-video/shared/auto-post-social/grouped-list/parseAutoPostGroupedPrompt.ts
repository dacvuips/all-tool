import { uid } from "../../../constants";
import { ElementAnalysisData, ElementScene } from "../../../constants";
import { ensureTabSceneLists } from "../../script-tab-scenes";
import { ServiceImageEnum } from "../../../elements/constants";
import {
  applyFieldsToAllPlatforms,
  createEmptySocialPostFields,
  createSocialPostGroup,
  isSocialPostHeaderLine,
  normalizeSocialPostFields,
  normalizeSocialPostPublish,
  parseSocialPostHeaderLine,
  SocialPostGroup,
} from "./types";

export interface GroupedPromptParseResult {
  scenes: ElementScene[];
  groups: SocialPostGroup[];
}

function normalizeSceneLine(line: string): string {
  return line.replace(/^\d+\.\s*/, "").trim();
}

/**
 * Parse prompt dạng:
 * **Tiêu đề|Mô tả|Hashtag|Link**
 * prompt1
 * prompt2
 * **title|desc|#tag|url**
 * prompt3
 *
 * Prompt đứng trước header MXH đầu tiên → bỏ qua (không gắn nhóm / không tạo scene).
 */
export function parseAutoPostGroupedPrompt(prompt: string): GroupedPromptParseResult {
  const trimmed = prompt.trim();
  if (!trimmed) return { scenes: [], groups: [] };

  const lines = trimmed.split(/\r?\n/);
  const groups: SocialPostGroup[] = [];
  let currentGroup: SocialPostGroup | null = null;
  const scenes: ElementScene[] = [];

  const startGroup = (headerFields?: ReturnType<typeof parseSocialPostHeaderLine>) => {
    const group = createSocialPostGroup();
    if (headerFields) {
      group.platforms = applyFieldsToAllPlatforms(headerFields);
    }
    groups.push(group);
    currentGroup = group;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isSocialPostHeaderLine(line)) {
      startGroup(parseSocialPostHeaderLine(line));
      continue;
    }

    // Chưa gặp **Tiêu đề|Mô tả|Hashtag|Link** → không gắn prompt
    if (!currentGroup) continue;

    const text = normalizeSceneLine(line);
    if (!text) continue;

    const scene: ElementScene = {
      id: uid(),
      timestamp: "",
      scene_type: "OBJECT",
      sceneNumber: scenes.length + 1,
      visual_prompt: text,
      motion_description: "",
      audio_description: "",
      original_content: "",
      translated_content: null,
      socialPostGroupId: currentGroup.id,
    };
    scenes.push(scene);
    currentGroup.sceneIds.push(scene.id);
  }

  // Bỏ nhóm không có prompt nào
  const nonEmptyGroups = groups.filter((g) => g.sceneIds.length > 0);
  return { scenes, groups: nonEmptyGroups };
}

export function buildAnalysisDataFromGroupedPrompt(
  prompt: string,
  aspectRatio?: string,
  artStyleId?: string,
  artStyle?: string,
  serviceImageType?: ServiceImageEnum
): (ElementAnalysisData & { socialPostGroups: SocialPostGroup[] }) | null {
  const { scenes, groups } = parseAutoPostGroupedPrompt(prompt);
  if (scenes.length === 0) return null;

  const base = ensureTabSceneLists({
    scenes,
    aspectRatio,
    artStyleId,
    artStyle,
    serviceImageType,
  });

  return base ? { ...base, socialPostGroups: groups } : null;
}

/** Gom scene flat thành groups (fallback: 1 group chứa tất cả). */
export function buildGroupsFromScenes<
  TScene extends { id: string; socialPostGroupId?: string },
>(scenes: TScene[], existingGroups?: SocialPostGroup[]): SocialPostGroup[] {
  if (existingGroups?.length) {
    const sceneIds = new Set(scenes.map((s) => s.id));
    return existingGroups.map((g) => ({
      ...g,
      platforms: {
        youtube: normalizeSocialPostFields(g.platforms?.youtube),
        facebook: normalizeSocialPostFields(g.platforms?.facebook),
        tiktok: normalizeSocialPostFields(g.platforms?.tiktok),
      },
      publish: normalizeSocialPostPublish(g.publish),
      sceneIds: g.sceneIds.filter((id) => sceneIds.has(id)),
    }));
  }

  const byGroupId = new Map<string, TScene[]>();
  for (const scene of scenes) {
    const gid = scene.socialPostGroupId || "__default__";
    if (!byGroupId.has(gid)) byGroupId.set(gid, []);
    byGroupId.get(gid)!.push(scene);
  }

  return Array.from(byGroupId.entries()).map(([gid, groupScenes]) => {
    const existing = existingGroups?.find((g) => g.id === gid);
    return {
      id: gid === "__default__" ? createSocialPostGroup().id : gid,
      platforms: existing?.platforms ?? applyFieldsToAllPlatforms(createEmptySocialPostFields()),
      publish: normalizeSocialPostPublish(existing?.publish),
      sceneIds: groupScenes.map((s) => s.id),
    };
  });
}

export function syncScenesWithGroups(
  scenes: ElementScene[],
  groups: SocialPostGroup[]
): ElementScene[] {
  const groupByScene = new Map<string, string>();
  for (const g of groups) {
    for (const sid of g.sceneIds) {
      groupByScene.set(sid, g.id);
    }
  }
  return scenes.map((s) => ({
    ...s,
    socialPostGroupId: groupByScene.get(s.id) ?? s.socialPostGroupId,
  }));
}

export function reorderGroupsAfterSceneListChange(
  scenes: ElementScene[],
  groups: SocialPostGroup[]
): SocialPostGroup[] {
  const sceneIdSet = new Set(scenes.map((s) => s.id));
  const orderedIds = scenes.map((s) => s.id);

  const updated = groups.map((g) => ({
    ...g,
    sceneIds: orderedIds.filter((id) => g.sceneIds.includes(id) && sceneIdSet.has(id)),
  }));

  const assigned = new Set(updated.flatMap((g) => g.sceneIds));
  const orphanIds = orderedIds.filter((id) => !assigned.has(id));
  if (orphanIds.length === 0) return updated;

  const orphanGroup = createSocialPostGroup(undefined, orphanIds);
  return [...updated, orphanGroup];
}
