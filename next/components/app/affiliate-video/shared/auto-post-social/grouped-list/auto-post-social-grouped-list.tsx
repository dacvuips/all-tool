/**
 * Danh sách nhóm đăng MXH — 1 bảng duy nhất, hierarchy chuyên nghiệp.
 * Row chính: metadata Tiêu đề | Mô tả | Hashtag | Link
 * Row con: phân cảnh (tree gutter) thuộc từng nhóm
 */
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RiFileList3Line } from "react-icons/ri";
import {
  isAnySocialPostGroupScenesExpanded,
  useSocialPostScenesCollapseState,
} from "../social-post-scenes-collapse-store";
import { SocialPostScenesCollapsible } from "../social-post-scenes-collapsible";
import { AutoPostSocialSceneTableHeader, AUTO_POST_SCENE_TABLE_MIN_WIDTH_CLASS } from "./auto-post-social-scene-table";
import { SocialPostGroupLabel } from "./social-post-group-label";
import { SocialPostGroup } from "./types";
export interface AutoPostSocialGroupedListProps<TScene extends { id: string }> {
  scenes: TScene[];
  groups: SocialPostGroup[];
  renderSceneRow: (scene: TScene, sceneIndex: number) => React.ReactNode;
  onGroupsChange?: (groups: SocialPostGroup[]) => void;
  className?: string;
}

export function AutoPostSocialGroupedList<TScene extends { id: string }>({
  scenes,
  groups,
  renderSceneRow,
  onGroupsChange,
  className = "",
}: AutoPostSocialGroupedListProps<TScene>) {
  const { t } = useTranslation();
  useSocialPostScenesCollapseState();

  const sceneMap = useMemo(() => new Map(scenes.map((s) => [s.id, s])), [scenes]);
  const orderedGroups = useMemo(() => {
    return groups.map((g) => ({
      ...g,
      sceneIds: g.sceneIds.filter((id) => sceneMap.has(id)),
    }));
  }, [groups, sceneMap]);

  const totalScenes = useMemo(
    () => orderedGroups.reduce((sum, g) => sum + g.sceneIds.length, 0),
    [orderedGroups]
  );

  const anyScenesExpanded = isAnySocialPostGroupScenesExpanded(
    orderedGroups.map((g) => g.id)
  );

  if (orderedGroups.length === 0) {
    return (
      <div
        className={`flex flex-col gap-2 justify-center items-center px-6 py-12 text-center bg-gray-50 rounded-xl border border-gray-200 border-dashed ${className}`}
      >
        <div className="flex justify-center items-center w-10 h-10 text-purple-400 bg-purple-50 rounded-full">
          <RiFileList3Line className="text-xl" />
        </div>
        <p className="text-sm font-semibold text-gray-600">{t("Chưa có nhóm bài đăng")}</p>
        <p className="max-w-sm text-xs leading-relaxed text-gray-400">
          {t(
            "Thêm dòng **Tiêu đề|Mô tả|Hashtag|Link** trong Prompt phân cảnh, rồi tạo danh sách cảnh."
          )}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
    >
      <div className="flex flex-wrap gap-2 justify-between items-center px-3 py-2.5 bg-white border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <span className="flex justify-center items-center w-7 h-7 text-purple-600 bg-purple-100 rounded-lg">
            <RiFileList3Line className="text-sm" />
          </span>
          <div className="leading-tight">
            <p className="text-xs font-bold text-gray-800">{t("Danh sách đăng MXH")}</p>
            <p className="text-10 text-gray-500">
              {t("{{groups}} bài · {{scenes}} cảnh", {
                groups: orderedGroups.length,
                scenes: totalScenes,
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-screen v-scrollbar">
        <div className={AUTO_POST_SCENE_TABLE_MIN_WIDTH_CLASS}>
          {anyScenesExpanded ? <AutoPostSocialSceneTableHeader /> : null}

          {orderedGroups.map((group, groupIndex) => (
            <div key={group.id}>
              <SocialPostGroupLabel
                group={group}
                groupIndex={groupIndex}
                sceneCount={group.sceneIds.length}
                onPlatformsChange={
                  onGroupsChange
                    ? (groupId, platforms) => {
                        onGroupsChange(
                          groups.map((g) => (g.id === groupId ? { ...g, platforms } : g))
                        );
                      }
                    : undefined
                }
              />
              <SocialPostScenesCollapsible groupId={group.id}>
                {group.sceneIds.map((sceneId) => {
                  const scene = sceneMap.get(sceneId);
                  if (!scene) return null;
                  const sceneIndex = scenes.findIndex((s) => s.id === sceneId);
                  return (
                    <div key={sceneId}>
                      {renderSceneRow(scene, sceneIndex >= 0 ? sceneIndex : 0)}
                    </div>
                  );
                })}
              </SocialPostScenesCollapsible>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
