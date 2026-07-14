import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiDeleteBinLine, RiLoader4Line, RiPencilLine } from "react-icons/ri";

import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form/button";
import { Input } from "../../../shared/utilities/form/input";
import { DB_NAME, STORE_NAME, uid } from "../constants";
import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { useIndexedDB } from "../hook/useIndexedDB";
import {
  getGeneratedImagePreviewSrc,
  getGeneratedVideoPreviewSrc,
  hasGeneratedImageData,
  hasGeneratedVideoData,
  toUiGeneratedImage,
  toUiGeneratedVideo,
} from "../shared/generatedMediaUtils";
import type { WolfMediaAsset } from "./wolf-media-library";
import { WolfProjectItem } from "./wolf-project-item";

export type WolfProject = {
  id: string;
  name: string;
  createdAt: number;
};

export type WolfProjectCoverMedia = {
  sceneImage?: GeneratedImageData;
  sceneVideo?: GeneratedVideoData;
};

function formatProjectName(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.getMonth() + 1;
  return `${hours}:${minutes} ${day} thg ${month}`;
}

function hasCoverMedia(media: WolfProjectCoverMedia | undefined): boolean {
  return !!(
    (media?.sceneImage && hasGeneratedImageData(media.sceneImage)) ||
    (media?.sceneVideo && hasGeneratedVideoData(media.sceneVideo))
  );
}

function sceneMediaFromAsset(asset: WolfMediaAsset): WolfProjectCoverMedia {
  if (asset.type === "image") {
    return {
      sceneImage: toUiGeneratedImage({
        imageBytes: asset.dataBase64,
        mimeType: asset.mimeType,
        fifeUrl: "",
      }),
    };
  }

  return {
    sceneVideo: toUiGeneratedVideo({
      videoBytes: asset.dataBase64,
      mimeType: asset.mimeType,
      videoUri: null,
    }),
  };
}

const COVER_ASPECT_PADDING = "56.25%";
const WOLF_APP_LOGO = "/assets/img/logo-full-1.png  ";

function WolfProjectCoverLogo({ className = "px-2 w-full h-16" }: { className?: string }) {
  return (
    <img src={WOLF_APP_LOGO} alt="Wolf" className={`object-contain opacity-40 ${className}`} />
  );
}

function sortByNewest<T extends { createdAt: number }>(a: T, b: T): number {
  return b.createdAt - a.createdAt;
}

function WolfProjectCover({
  coverItem,
  coverMedia,
  isMediaLoading,
}: {
  coverItem: WolfProjectItem | null;
  coverMedia?: WolfProjectCoverMedia;
  isMediaLoading?: boolean;
}) {
  const { t } = useTranslation();

  const imageSrc =
    coverMedia?.sceneImage && hasGeneratedImageData(coverMedia.sceneImage)
      ? getGeneratedImagePreviewSrc(coverMedia.sceneImage)
      : "";
  const videoSrc =
    coverMedia?.sceneVideo && hasGeneratedVideoData(coverMedia.sceneVideo)
      ? getGeneratedVideoPreviewSrc(coverMedia.sceneVideo)
      : null;
  const hasMedia = !!imageSrc || !!videoSrc;
  const isVideo = coverItem?.mediaType === "video";
  const isGenerating = coverItem?.status === "generating";
  const isFailed = coverItem?.status === "failed";
  const isCancelled = coverItem?.status === "cancelled";

  return (
    <div
      className="overflow-hidden relative flex-none w-full bg-slate-100"
      style={{ paddingTop: COVER_ASPECT_PADDING }}
    >
      {!coverItem && !hasMedia ? (
        <div className="flex absolute inset-0 justify-center items-center bg-slate-50">
          <WolfProjectCoverLogo />
        </div>
      ) : isMediaLoading ? (
        <div className="flex absolute inset-0 justify-center items-center">
          <RiLoader4Line className="text-lg animate-spin text-slate-400" />
        </div>
      ) : imageSrc ? (
        <img src={imageSrc} alt="" className="block object-cover absolute inset-0 w-full h-full" />
      ) : videoSrc ? (
        <video
          src={videoSrc}
          className="block object-cover absolute inset-0 w-full h-full"
          muted
          playsInline
          preload="metadata"
        />
      ) : isGenerating ? (
        <div className="flex absolute inset-0 flex-col gap-1 justify-center items-center bg-slate-50">
          <RiLoader4Line
            className={`text-xl animate-spin ${isVideo ? "text-purple-500" : "text-pink-500"}`}
          />
          <span className={`text-xs font-medium ${isVideo ? "text-purple-600" : "text-pink-600"}`}>
            {t("Đang tạo...")}
          </span>
        </div>
      ) : isFailed ? (
        <div className="flex absolute inset-0 justify-center items-center bg-red-50">
          <span className="text-xs font-medium text-red-500">{t("Tạo thất bại")}</span>
        </div>
      ) : isCancelled ? (
        <div className="flex absolute inset-0 justify-center items-center bg-amber-50">
          <span className="text-xs font-medium text-amber-700">{t("Đã dừng")}</span>
        </div>
      ) : (
        <div className="flex absolute inset-0 justify-center items-center bg-slate-50">
          <WolfProjectCoverLogo />
        </div>
      )}
    </div>
  );
}

