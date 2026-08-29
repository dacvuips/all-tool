import { useCallback, useRef } from "react";
import { CopyVideoScene } from "../../constants";
import { buildGroupsFromScenes, SocialPostGroup, SocialPostPublishInfo } from "./grouped-list";
import { saveSocialPostPublishedVideo } from "./social-post-published-video-storage";

export interface PersistSocialPostPublishParams {
  groupId: string;
  blob: Blob;
  videoCount: number;
  publish: Omit<SocialPostPublishInfo, "videoStorageKey" | "postedAt"> & {
    postedAt?: number;
  };
}

export function usePersistSocialPostPublish({
  scenes,
  socialPostGroups,
  onSocialPostGroupsChange,
}: {
  scenes: CopyVideoScene[];
  socialPostGroups?: SocialPostGroup[];
  onSocialPostGroupsChange?: (groups: SocialPostGroup[]) => Promise<void> | void;
}) {
  const groupsRef = useRef(socialPostGroups);
  groupsRef.current = socialPostGroups;

  const persistGroupPublish = useCallback(
    async ({ groupId, blob, videoCount, publish }: PersistSocialPostPublishParams) => {
      if (!onSocialPostGroupsChange) return;
      const videoStorageKey = await saveSocialPostPublishedVideo(groupId, blob);
      const current = buildGroupsFromScenes(scenes, groupsRef.current);
      const publishInfo: SocialPostPublishInfo = {
        ...publish,
        videoStorageKey,
        videoCount,
        postedAt: publish.postedAt ?? Date.now(),
      };
      const next: SocialPostGroup[] = current.map((g) =>
        g.id === groupId ? { ...g, publish: publishInfo } : g
      );
      groupsRef.current = next;
      await onSocialPostGroupsChange(next);
    },
    [onSocialPostGroupsChange, scenes]
  );

  return { persistGroupPublish };
}
