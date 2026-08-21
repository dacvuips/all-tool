/**
 * Gallery video generated (IndexedDB `generated-videos`) — chọn gán vào scene Film.
 * Cùng nguồn với tool Scene Batch / generate-video store.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line, RiSearchLine, RiVideoFill } from "react-icons/ri";
import type { GeneratedVideoData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { DB_NAME } from "../app/affiliate-video/constants";
import { useIndexedDB } from "../app/affiliate-video/hook/useIndexedDB";
import {
  getGeneratedVideoPreviewSrc,
  hasGeneratedVideoData,
  toUiGeneratedVideo,
} from "../app/affiliate-video/shared/generatedMediaUtils";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Input } from "../shared/utilities/form";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (videoData: GeneratedVideoData) => void;
  title?: string;
};

export default function FilmVideoGalleryDialog({
  isOpen,
  onClose,
  onSelect,
  title,
}: Props) {
  const { t } = useTranslation();
  const videoDB = useIndexedDB<GeneratedVideoData>("generated-videos", DB_NAME.generateVideo);
  const [videos, setVideos] = useState<{ key: string; data: GeneratedVideoData }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await videoDB.getAllWithKeys();
      const items = entries
        .filter((e) => hasGeneratedVideoData(e.value))
        .map((e) => ({
          key: String(e.key),
          data: toUiGeneratedVideo(e.value),
        }))
        .reverse();
      setVideos(items);
    } catch (err) {
      console.error("[FilmVideoGalleryDialog] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [videoDB]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      void loadVideos();
    }
  }, [isOpen, loadVideos]);

  const filtered = searchQuery.trim()
    ? videos.filter((v) => v.key.toLowerCase().includes(searchQuery.toLowerCase()))
    : videos;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || t("Chọn video từ Gallery")}
      width="90vw"
      maxWidth="800px"
    >
      <div className="p-4">
        <div className="relative mb-4">
          <Input
            prefix={<RiSearchLine />}
            placeholder={t("Tìm theo key...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="py-2 pr-3 w-full text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {loading && (
          <div className="flex justify-center items-center py-16">
            <RiLoader4Line className="text-3xl animate-spin text-primary" />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col justify-center items-center py-16 text-gray-400">
            <RiVideoFill className="mb-3 text-5xl" />
            <p className="text-base m-0">{t("Chưa có video nào")}</p>
            <p className="mt-1 text-sm m-0">
              {t("Video AI đã tạo (tool / film) sẽ xuất hiện ở đây")}
            </p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((item) => {
              const src = getGeneratedVideoPreviewSrc(item.data);
              return (
                <div
                  key={item.key}
                  role="button"
                  tabIndex={0}
                  className="overflow-hidden relative rounded-xl border-2 border-transparent transition-all cursor-pointer group hover:border-primary hover:shadow-lg"
                  onClick={() => onSelect(item.data)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(item.data);
                    }
                  }}
                >
                  <div className="relative aspect-[9/16] bg-gray-900">
                    {src ? (
                      <video
                        src={src}
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover rounded-md border border-purple-300 border-dashed"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-purple-50">
                        <RiVideoFill className="text-purple-400 text-2xl" />
                      </div>
                    )}
                    <div className="flex absolute inset-0 justify-center items-center rounded-xl opacity-0 transition-opacity bg-black/30 group-hover:opacity-100 pointer-events-none">
                      <span className="px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-full shadow-lg">
                        {t("Chọn video")}
                      </span>
                    </div>
                  </div>
                  <div className="px-2 py-1.5 bg-white">
                    <span
                      className="text-[10px] text-gray-500 truncate block max-w-full"
                      title={item.key}
                    >
                      {item.key}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="mt-3 text-sm text-center text-gray-400">
            {t("Tổng")}: {filtered.length} {t("video")}
          </div>
        )}
      </div>
    </Dialog>
  );
}
