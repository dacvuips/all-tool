/**
 * Ẩn/hiện phân cảnh trong từng bài đăng MXH.
 * Global toggle trên toolbar + override từng nhóm.
 */
import { useSyncExternalStore } from "react";

interface SocialPostScenesCollapseState {
  /** Mặc định cho mọi nhóm khi chưa có override */
  allExpanded: boolean;
  /** groupId → expanded (ghi đè allExpanded) */
  groupOverrides: Record<string, boolean>;
}

const EMPTY: SocialPostScenesCollapseState = {
  allExpanded: true,
  groupOverrides: {},
};

let state: SocialPostScenesCollapseState = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSocialPostScenesCollapseState(): SocialPostScenesCollapseState {
  return state;
}

export function isSocialPostGroupScenesExpanded(groupId: string): boolean {
  const override = state.groupOverrides[groupId];
  if (override !== undefined) return override;
  return state.allExpanded;
}

export function isAnySocialPostGroupScenesExpanded(groupIds: string[]): boolean {
  return groupIds.some((id) => isSocialPostGroupScenesExpanded(id));
}

export function setAllSocialPostScenesExpanded(expanded: boolean) {
  state = { allExpanded: expanded, groupOverrides: {} };
  emit();
}

export function toggleAllSocialPostScenesExpanded() {
  setAllSocialPostScenesExpanded(!state.allExpanded);
}

export function toggleSocialPostGroupScenesExpanded(groupId: string) {
  const next = !isSocialPostGroupScenesExpanded(groupId);
  state = {
    ...state,
    groupOverrides: { ...state.groupOverrides, [groupId]: next },
  };
  emit();
}

export function subscribeSocialPostScenesCollapse(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSocialPostScenesCollapseState(): SocialPostScenesCollapseState {
  return useSyncExternalStore(
    subscribeSocialPostScenesCollapse,
    getSocialPostScenesCollapseState,
    getSocialPostScenesCollapseState
  );
}

export function useSocialPostGroupScenesExpanded(groupId: string): boolean {
  const s = useSocialPostScenesCollapseState();
  const override = s.groupOverrides[groupId];
  if (override !== undefined) return override;
  return s.allExpanded;
}
