/**
 * useSceneErrorBroadcast.ts
 * Hook chia sẻ cơ chế broadcast lỗi inline cho từng scene card.
 *
 * Vấn đề: Khi batch generation (tạo tất cả ảnh/video) fail cho một scene cụ thể,
 * lỗi cần hiển thị INLINE trong card cảnh đó thay vì toast hoặc im lặng.
 *
 * Cách dùng:
 * - Provider (single/trending/copy-video/elements) gọi useSceneErrorBroadcast()
 *   để có { reportSceneError, subscribeSceneError } và expose qua context.
 * - Batch actions gọi reportSceneError(sceneId, kind, message) khi từng cảnh fail.
 * - useSceneMedia hook của từng scene gọi subscribeSceneError(scene.id, cb)
 *   để nhận thông báo lỗi và cập nhật state local (imageError/videoError/extendVideoError).
 *
 * Quy ước sceneId:
 * - "{sceneId}"          → kind: "image" | "video"
 * - "{sceneId}::stitch"  → kind: "extend" (video nối)
 */
import { useCallback, useRef } from "react";

export type SceneErrorKind = "image" | "video" | "extend";

export interface SceneErrors {
  image?: string | null;
  video?: string | null;
  extend?: string | null;
}

export interface SceneErrorBroadcast {
  /**
   * Báo lỗi inline cho scene cụ thể.
   * - Truyền message để hiển thị lỗi.
   * - Truyền null để clear lỗi.
   * - sceneId có thể kèm "::stitch" → tự động chuyển sang kind "extend".
   */
  reportSceneError: (sceneId: string, kind: SceneErrorKind, message: string | null) => void;
  /**
   * Subscribe state lỗi cho 1 scene; callback nhận toàn bộ object errors.
   * Trả về hàm unsubscribe.
   */
  subscribeSceneError: (sceneId: string, callback: (errors: SceneErrors) => void) => () => void;
}

export function useSceneErrorBroadcast(): SceneErrorBroadcast {
  // Map: baseSceneId → errors object
  const sceneErrorsRef = useRef<Map<string, SceneErrors>>(new Map());
  // Map: baseSceneId → callback
  const subscribersRef = useRef<Map<string, (errors: SceneErrors) => void>>(new Map());

  const reportSceneError = useCallback(
    (sceneId: string, kind: SceneErrorKind, message: string | null) => {
      const isStitch = sceneId.endsWith("::stitch");
      const baseId = isStitch ? sceneId.replace(/::stitch$/, "") : sceneId;
      const effectiveKind: SceneErrorKind = isStitch ? "extend" : kind;

      const existing = sceneErrorsRef.current.get(baseId) || {};
      const next: SceneErrors = { ...existing, [effectiveKind]: message };
      sceneErrorsRef.current.set(baseId, next);

      const cb = subscribersRef.current.get(baseId);
      if (cb) cb({ ...next });
    },
    []
  );

  const subscribeSceneError = useCallback(
    (sceneId: string, callback: (errors: SceneErrors) => void) => {
      subscribersRef.current.set(sceneId, callback);
      // Immediately notify with current state (may be empty)
      const current = sceneErrorsRef.current.get(sceneId) || {};
      callback({ ...current });
      return () => {
        subscribersRef.current.delete(sceneId);
      };
    },
    []
  );

  return { reportSceneError, subscribeSceneError };
}
