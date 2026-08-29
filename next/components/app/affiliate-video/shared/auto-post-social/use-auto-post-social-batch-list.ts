import { useCallback, useMemo } from "react";
import {
  buildGroupsFromScenes,
  SocialPostGroup,
} from "./grouped-list";
import { SOCIAL_PLATFORMS, SocialPlatform } from "./types";
import { useAutoPostSocialSettings } from "./use-auto-post-social-settings";

export interface UseAutoPostSocialBatchListOptions<
  TScene extends { id: string; socialPostGroupId?: string },
> {
  scenes: TScene[];
  /** Nhóm đã lưu (scriptData / IndexedDB). Nếu thiếu sẽ tự gom từ scenes. */
  socialPostGroups?: SocialPostGroup[];
  onSocialPostGroupsChange?: (groups: SocialPostGroup[]) => void;
}

/**
 * Hook dùng chung cho mọi SharedBatchListPanel / tab batch.
 * Khi bật "Tự động đăng MXH" → trả về config để render AutoPostSocialGroupedList.
 */
export function useAutoPostSocialBatchList<
  TScene extends { id: string; socialPostGroupId?: string },
>({
  scenes,
  socialPostGroups,
  onSocialPostGroupsChange,
}: UseAutoPostSocialBatchListOptions<TScene>) {
  const { settings, hydrated } = useAutoPostSocialSettings();

  const enabled = hydrated && settings.enabled;

  const enabledPlatforms = useMemo(
    () => SOCIAL_PLATFORMS.filter((p) => settings.platforms[p.id]?.enabled).map((p) => p.id),
    [settings.platforms]
  ) as SocialPlatform[];

  const groups = useMemo(
    () => buildGroupsFromScenes(scenes, socialPostGroups),
    [scenes, socialPostGroups]
  );

  const onGroupsChange = useCallback(
    (next: SocialPostGroup[]) => {
      onSocialPostGroupsChange?.(next);
    },
    [onSocialPostGroupsChange]
  );

  const listConfig = useMemo(() => {
    if (!enabled) return null;
    return {
      enabled: true as const,
      groups,
      enabledPlatforms,
      onGroupsChange,
    };
  }, [enabled, groups, enabledPlatforms, onGroupsChange]);

  return { enabled, groups, enabledPlatforms, listConfig };
}
