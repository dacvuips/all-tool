/**
 * Shared run state for auto-post MXH (Play pipeline).
 * Action bar + group rows subscribe without prop drilling.
 */
import { useSyncExternalStore } from "react";

export type AutoPostGroupPhase =
  | "idle"
  | "generating"
  | "merging"
  | "uploading"
  | "done"
  | "error"
  | "stopped";

export interface AutoPostGroupRunInfo {
  status: AutoPostGroupPhase;
  message?: string;
  /** Object URL — video đã nối (≥2 cảnh) để preview trên UI */
  mergedVideoUrl?: string;
  youtubeUrl?: string;
}

export interface AutoPostRunState {
  running: boolean;
  currentGroupId: string | null;
  currentGroupIndex: number;
  statusLabel: string;
  groups: Record<string, AutoPostGroupRunInfo>;
  /** Batch khác đang chiếm (ảnh/video) — chặn Play từng bài */
  playBlocked: boolean;
}

export interface AutoPostRunnerActions {
  startAll: () => void;
  startGroup: (groupId: string) => void;
  /** Dừng toàn bộ pipeline (toolbar). */
  stop: () => void;
  /** Dừng một bài đăng — batch hàng loạt vẫn chạy các bài khác. */
  stopGroup: (groupId: string) => void;
}

/** Bài đăng bị dừng riêng lẻ trong lúc chạy hàng loạt. */
const stoppedGroupIds = new Set<string>();

export function clearAutoPostStoppedGroups(): void {
  stoppedGroupIds.clear();
}

export function markAutoPostGroupStopped(groupId: string): void {
  stoppedGroupIds.add(groupId);
}

export function clearAutoPostGroupStopped(groupId: string): void {
  stoppedGroupIds.delete(groupId);
}

export function isAutoPostGroupStopped(groupId: string): boolean {
  return stoppedGroupIds.has(groupId);
}

const EMPTY: AutoPostRunState = {
  running: false,
  currentGroupId: null,
  currentGroupIndex: -1,
  statusLabel: "",
  groups: {},
  playBlocked: false,
};

let state: AutoPostRunState = EMPTY;
let runnerActions: AutoPostRunnerActions | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getAutoPostRunState(): AutoPostRunState {
  return state;
}

export function getAutoPostRunnerActions(): AutoPostRunnerActions | null {
  return runnerActions;
}

export function setAutoPostRunnerActions(actions: AutoPostRunnerActions | null) {
  runnerActions = actions;
  emit();
}

export function resetAutoPostRunState(keepMergedUrls = false) {
  stoppedGroupIds.clear();
  if (!keepMergedUrls) {
    Object.values(state.groups).forEach((g) => {
      if (g.mergedVideoUrl) URL.revokeObjectURL(g.mergedVideoUrl);
    });
  }
  state = {
    ...EMPTY,
    playBlocked: state.playBlocked,
    groups: keepMergedUrls ? state.groups : {},
  };
  emit();
}

export function patchAutoPostRunState(patch: Partial<AutoPostRunState>) {
  state = { ...state, ...patch };
  emit();
}

export function setAutoPostGroupInfo(groupId: string, patch: Partial<AutoPostGroupRunInfo>) {
  const prev = state.groups[groupId] || { status: "idle" as const };
  if (patch.mergedVideoUrl && prev.mergedVideoUrl && patch.mergedVideoUrl !== prev.mergedVideoUrl) {
    URL.revokeObjectURL(prev.mergedVideoUrl);
  }
  state = {
    ...state,
    groups: {
      ...state.groups,
      [groupId]: { ...prev, ...patch },
    },
  };
  emit();
}

export function subscribeAutoPostRunState(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Ref dùng chung — không reset khi BatchActionBar remount (tránh kẹt gen). */
export const autoPostPipelineStopRef = { current: false };
export const autoPostPipelineRunningRef = { current: false };

export function useAutoPostRunState(): AutoPostRunState {
  return useSyncExternalStore(subscribeAutoPostRunState, getAutoPostRunState, getAutoPostRunState);
}

export function useAutoPostGroupRunInfo(groupId: string): AutoPostGroupRunInfo | undefined {
  const s = useAutoPostRunState();
  return s.groups[groupId];
}

export function useAutoPostRunnerActions(): AutoPostRunnerActions | null {
  return useSyncExternalStore(
    subscribeAutoPostRunState,
    getAutoPostRunnerActions,
    getAutoPostRunnerActions
  );
}