type WolfProjectGridProps = {
  onNewProject?: (projectId: string) => void;
  onOpenProject?: (projectId: string) => void;
};

export function WolfProjectGrid({ onNewProject, onOpenProject }: WolfProjectGridProps) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [projects, setProjects] = useState<WolfProject[]>([]);
  const [coverItemsByProject, setCoverItemsByProject] = useState<Record<string, WolfProjectItem>>(
    {}
  );
  const [coverMediaByProject, setCoverMediaByProject] = useState<
    Record<string, WolfProjectCoverMedia>
  >({});
  const [coverMediaLoading, setCoverMediaLoading] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<WolfProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);

  const projectDB = useIndexedDB<WolfProject>(STORE_NAME.wolf, DB_NAME.wolf);
  const itemDB = useIndexedDB<WolfProjectItem>(STORE_NAME.wolfItems, DB_NAME.wolf);
  const assetDB = useIndexedDB<WolfMediaAsset>(STORE_NAME.wolfAssets, DB_NAME.wolf);
  const sceneImageDB = useIndexedDB<GeneratedImageData>(STORE_NAME.wolfSceneImages, DB_NAME.wolf);
  const sceneVideoDB = useIndexedDB<GeneratedVideoData>(STORE_NAME.wolfSceneVideos, DB_NAME.wolf);

  const resolveItemCoverMedia = useCallback(
    async (item: WolfProjectItem): Promise<WolfProjectCoverMedia> => {
      if (item.mediaType === "image") {
        const sceneImage = await sceneImageDB.get(item.sceneId);
        if (hasGeneratedImageData(sceneImage)) return { sceneImage };
      } else {
        const sceneVideo = await sceneVideoDB.get(item.sceneId);
        if (hasGeneratedVideoData(sceneVideo)) return { sceneVideo };
      }

      if (item.assetId) {
        const asset = await assetDB.get(item.assetId);
        if (asset) return sceneMediaFromAsset(asset);
      }

      return {};
    },
    [assetDB, sceneImageDB, sceneVideoDB]
  );

  const preloadProjectCovers = useCallback(
    async (
      projectList: WolfProject[],
      allItems: WolfProjectItem[],
      allAssets: WolfMediaAsset[]
    ): Promise<{
      coverItems: Record<string, WolfProjectItem>;
      coverMedia: Record<string, WolfProjectCoverMedia>;
    }> => {
      const coverItems: Record<string, WolfProjectItem> = {};
      const coverMedia: Record<string, WolfProjectCoverMedia> = {};

      await Promise.all(
        projectList.map(async (project) => {
          const projectItems = allItems
            .filter((item) => item.projectId === project.id)
            .sort(sortByNewest);

          const readyItems = projectItems.filter((item) => item.status === "ready");

          for (const item of readyItems) {
            const media = await resolveItemCoverMedia(item);
            if (hasCoverMedia(media)) {
              coverItems[project.id] = item;
              coverMedia[project.id] = media;
              return;
            }
          }

          if (projectItems.length > 0) {
            coverItems[project.id] = readyItems[0] ?? projectItems[0];
          }

          const projectAssets = allAssets
            .filter((asset) => asset.projectId === project.id)
            .sort(sortByNewest);

          const latestAsset = projectAssets[0];
          if (latestAsset) {
            coverMedia[project.id] = sceneMediaFromAsset(latestAsset);
            return;
          }

          const fallback = readyItems[0] ?? projectItems[0];
          if (fallback?.status === "ready") {
            coverMedia[project.id] = await resolveItemCoverMedia(fallback);
          }
        })
      );

      return { coverItems, coverMedia };
    },
    [resolveItemCoverMedia]
  );

  const loadProjects = useCallback(async () => {
    const [records, allItems, allAssets] = await Promise.all([
      projectDB.getAll(),
      itemDB.getAll(),
      assetDB.getAll(),
    ]);
    records.sort((a, b) => b.createdAt - a.createdAt);

    const projectIds = records.map((project) => project.id);
    setCoverMediaLoading(Object.fromEntries(projectIds.map((id) => [id, true])));
    setProjects(records);

    const { coverItems, coverMedia } = await preloadProjectCovers(records, allItems, allAssets);
    setCoverItemsByProject(coverItems);
    setCoverMediaByProject(coverMedia);
    setCoverMediaLoading(Object.fromEntries(projectIds.map((id) => [id, false])));
  }, [assetDB, itemDB, preloadProjectCovers, projectDB]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const [records, allItems, allAssets] = await Promise.all([
          projectDB.getAll(),
          itemDB.getAll(),
          assetDB.getAll(),
        ]);
        if (cancelled) return;

        records.sort((a, b) => b.createdAt - a.createdAt);
        setProjects(records);
        setIsLoading(false);

        const projectIds = records.map((project) => project.id);
        setCoverMediaLoading(Object.fromEntries(projectIds.map((id) => [id, true])));

        const { coverItems, coverMedia } = await preloadProjectCovers(records, allItems, allAssets);
        if (cancelled) return;

        setCoverItemsByProject(coverItems);
        setCoverMediaByProject(coverMedia);
        setCoverMediaLoading(Object.fromEntries(projectIds.map((id) => [id, false])));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [assetDB, itemDB, preloadProjectCovers, projectDB]);

  const handleNewProject = async () => {
    const now = new Date();
    const project: WolfProject = {
      id: uid(),
      name: formatProjectName(now),
      createdAt: now.getTime(),
    };

    await projectDB.set(project.id, project);
    await loadProjects();
    onNewProject?.(project.id);
  };

  const handleOpenRename = (project: WolfProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(project);
    setRenameValue(project.name);
  };

  const handleCloseRename = () => {
    if (isSavingRename) return;
    setRenameTarget(null);
    setRenameValue("");
  };

  const handleSaveRename = async () => {
    if (!renameTarget) return;

    const trimmed = renameValue.trim();
    if (!trimmed) return;

    setIsSavingRename(true);
    try {
      const updated: WolfProject = { ...renameTarget, name: trimmed };
      await projectDB.set(renameTarget.id, updated);
      await loadProjects();
      setRenameTarget(null);
      setRenameValue("");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("Bạn có chắc muốn xoá dự án này?"))) return;

    await projectDB.remove(projectId);
    await loadProjects();
  };

  return (
    <div className="flex relative flex-col h-full bg-white">
      <div className="overflow-auto flex-1 p-4 v-scrollbar">
        {isLoading ? (
          <div className="flex justify-center items-center h-32 text-sm text-slate-400">
            {t("Đang tải...")}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex justify-center items-center h-32 text-sm text-slate-400">
            {t("Chưa có dự án nào")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenProject?.(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenProject?.(project.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex overflow-hidden flex-col text-left bg-white rounded-2xl border shadow-sm transition-all cursor-pointer group border-slate-200 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <WolfProjectCover
                  coverItem={coverItemsByProject[project.id] ?? null}
                  coverMedia={coverMediaByProject[project.id]}
                  isMediaLoading={coverMediaLoading[project.id]}
                />
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-sm truncate text-slate-500">{project.name}</span>
                  {hoveredId === project.id && (
                    <div className="flex gap-1 items-center shrink-0">
                      <button
                        type="button"
                        title={t("Sửa tên")}
                        onClick={(e) => handleOpenRename(project, e)}
                        className="p-1 rounded-md transition-colors text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <RiPencilLine className="text-base" />
                      </button>
                      <button
                        type="button"
                        title={t("Xoá dự án")}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="p-1 rounded-md transition-colors text-slate-500 hover:bg-red-50 hover:text-red-500"
                      >
                        <RiDeleteBinLine className="text-base" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex absolute inset-x-0 bottom-6 justify-center pointer-events-none">
        <button
          type="button"
          onClick={handleNewProject}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-blue-500 bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
        >
          <RiAddLine className="text-lg" />
          {t("Dự án mới")}
        </button>
      </div>

      <Dialog
        isOpen={!!renameTarget}
        onClose={handleCloseRename}
        title={t("Sửa tên dự án")}
        width={420}
      >
        <Dialog.Body>
          <Input
            autoFocus
            value={renameValue}
            onChange={(val) => setRenameValue(val)}
            placeholder={t("Nhập tên dự án")}
          />{" "}
          <div className="flex gap-2 justify-end py-2">
            <Button text={t("Huỷ")} onClick={handleCloseRename} disabled={isSavingRename} />
            <Button
              primary
              text={t("Lưu")}
              onClick={() => void handleSaveRename()}
              isLoading={isSavingRename}
              disabled={!renameValue.trim() || isSavingRename}
            />
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
