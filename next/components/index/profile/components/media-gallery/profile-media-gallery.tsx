import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiDeleteBin6Line,
  RiDownloadLine,
  RiFileLine,
  RiFilterLine,
  RiImageLine,
  RiLoader4Line,
  RiMusic2Line,
  RiPlayCircleLine,
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
import { Img } from "../../../../shared/utilities/misc";

const MEDIA_TYPES: { value: CustomerMediaType | "all"; label: string; icon: JSX.Element }[] = [
  { value: "all", label: "Tất cả", icon: <RiFilterLine /> },
  { value: "image", label: "Ảnh", icon: <RiImageLine /> },
  { value: "video", label: "Video", icon: <RiVideoLine /> },
  { value: "audio", label: "Âm thanh", icon: <RiMusic2Line /> },
  { value: "file", label: "Tệp", icon: <RiFileLine /> },
];

const PAGE_SIZE = 12;

export function ProfileMediaGallery() {
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
    <div className="p-4 bg-white rounded-md min-h-[400px]">
      <div className="flex gap-2 items-center px-3 py-2 border-gray-100">
        <RiImageLine className="text-xl text-primary" />
        <div>
          <p className="font-semibold text-gray-800">{t("Thư viện Media")}</p>
        </div>
      </div>

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
          <RiSearchLine className="absolute text-gray-400 -translate-y-1/2 left-3 top-1/2" />
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
        <div className="flex items-center justify-center py-20">
          <RiLoader4Line className="text-3xl animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!loading && mediaList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <RiImageLine className="mb-3 text-5xl" />
          <p className="text-base">{t("Chưa có media nào")}</p>
          <p className="mt-1 text-sm">{t("Media bạn tạo từ AI sẽ xuất hiện ở đây")}</p>
        </div>
      )}

      {/* Gallery grid */}
      {!loading && mediaList.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
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
        <div className="flex items-center justify-center gap-2 mt-6">
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
    </div>
  );
}

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

  return (
    <div className="overflow-hidden transition-shadow bg-white border border-gray-100 rounded-xl group hover:shadow-lg">
      {/* Thumbnail */}
      <div className="relative cursor-pointer aspect-square bg-gray-50" onClick={onPreview}>
        {media.type === "image" && (
          <Img
            src={media.url}
            className="object-cover w-full h-full"
            imageClassName="object-cover"
            lazyload
          />
        )}
        {media.type === "video" && (
          <div className="flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-800 to-gray-900">
            {media.url ? (
              <video
                src={media.url}
                className="object-cover w-full h-full opacity-70"
                muted
                preload="metadata"
              />
            ) : null}
            <RiPlayCircleLine className="absolute text-5xl text-white/80 drop-shadow-lg" />
          </div>
        )}
        {media.type === "audio" && (
          <div className="flex flex-col items-center justify-center w-full h-full gap-2 bg-gradient-to-br from-purple-50 to-indigo-50">
            <RiMusic2Line className="text-4xl text-purple-400" />
            <span className="text-xs text-purple-400">{t("Âm thanh")}</span>
          </div>
        )}
        {media.type === "file" && (
          <div className="flex flex-col items-center justify-center w-full h-full gap-2 bg-gradient-to-br from-blue-50 to-cyan-50">
            <RiFileLine className="text-4xl text-blue-400" />
            <span className="text-xs text-blue-400">{media.mimeType || t("Tệp")}</span>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 transition-opacity opacity-0 bg-black/30 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            className="p-2 text-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
          >
            <RiZoomInLine className="text-lg" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="p-2 text-white rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30"
          >
            <RiDownloadLine className="text-lg" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-white rounded-full bg-red-500/60 backdrop-blur-sm hover:bg-red-500/80"
          >
            <RiDeleteBin6Line className="text-lg" />
          </button>
        </div>

        {/* Type badge */}
        <span className="absolute px-2 py-0.5 text-xs font-medium text-white rounded-full top-2 left-2 bg-black/40 backdrop-blur-sm">
          {media.type}
        </span>
      </div>

      {/* Info */}
      <div className="p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(media.createdAt)}</span>
          {media.size ? (
            <span className="text-xs text-gray-400">{formatFileSize(media.size)}</span>
          ) : null}
        </div>
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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl mx-4 overflow-hidden bg-white shadow-2xl rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
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
            <div className="flex flex-col items-center gap-4 py-8">
              <RiMusic2Line className="text-6xl text-purple-400" />
              <audio src={media.url} controls autoPlay className="w-full max-w-md" />
            </div>
          )}
          {media.type === "file" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <RiFileLine className="text-6xl text-blue-400" />
              <p className="text-gray-500">{media.mimeType || t("Tệp")}</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            <RiDownloadLine />
            {t("Tải xuống")}
          </button>
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
