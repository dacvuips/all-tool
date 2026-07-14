import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiDatabase2Line,
  RiDeleteBin6Line,
  RiDownloadLine,
  RiFileLine,
  RiFilterLine,
  RiImageLine,
  RiLoader4Line,
  RiMusic2Line,
  RiPlayCircleLine,
  RiRefreshLine,
  RiSearchLine,
  RiVideoLine,
  RiZoomInLine,
} from "react-icons/ri";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  CustomerGenerationMedia,
  CustomerGenerationMediaService,
  CustomerMediaType,
} from "../../../../../lib/repo/customer-generation-media.repo";
import { DB_NAME } from "../../../../app/affiliate-video/constants";
import {
  GeneratedAudioData,
  GeneratedImageData,
  GeneratedVideoData,
} from "../../../../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { useIndexedDB } from "../../../../app/affiliate-video/hook/useIndexedDB";
import { GeneratedImageDownloadButtons } from "../../../../app/affiliate-video/shared/generated-image-download-buttons";
import { GeneratedVideoDownloadButtons } from "../../../../app/affiliate-video/shared/generated-video-download-buttons";
import {
  GeneratedImageLike,
  GeneratedVideoLike,
  getGeneratedImagePreviewSrc,
  getGeneratedVideoPreviewSrc,
  hasGeneratedImageData,
  hasGeneratedVideoData,
  toUiGeneratedImage,
  toUiGeneratedVideo,
} from "../../../../app/affiliate-video/shared/generatedMediaUtils";
import { toDownloadProxyUrl } from "../../../../app/affiliate-video/shared/videoDownloadUtils";
import { Input } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab";

const MEDIA_TYPES: { value: CustomerMediaType | "all"; label: string; icon: JSX.Element }[] = [
  { value: "all", label: "Tất cả", icon: <RiFilterLine /> },
  { value: "image", label: "Ảnh", icon: <RiImageLine /> },
  { value: "video", label: "Video", icon: <RiVideoLine /> },
  { value: "audio", label: "Âm thanh", icon: <RiMusic2Line /> },
  { value: "file", label: "Tệp", icon: <RiFileLine /> },
];

const LOCAL_MEDIA_TYPES: {
  value: "all" | "image" | "video" | "audio";
  label: string;
  icon: JSX.Element;
}[] = [
  { value: "all", label: "Tất cả", icon: <RiFilterLine /> },
  { value: "image", label: "Ảnh", icon: <RiImageLine /> },
  { value: "video", label: "Video", icon: <RiVideoLine /> },
  { value: "audio", label: "Âm thanh", icon: <RiMusic2Line /> },
];

const PAGE_SIZE = 12;

// ── IndexedDB local media item type ──
interface LocalMediaItem {
  id: string;
  type: "image" | "video" | "audio";
  key: IDBValidKey;
  previewUrl: string;
  mimeType: string;
  imageData?: GeneratedImageData;
  videoData?: GeneratedVideoData;
}

