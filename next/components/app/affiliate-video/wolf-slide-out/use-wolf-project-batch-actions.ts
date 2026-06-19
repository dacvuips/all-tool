/**
 * useWolfProjectBatchActions.ts
 * Tải hàng loạt / xóa hàng loạt media trong Wolf project.
 */
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "../../../../lib/providers/toast-provider";
import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import {
  collectSceneImageFiles,
  collectSceneVideoFiles,
  downloadSceneImagesAsZip,
  downloadSceneImagesSequentially,
  downloadSceneVideosAsZip,
  downloadSceneVideosSequentially,
  handleBatchUpsampleDownloadAction,
  type SceneWithNumber,
} from "../shared/batchDownloadMedia";
import { WolfProjectItem } from "./wolf-project-item";

type WolfBatchScene = SceneWithNumber & { wolfItemId: string };

export function useWolfProjectBatchActions(options: {
  items: WolfProjectItem[];
  sceneImages: Record<string, GeneratedImageData>;
  sceneVideos: Record<string, GeneratedVideoData>;
  getSceneImage: (sceneId: string) => Promise<GeneratedImageData | undefined>;
  getSceneVideo: (sceneId: string) => Promise<GeneratedVideoData | undefined>;
  deleteItem: (item: WolfProjectItem) => Promise<void>;
  removeItemFromState: (item: WolfProjectItem) => void;
  isBusy?: boolean;
}) {
  const {
    items,
    sceneImages,
    sceneVideos,
    getSceneImage,
    getSceneVideo,
    deleteItem,
    removeItemFromState,
    isBusy = false,
  } = options;
  const { t } = useTranslation();
  const toast = useToast();

  const [downloading, setDownloading] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [downloadLabel, setDownloadLabel] = useState("");
  const [downloadVideoLabel, setDownloadVideoLabel] = useState("");

  const wolfScenes = useMemo((): WolfBatchScene[] => {
    const readyItems = items.filter((item) => item.status === "ready");
    return readyItems.map((item, index) => ({
      id: item.sceneId,
      wolfItemId: item.id,
      sceneNumber: index + 1,
    }));
  }, [items]);

  const availableImageCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ready" &&
          item.mediaType === "image" &&
          (sceneImages[item.sceneId] || item.sceneId)
      ).length,
    [items, sceneImages]
  );

  const availableVideoCount = useMemo(
    () =>
      items.filter(
        (item) =>
          item.status === "ready" &&
          item.mediaType === "video" &&
          (sceneVideos[item.sceneId] || item.sceneId)
      ).length,
    [items, sceneVideos]
  );

  const handleDownloadAllImages = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      const scenesWithImages = await collectSceneImageFiles(wolfScenes, getSceneImage);
      if (scenesWithImages.length === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        return;
      }
      const total = await downloadSceneImagesSequentially(scenesWithImages, (cur, tot) =>
        setDownloadLabel(`${cur}/${tot}`)
      );
      toast.success(`${t("Đã tải")} ${total} ${t("ảnh thành công!")}`);
    } catch (err) {
      console.error("[wolf handleDownloadAllImages] Error:", err);
      toast.error(t("Lỗi khi tải ảnh hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllImagesZip = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      const scenesWithImages = await collectSceneImageFiles(wolfScenes, getSceneImage);
      if (scenesWithImages.length === 0) {
        toast.warn(t("Chưa có ảnh nào được tạo để tải"));
        return;
      }
      setDownloadLabel(t("Đang nén"));
      await downloadSceneImagesAsZip(scenesWithImages, (cur, tot) =>
        setDownloadLabel(`${cur}/${tot}`)
      );
      toast.success(`${t("Đã tải")} ${scenesWithImages.length} ${t("ảnh trong file ZIP!")}`);
    } catch (err) {
      console.error("[wolf handleDownloadAllImagesZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllImages2k = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      await handleBatchUpsampleDownloadAction({
        scenes: wolfScenes,
        getGeneratedImage: getSceneImage,
        resolution: "2K",
        asZip: false,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[wolf handleDownloadAllImages2k] Error:", err);
      toast.error(t("Lỗi khi tải ảnh 2K hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllImages4k = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      await handleBatchUpsampleDownloadAction({
        scenes: wolfScenes,
        getGeneratedImage: getSceneImage,
        resolution: "4K",
        asZip: false,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[wolf handleDownloadAllImages4k] Error:", err);
      toast.error(t("Lỗi khi tải ảnh 4K hàng loạt"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllImages2kZip = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      setDownloadLabel(t("Đang nén"));
      await handleBatchUpsampleDownloadAction({
        scenes: wolfScenes,
        getGeneratedImage: getSceneImage,
        resolution: "2K",
        asZip: true,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[wolf handleDownloadAllImages2kZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh 2K"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllImages4kZip = useCallback(async () => {
    if (downloading || isBusy) return;
    setDownloading(true);
    try {
      setDownloadLabel(t("Đang nén"));
      await handleBatchUpsampleDownloadAction({
        scenes: wolfScenes,
        getGeneratedImage: getSceneImage,
        resolution: "4K",
        asZip: true,
        setDownloadLabel,
        toast,
        t,
      });
    } catch (err) {
      console.error("[wolf handleDownloadAllImages4kZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP ảnh 4K"));
    } finally {
      setDownloading(false);
      setDownloadLabel("");
    }
  }, [downloading, getSceneImage, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllVideos = useCallback(async () => {
    if (downloadingVideo || isBusy) return;
    setDownloadingVideo(true);
    try {
      const scenesWithVideos = await collectSceneVideoFiles(wolfScenes, getSceneVideo);
      if (scenesWithVideos.length === 0) {
        toast.warn(t("Chưa có video nào được tạo để tải"));
        return;
      }
      const downloaded = await downloadSceneVideosSequentially(scenesWithVideos, (cur, tot) =>
        setDownloadVideoLabel(`${cur}/${tot}`)
      );
      if (downloaded === 0) {
        toast.warn(t("Không thể tải video nào"));
      } else {
        toast.success(`${t("Đã tải")} ${downloaded} video ${t("thành công!")}`);
      }
    } catch (err) {
      console.error("[wolf handleDownloadAllVideos] Error:", err);
      toast.error(t("Lỗi khi tải video hàng loạt"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, getSceneVideo, isBusy, toast, t, wolfScenes]);

  const handleDownloadAllVideosZip = useCallback(async () => {
    if (downloadingVideo || isBusy) return;
    setDownloadingVideo(true);
    try {
      const scenesWithVideos = await collectSceneVideoFiles(wolfScenes, getSceneVideo);
      if (scenesWithVideos.length === 0) {
        toast.warn(t("Chưa có video nào được tạo để tải"));
        return;
      }
      setDownloadVideoLabel(t("Đang nén"));
      const downloaded = await downloadSceneVideosAsZip(scenesWithVideos, (cur, tot) =>
        setDownloadVideoLabel(`${cur}/${tot}`)
      );
      if (downloaded === 0) {
        toast.warn(t("Không thể tải video nào"));
      } else {
        toast.success(`${t("Đã tải")} ${downloaded} video ${t("trong file ZIP!")}`);
      }
    } catch (err) {
      console.error("[wolf handleDownloadAllVideosZip] Error:", err);
      toast.error(t("Lỗi khi tải ZIP video"));
    } finally {
      setDownloadingVideo(false);
      setDownloadVideoLabel("");
    }
  }, [downloadingVideo, getSceneVideo, isBusy, toast, t, wolfScenes]);

  const handleDeleteAllProjectMedia = useCallback(async () => {
    if (deletingAll || isBusy || items.length === 0) return;
    if (!confirm(t("Xóa tất cả ảnh và video trong dự án này?"))) return;

    setDeletingAll(true);
    try {
      const snapshot = [...items];
      for (const item of snapshot) {
        await deleteItem(item);
        removeItemFromState(item);
      }
      toast.success(t("Đã xóa tất cả media trong dự án"));
    } catch (err) {
      console.error("[wolf handleDeleteAllProjectMedia] Error:", err);
      toast.error(t("Lỗi khi xóa media hàng loạt"));
    } finally {
      setDeletingAll(false);
    }
  }, [deleteItem, deletingAll, isBusy, items, removeItemFromState, t, toast]);

  return {
    downloading,
    downloadingVideo,
    deletingAll,
    downloadLabel,
    downloadVideoLabel,
    availableImageCount,
    availableVideoCount,
    handleDownloadAllImages,
    handleDownloadAllImages2k,
    handleDownloadAllImages4k,
    handleDownloadAllImagesZip,
    handleDownloadAllImages2kZip,
    handleDownloadAllImages4kZip,
    handleDownloadAllVideos,
    handleDownloadAllVideosZip,
    handleDeleteAllProjectMedia,
  };
}
