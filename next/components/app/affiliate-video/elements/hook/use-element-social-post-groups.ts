import { useCallback } from "react";
import { CACHE_KEY, DB_NAME, STORE_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { SocialPostGroup } from "../../shared/auto-post-social";
import { useElementContext } from "../providers/element-provider";

/** Persist socialPostGroups (scriptData + IndexedDB + history) — dùng chung mọi tab Elements. */
export function useElementSocialPostGroups() {
  const { scriptData, updateScriptData, selectedHistoryId } = useElementContext();
  const db = useIndexedDB<any>(STORE_NAME.generateElement, DB_NAME.generateElement);

  const onSocialPostGroupsChange = useCallback(
    async (groups: SocialPostGroup[]) => {
      if (!scriptData) return;
      try {
        const merged = { ...scriptData, socialPostGroups: groups };
        await db.set(CACHE_KEY.lastElementScript, merged);
        updateScriptData?.(merged);

        if (selectedHistoryId) {
          const history: any[] = (await db.get(CACHE_KEY.elementHistory)) || [];
          const updatedHistory = history.map((item: any) =>
            item.id === selectedHistoryId
              ? { ...item, data: { ...item.data, socialPostGroups: groups } }
              : item
          );
          await db.set(CACHE_KEY.elementHistory, updatedHistory);
        }
      } catch (err) {
        console.error("[useElementSocialPostGroups] Failed to persist:", err);
      }
    },
    [db, scriptData, updateScriptData, selectedHistoryId]
  );

  return {
    socialPostGroups: scriptData?.socialPostGroups as SocialPostGroup[] | undefined,
    onSocialPostGroupsChange,
  };
}