function buildLocalDataUrl(
  mimeType: string,
  base64: string | null | undefined,
  fallbackUri?: string | null
): string {
  if (base64) return `data:${mimeType};base64,${base64}`;
  const uri = (fallbackUri || "").trim();
  if (!uri) return "";
  if (uri.startsWith("blob:") || uri.startsWith("data:")) return uri;
  if (/^https?:\/\//i.test(uri)) return toDownloadProxyUrl(uri, true);
  return uri;
}

function customerMediaToImageLike(media: CustomerGenerationMedia): GeneratedImageLike {
  const url = (media.url || "").trim();
  return {
    imageUrl: url,
    fifeUrl: url,
    mimeType: media.mimeType || "image/jpeg",
    flow2RequestId: media.flow2RequestId,
  };
}

function customerMediaToVideoLike(media: CustomerGenerationMedia): GeneratedVideoLike {
  const url = (media.url || "").trim();
  return {
    videoUri: url || null,
    mimeType: media.mimeType || "video/mp4",
    flow2RequestId: media.flow2RequestId,
  };
}

export function ProfileMediaGallery() {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-md min-h-[400px]">
      <TabGroup
        flex={false}
        name="profile-media-gallery"
        bodyClassName="p-4"
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
      >
        <TabGroup.Tab label={t("Media AI")}>
          <LocalMediaGallery />
        </TabGroup.Tab>
        <TabGroup.Tab label={t("Thư viện Media")}>
          <ServerMediaGallery />
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
}

// ── Server Media Gallery ───────────────────────────────────────────────────

function ServerMediaGallery() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();

  const [mediaList, setMediaList] = useState<CustomerGenerationMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CustomerMediaType | "all">("all");
  const [search, setSearch] = useState("");
  const [previewMedia, setPreviewMedia] = useState<CustomerGenerationMedia | null>(null);

  const fetchMedia = useCallback(
    async (currentPage = 1) => {
      setLoading(true);
      try {
        const filter: any = {};
        if (typeFilter !== "all") filter.type = typeFilter;

        const res = await CustomerGenerationMediaService.getAll({
          query: {
            limit: PAGE_SIZE,
            page: currentPage,
            order: { createdAt: -1 },
            filter,
            search: search || undefined,
          },
          cache: false,
        });
        setMediaList(res.data);
        setTotal(res.total);
      } catch (err) {
        toast.error(t("Không thể tải danh sách media"));
      } finally {
        setLoading(false);
      }
    },
    [typeFilter, search]
  );

  useEffect(() => {
    setPage(1);
    fetchMedia(1);
  }, [typeFilter, search]);

  useEffect(() => {
    fetchMedia(page);
  }, [page]);

  const totalPages = useMemo(() => Math.ceil(total / PAGE_SIZE), [total]);

  const handleDelete = async (media: CustomerGenerationMedia) => {
    const confirmed = await alert.danger(t("Xác nhận xóa"), t("Bạn có chắc muốn xóa media này?"));
    if (!confirmed) return;
    try {
      await CustomerGenerationMediaService.delete({ id: media.id, toast });
      fetchMedia(page);
    } catch (err) {}
  };

  const handleDownload = (media: CustomerGenerationMedia) => {
    if (!media.url) return;
    const a = document.createElement("a");
    a.href = media.url;
    a.download = `media-${media.id}`;
    a.target = "_blank";
    a.click();
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {MEDIA_TYPES.map((item) => (
            <button
              key={item.value}
              onClick={() => setTypeFilter(item.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                typeFilter === item.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item.icon}
              {t(item.label)}
            </button>
          ))}
        </div>
        <div className="relative">
          <RiSearchLine className="absolute left-3 top-1/2 text-gray-400 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("Tìm kiếm...")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="py-2 pl-9 pr-3 text-sm border border-gray-200 rounded-lg w-full sm:w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center items-center py-20">
          <RiLoader4Line className="text-3xl animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && mediaList.length === 0 && (
        <div className="flex flex-col justify-center items-center py-20 text-gray-400">
          <RiImageLine className="mb-3 text-5xl" />
          <p className="text-base">{t("Chưa có media nào")}</p>
          <p className="mt-1 text-sm">{t("Media bạn tạo từ AI sẽ xuất hiện ở đây")}</p>
        </div>
      )}

      {/* Gallery grid */}
      {!loading && mediaList.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {mediaList.map((media) => (
            <MediaCard
              key={media.id}
              media={media}
              onPreview={() => setPreviewMedia(media)}
              onDelete={() => handleDelete(media)}
              onDownload={() => handleDownload(media)}
              formatFileSize={formatFileSize}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex gap-2 justify-center items-center mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("Trước")}
          </button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 text-sm font-medium rounded-lg ${
                    page === pageNum
                      ? "bg-primary text-white"
                      : "border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("Sau")}
          </button>
        </div>
      )}

      {/* Total count */}
      {!loading && total > 0 && (
        <div className="mt-3 text-sm text-center text-gray-400">
          {t("Tổng")}: {total} {t("media")}
        </div>
      )}

      {/* Preview modal */}
      {previewMedia && (
        <MediaPreviewModal
          media={previewMedia}
          onClose={() => setPreviewMedia(null)}
          onDelete={() => {
            handleDelete(previewMedia);
            setPreviewMedia(null);
          }}
          onDownload={() => handleDownload(previewMedia)}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />
      )}
    </>
  );
}

// ── IndexedDB Local Media Gallery ──────────────────────────────────────────

function LocalMediaGallery() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();

  const imageDB = useIndexedDB<GeneratedImageData>("generated-images", DB_NAME.generateImage);
  const videoDB = useIndexedDB<GeneratedVideoData>("generated-videos", DB_NAME.generateVideo);
  const audioDB = useIndexedDB<GeneratedAudioData>("generated-audio", DB_NAME.generateVoice);
  const getImageEntries = imageDB.getAllWithKeys;
  const getVideoEntries = videoDB.getAllWithKeys;
  const getAudioEntries = audioDB.getAllWithKeys;
  const removeImageEntry = imageDB.remove;
  const clearImageStore = imageDB.clear;
  const removeVideoEntry = videoDB.remove;
  const clearVideoStore = videoDB.clear;
  const removeAudioEntry = audioDB.remove;
  const clearAudioStore = audioDB.clear;

  const [localMedia, setLocalMedia] = useState<LocalMediaItem[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const fetchInFlightRef = useRef(false);
  const [localTypeFilter, setLocalTypeFilter] = useState<"all" | "image" | "video" | "audio">(
    "all"
  );
  const [localSearch, setLocalSearch] = useState("");
  const [previewLocal, setPreviewLocal] = useState<LocalMediaItem | null>(null);
  const toastRef = useRef(toast);
  const tRef = useRef(t);
  toastRef.current = toast;
  tRef.current = t;

  const fetchLocalMedia = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      if (fetchInFlightRef.current) return;
      fetchInFlightRef.current = true;

      const showSpinner = options?.showSpinner ?? false;
      if (showSpinner) setLocalLoading(true);

      let skippedWhileMapping = 0;

      try {
        const [images, videos, audios] = await Promise.all([
          getImageEntries(),
          getVideoEntries(),
          getAudioEntries(),
        ]);

        const items: LocalMediaItem[] = [];

        for (const entry of images) {
          const img = entry.value;
          if (!hasGeneratedImageData(img)) continue;
          try {
            const ui = toUiGeneratedImage(img);
            const previewUrl = getGeneratedImagePreviewSrc(ui);
            if (!previewUrl) continue;
            items.push({
              id: `local-img-${String(entry.key)}`,
              type: "image",
              key: entry.key,
              previewUrl,
              mimeType: ui.mimeType || "image/png",
              imageData: ui,
            });
          } catch (err) {
            skippedWhileMapping++;
            console.warn("[LocalMediaGallery] Skip corrupt image entry", entry.key, err);
          }
        }

        for (const entry of videos) {
          const vid = entry.value;
          if (!hasGeneratedVideoData(vid)) continue;
          try {
            const ui = toUiGeneratedVideo(vid);
            const previewUrl = getGeneratedVideoPreviewSrc(ui) || "";
            if (!previewUrl) continue;
            items.push({
              id: `local-vid-${String(entry.key)}`,
              type: "video",
              key: entry.key,
              previewUrl,
              mimeType: ui.mimeType || "video/mp4",
              videoData: ui,
            });
          } catch (err) {
            skippedWhileMapping++;
            console.warn("[LocalMediaGallery] Skip corrupt video entry", entry.key, err);
          }
        }

        for (const entry of audios) {
          const aud = entry.value;
          if (!aud?.audioBytes) continue;
          try {
            items.push({
              id: `local-aud-${String(entry.key)}`,
              type: "audio",
              key: entry.key,
              previewUrl: buildLocalDataUrl(aud.mimeType || "audio/wav", aud.audioBytes),
              mimeType: aud.mimeType || "audio/wav",
            });
          } catch (err) {
            skippedWhileMapping++;
            console.warn("[LocalMediaGallery] Skip corrupt audio entry", entry.key, err);
          }
        }

        setLocalMedia(items);

        if (skippedWhileMapping > 0) {
          toastRef.current.info(
            tRef.current(
              "Một số media cục bộ bị hỏng đã được bỏ qua. Hãy tạo lại từ công cụ AI nếu cần."
            )
          );
        }
      } catch (err) {
        console.error("[LocalMediaGallery] Error loading IndexedDB media:", err);
        toastRef.current.error(tRef.current("Không thể tải media từ bộ nhớ cục bộ"));
      } finally {
        fetchInFlightRef.current = false;
        setLocalLoading(false);
      }
    },
    [getImageEntries, getVideoEntries, getAudioEntries]
  );

  useEffect(() => {
    fetchLocalMedia({ showSpinner: true });
  }, [fetchLocalMedia]);

  const filteredMedia = useMemo(() => {
    let items = localMedia;
    if (localTypeFilter !== "all") {
      items = items.filter((m) => m.type === localTypeFilter);
    }
    if (localSearch.trim()) {
      const q = localSearch.toLowerCase();
      items = items.filter((m) => String(m.key).toLowerCase().includes(q));
    }
    return items;
  }, [localMedia, localTypeFilter, localSearch]);

  const handleDeleteLocal = async (item: LocalMediaItem) => {
    const confirmed = await alert.danger(
      t("Xác nhận xóa"),
      t("Bạn có chắc muốn xóa media cục bộ này? Dữ liệu sẽ không thể khôi phục.")
    );
    if (!confirmed) return;

    try {
      if (item.type === "image") {
        await removeImageEntry(item.key);
      } else if (item.type === "video") {
        await removeVideoEntry(item.key);
      } else if (item.type === "audio") {
        await removeAudioEntry(item.key);
      }
      setLocalMedia((prev) => prev.filter((m) => m.id !== item.id));
      toast.success(t("Đã xóa media cục bộ"));
    } catch (err) {
      toast.error(t("Không thể xóa media"));
    }
  };

  const handleDownloadLocal = (item: LocalMediaItem) => {
    if (item.type === "image" || item.type === "video") return;
    const ext = "wav";
    const a = document.createElement("a");
    a.href = item.previewUrl;
    a.download = `${String(item.key)}.${ext}`;
    a.click();
  };

  const handleDeleteAllByType = async (
    type: "image" | "video" | "audio",
    clearStore: () => Promise<void>,
    labels: { title: string; message: string; success: string; error: string }
  ) => {
    const count = localMedia.filter((m) => m.type === type).length;
    if (count === 0) return;

    const confirmed = await alert.danger(t(labels.title), t(labels.message, { count }));
    if (!confirmed) return;

    try {
      await clearStore();
      setLocalMedia((prev) => prev.filter((m) => m.type !== type));
      setPreviewLocal((prev) => (prev?.type === type ? null : prev));
      toast.success(t(labels.success));
    } catch (err) {
      toast.error(t(labels.error));
    }
  };

  const handleDeleteAllImages = () =>
    handleDeleteAllByType("image", clearImageStore, {
      title: t("Xác nhận xóa tất cả ảnh"),
      message: t(
        "Bạn có chắc muốn xóa {{count}} ảnh khỏi bộ nhớ cục bộ? Dữ liệu sẽ không thể khôi phục."
      ),
      success: t("Đã xóa tất cả ảnh khỏi IndexedDB"),
      error: t("Không thể xóa ảnh"),
    });

  const handleDeleteAllVideos = () =>
    handleDeleteAllByType("video", clearVideoStore, {
      title: t("Xác nhận xóa tất cả video"),
      message: t(
        "Bạn có chắc muốn xóa {{count}} video khỏi bộ nhớ cục bộ? Dữ liệu sẽ không thể khôi phục."
      ),
      success: t("Đã xóa tất cả video khỏi IndexedDB"),
      error: t("Không thể xóa video"),
    });

  const handleDeleteAllAudios = () =>
    handleDeleteAllByType("audio", clearAudioStore, {
      title: t("Xác nhận xóa tất cả âm thanh"),
      message: t(
        "Bạn có chắc muốn xóa {{count}} âm thanh khỏi bộ nhớ cục bộ? Dữ liệu sẽ không thể khôi phục."
      ),
      success: t("Đã xóa tất cả âm thanh khỏi IndexedDB"),
      error: t("Không thể xóa âm thanh"),
    });

  const typeCounts = useMemo(() => {
    const counts = { all: localMedia.length, image: 0, video: 0, audio: 0 };
    localMedia.forEach((m) => {
      counts[m.type]++;
    });
    return counts;
  }, [localMedia]);

  const showInitialSpinner = localLoading && localMedia.length === 0;

  return (
    <>
      {/* Actions */}
      <div className="flex flex-wrap gap-2 justify-end items-center mb-4">
        {typeCounts.image > 0 && (
          <button
            onClick={handleDeleteAllImages}
            disabled={localLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            <RiDeleteBin6Line />
            {t("Xóa tất cả ảnh")} ({typeCounts.image})
          </button>
        )}
        {typeCounts.video > 0 && (
          <button
            onClick={handleDeleteAllVideos}
            disabled={localLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            <RiDeleteBin6Line />
            {t("Xóa tất cả video")} ({typeCounts.video})
          </button>
        )}
        {typeCounts.audio > 0 && (
          <button
            onClick={handleDeleteAllAudios}
            disabled={localLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition disabled:opacity-50"
          >
            <RiDeleteBin6Line />
            {t("Xóa tất cả âm thanh")} ({typeCounts.audio})
          </button>
        )}
        <button
          onClick={() => fetchLocalMedia({ showSpinner: true })}
          disabled={localLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition disabled:opacity-50"
        >
          <RiRefreshLine className={localLoading ? "animate-spin" : ""} />
          {t("Làm mới")}
        </button>
      </div>

      {/* Local filter bar */}
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {LOCAL_MEDIA_TYPES.map((item) => (
            <button
              key={item.value}
              onClick={() => setLocalTypeFilter(item.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                localTypeFilter === item.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {item.icon}
              {t(item.label)}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  localTypeFilter === item.value
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {typeCounts[item.value]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Input
            type="text"
            placeholder={t("Tìm theo key...")}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="   text-sm border border-gray-200 rounded-lg w-full sm:w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            prefix={<RiSearchLine />}
          />
        </div>
      </div>

      {/* Loading – chỉ full-screen lần đầu; làm mới giữ grid */}
      {showInitialSpinner && (
        <div className="flex justify-center items-center py-16">
          <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
        </div>
      )}

      {/* Empty */}
      {!showInitialSpinner && filteredMedia.length === 0 && (
        <div className="flex flex-col justify-center items-center py-16 text-gray-400">
          <RiDatabase2Line className="mb-3 text-5xl" />
          <p className="text-base">{t("Chưa có media cục bộ")}</p>
          <p className="mt-1 text-sm">{t("Ảnh, video, audio tạo từ AI sẽ được lưu tại đây")}</p>
        </div>
      )}

      {/* Grid */}
      {filteredMedia.length > 0 && (
        <div
          className={`grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${
            localLoading ? "opacity-60 pointer-events-none" : ""}`}
        >
          {filteredMedia.map((item) => (
            <LocalMediaCard
              key={item.id}
              item={item}
              onPreview={() => setPreviewLocal(item)}
              onDelete={() => handleDeleteLocal(item)}
              onDownload={() => handleDownloadLocal(item)}
            />
          ))}
        </div>
      )}

      {/* Total */}
      {filteredMedia.length > 0 && (
        <div className="mt-3 text-sm text-center text-gray-400">
          {t("Tổng")}: {filteredMedia.length} {t("media cục bộ")}
        </div>
      )}

      {/* Local preview modal */}
      {previewLocal && (
        <LocalMediaPreviewModal
          item={previewLocal}
          onClose={() => setPreviewLocal(null)}
          onDelete={() => {
            handleDeleteLocal(previewLocal);
            setPreviewLocal(null);
          }}
          onDownload={() => handleDownloadLocal(previewLocal)}
        />
      )}
    </>
  );
}

// ── Local Media Card ───────────────────────────────────────────────────────

function LocalMediaCard({
  item,
  onPreview,
  onDelete,
  onDownload,
}: {
  item: LocalMediaItem;
  onPreview: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const { t } = useTranslation();

  const typeLabel = item.type === "image" ? "Ảnh" : item.type === "video" ? "Video" : "Audio";
  const typeBg =
    item.type === "image"
      ? "bg-emerald-500/80"
      : item.type === "video"
      ? "bg-blue-500/80"
      : "bg-purple-500/80";
  const fileBase = String(item.key);

  return (
    <div className="overflow-hidden bg-white rounded-xl border border-gray-100 transition-shadow group hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative bg-gray-50 cursor-pointer aspect-square" onClick={onPreview}>
        {item.type === "image" && (
          <img
            src={item.previewUrl}
            className="object-cover w-full h-full"
            alt="local-image"
            loading="lazy"
          />
        )}
        {item.type === "video" && (
          <div className="flex justify-center items-center w-full h-full bg-gradient-to-br from-gray-800 to-gray-900">
            {item.previewUrl && (
              <video
                src={item.previewUrl}
                className="object-cover w-full h-full opacity-70"
                muted
                preload="metadata"
              />
            )}
            <RiPlayCircleLine className="absolute text-5xl drop-shadow-lg text-white/80" />
          </div>
        )}
        {item.type === "audio" && (
          <div className="flex flex-col gap-2 justify-center items-center w-full h-full bg-gradient-to-br from-purple-50 to-indigo-50">
            <RiMusic2Line className="text-4xl text-purple-400" />
            <span className="text-xs text-purple-400">{t("Âm thanh")}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="flex absolute inset-0 gap-2 justify-center items-center opacity-0 transition-opacity bg-black/30 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-2 text-white rounded-full backdrop-blur-sm bg-white/20 hover:bg-white/30"
          >
            <RiZoomInLine className="text-lg" />
          </button>
          {item.type === "audio" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-2 text-white rounded-full backdrop-blur-sm bg-white/20 hover:bg-white/30"
            >
              <RiDownloadLine className="text-lg" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-white rounded-full backdrop-blur-sm bg-red-500/60 hover:bg-red-500/80"
          >
            <RiDeleteBin6Line className="text-lg" />
          </button>
        </div>

        {/* Type badge */}
        <span
          className={`absolute px-2 py-0.5 text-xs font-medium text-white rounded-full top-2 left-2 ${typeBg} backdrop-blur-sm`}
        >
          {t(typeLabel)}
        </span>

        {/* Local badge */}
        <span className="absolute px-2 py-0.5 text-xs font-medium text-indigo-600 bg-indigo-100 rounded-full top-2 right-2">
          Local
        </span>
      </div>

      {/* Info + upsample download */}
      <div className="p-2.5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500 truncate max-w-[120px]" title={fileBase}>
            {fileBase}
          </span>
          <span className="text-xs text-gray-400">{item.mimeType}</span>
        </div>
        {item.type === "image" && item.imageData && (
          <div onClick={(e) => e.stopPropagation()}>
            <GeneratedImageDownloadButtons
              image={item.imageData}
              fileName={`${fileBase}.png`}
              show1kLabel
            />
          </div>
        )}
        {item.type === "video" && item.videoData && (
          <div onClick={(e) => e.stopPropagation()}>
            <GeneratedVideoDownloadButtons
              video={item.videoData}
              fileName={`${fileBase}.mp4`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Local Media Preview Modal ──────────────────────────────────────────────

function LocalMediaPreviewModal({
  item,
  onClose,
  onDelete,
  onDownload,
}: {
  item: LocalMediaItem;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const { t } = useTranslation();
  const fileBase = String(item.key);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="overflow-hidden relative mx-4 w-full max-w-3xl bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex gap-2 items-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-indigo-50 text-indigo-600">
              {item.type === "image" && <RiImageLine />}
              {item.type === "video" && <RiVideoLine />}
              {item.type === "audio" && <RiMusic2Line />}
              {item.type}
            </span>
            <span className="text-sm text-gray-400 truncate max-w-[200px]" title={fileBase}>
              Key: {fileBase}
            </span>
            <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
              IndexedDB
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <RiCloseLine className="text-xl text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex items-center justify-center p-4 bg-gray-50 max-h-[70vh] overflow-auto">
          {item.type === "image" && (
            <img
              src={item.previewUrl}
              alt="preview"
              className="object-contain max-w-full rounded-lg max-h-[60vh]"
            />
          )}
          {item.type === "video" && (
            <video
              src={item.previewUrl}
              controls
              autoPlay
              className="max-w-full rounded-lg max-h-[60vh]"
            />
          )}
          {item.type === "audio" && (
            <div className="flex flex-col gap-4 items-center py-8">
              <RiMusic2Line className="text-6xl text-purple-400" />
              <audio src={item.previewUrl} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 justify-end items-center p-4 border-t">
          {item.type === "image" && item.imageData && (
            <GeneratedImageDownloadButtons
              image={item.imageData}
              fileName={`${fileBase}.png`}
              show1kLabel
            />
          )}
          {item.type === "video" && item.videoData && (
            <GeneratedVideoDownloadButtons
              video={item.videoData}
              fileName={`${fileBase}.mp4`}
            />
          )}
          {item.type === "audio" && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <RiDownloadLine />
              {t("Tải xuống")}
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition"
          >
            <RiDeleteBin6Line />
            {t("Xóa")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Server Media Card ──────────────────────────────────────────────────────

function MediaCard({
  media,
  onPreview,
  onDelete,
  onDownload,
  formatFileSize,
  formatDate,
}: {
  media: CustomerGenerationMedia;
  onPreview: () => void;
  onDelete: () => void;
  onDownload: () => void;
  formatFileSize: (bytes?: number) => string;
  formatDate: (date: string) => string;
}) {
  const { t } = useTranslation();
  const fileBase = `media-${media.id}`;
  const canUpsampleImage = media.type === "image" && !!media.url;
  const canUpsampleVideo = media.type === "video" && !!media.url;
  const showPlainDownload = media.type === "audio" || media.type === "file" || !media.url;

  return (
    <div className="overflow-hidden bg-white rounded-xl border border-gray-100 transition-shadow group hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative bg-gray-50 cursor-pointer aspect-square" onClick={onPreview}>
        {media.type === "image" && (
          <Img
            src={media.url}
            className="object-cover w-full h-full"
            imageClassName="object-cover"
            lazyload
          />
        )}
        {media.type === "video" && (
          <div className="flex justify-center items-center w-full h-full bg-gradient-to-br from-gray-800 to-gray-900">
            {media.url ? (
              <video
                src={media.url}
                className="object-cover w-full h-full opacity-70"
                muted
                preload="metadata"
              />
            ) : null}
            <RiPlayCircleLine className="absolute text-5xl drop-shadow-lg text-white/80" />
          </div>
        )}
        {media.type === "audio" && (
          <div className="flex flex-col gap-2 justify-center items-center w-full h-full bg-gradient-to-br from-purple-50 to-indigo-50">
            <RiMusic2Line className="text-4xl text-purple-400" />
            <span className="text-xs text-purple-400">{t("Âm thanh")}</span>
          </div>
        )}
        {media.type === "file" && (
          <div className="flex flex-col gap-2 justify-center items-center w-full h-full bg-gradient-to-br from-blue-50 to-cyan-50">
            <RiFileLine className="text-4xl text-blue-400" />
            <span className="text-xs text-blue-400">{media.mimeType || t("Tệp")}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="flex absolute inset-0 gap-2 justify-center items-center opacity-0 transition-opacity bg-black/30 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-2 text-white rounded-full backdrop-blur-sm bg-white/20 hover:bg-white/30"
          >
            <RiZoomInLine className="text-lg" />
          </button>
          {showPlainDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-2 text-white rounded-full backdrop-blur-sm bg-white/20 hover:bg-white/30"
            >
              <RiDownloadLine className="text-lg" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-white rounded-full backdrop-blur-sm bg-red-500/60 hover:bg-red-500/80"
          >
            <RiDeleteBin6Line className="text-lg" />
          </button>
        </div>

        {/* Type badge */}
        <span className="absolute px-2 py-0.5 text-xs font-medium text-white rounded-full top-2 left-2 bg-black/40 backdrop-blur-sm">
          {media.type}
        </span>
      </div>

      {/* Info + upsample download */}
      <div className="p-2.5 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">{formatDate(media.createdAt)}</span>
          {media.size ? (
            <span className="text-xs text-gray-400">{formatFileSize(media.size)}</span>
          ) : null}
        </div>
        {canUpsampleImage && (
          <div onClick={(e) => e.stopPropagation()}>
            <GeneratedImageDownloadButtons
              image={customerMediaToImageLike(media)}
              fileName={`${fileBase}.png`}
              show1kLabel
            />
          </div>
        )}
        {canUpsampleVideo && (
          <div onClick={(e) => e.stopPropagation()}>
            <GeneratedVideoDownloadButtons
              video={customerMediaToVideoLike(media)}
              fileName={`${fileBase}.mp4`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function MediaPreviewModal({
  media,
  onClose,
  onDelete,
  onDownload,
  formatFileSize,
  formatDate,
}: {
  media: CustomerGenerationMedia;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  formatFileSize: (bytes?: number) => string;
  formatDate: (date: string) => string;
}) {
  const { t } = useTranslation();
  const fileBase = `media-${media.id}`;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="overflow-hidden relative mx-4 w-full max-w-3xl bg-white rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
              {media.type === "image" && <RiImageLine />}
              {media.type === "video" && <RiVideoLine />}
              {media.type === "audio" && <RiMusic2Line />}
              {media.type === "file" && <RiFileLine />}
              {media.type}
            </span>
            <span className="ml-3 text-sm text-gray-400">{formatDate(media.createdAt)}</span>
            {media.size ? (
              <span className="ml-2 text-sm text-gray-400">{formatFileSize(media.size)}</span>
            ) : null}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <RiCloseLine className="text-xl text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex items-center justify-center p-4 bg-gray-50 max-h-[70vh] overflow-auto">
          {media.type === "image" && media.url && (
            <img
              src={media.url}
              alt="preview"
              className="object-contain max-w-full rounded-lg max-h-[60vh]"
            />
          )}
          {media.type === "video" && media.url && (
            <video
              src={media.url}
              controls
              autoPlay
              className="max-w-full rounded-lg max-h-[60vh]"
            />
          )}
          {media.type === "audio" && media.url && (
            <div className="flex flex-col gap-4 items-center py-8">
              <RiMusic2Line className="text-6xl text-purple-400" />
              <audio src={media.url} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
          {media.type === "file" && (
            <div className="flex flex-col gap-4 items-center py-8">
              <RiFileLine className="text-6xl text-blue-400" />
              <p className="text-gray-500">{media.mimeType || t("Tệp")}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 justify-end items-center p-4 border-t">
          {media.type === "image" && media.url && (
            <GeneratedImageDownloadButtons
              image={customerMediaToImageLike(media)}
              fileName={`${fileBase}.png`}
              show1kLabel
            />
          )}
          {media.type === "video" && media.url && (
            <GeneratedVideoDownloadButtons
              video={customerMediaToVideoLike(media)}
              fileName={`${fileBase}.mp4`}
            />
          )}
          {(media.type === "audio" || media.type === "file") && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <RiDownloadLine />
              {t("Tải xuống")}
            </button>
          )}
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition"
          >
            <RiDeleteBin6Line />
            {t("Xóa")}
          </button>
        </div>
      </div>
    </div>
  );
}
