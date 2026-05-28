/**
 * video-upload-picker.tsx
 *
 * A standalone component that allows users to:
 * 1. Upload a video (drag-and-drop or click to browse) — max 50MB, video/* only
 * 2. Browse previously uploaded videos stored in IndexedDB
 * 3. Search / filter the gallery to find a specific video
 * 4. Select a video — the result is emitted as { base64, mimeType }
 *
 * Tailwind CSS className only — no inline styles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiPlayCircle } from "react-icons/bi";
import {
  RiCheckLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEyeLine,
  RiFullscreenLine,
  RiLoader4Line,
  RiSearchLine,
  RiUploadCloud2Line,
  RiVideoLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { VideoDialog } from "../../../../shared/common/video-dialog";
import { Button, Input, Label } from "../../../../shared/utilities/form";
import { DB_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";

// ── Types ────────────────────────────────────────────────────────────────────

export interface VideoPickerResult {
  /** Raw base64 string (no data-URI prefix) */
  base64: string;
  /** e.g. "video/mp4", "video/webm" */
  mimeType: string;
}

export interface VideoUploadPickerProps {
  /** Called when a video is selected (upload or gallery pick) */
  onSelect?: (result: VideoPickerResult) => void;
  /** Maximum file size in MB (default 50) */
  maxSizeMB?: number;
  /** Currently selected video (controlled) */
  value?: VideoPickerResult | null;
  /** Label shown above the component */
  label?: string;
}

// ── IndexedDB store for uploaded videos ──────────────────────────────────────

const VIDEO_STORE_NAME = "uploaded-videos";
const VIDEO_DB_NAME = DB_NAME.copyVideo;

interface StoredVideo {
  base64: string;
  mimeType: string;
  fileName: string;
  fileSizeMB: string;
  uploadedAt: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const ACCEPTED_EXTENSIONS = ".mp4,.webm,.mov,.mkv";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a base64 string + mimeType into a Blob URL (same-origin, CSP-safe). */
function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

// ── Component ────────────────────────────────────────────────────────────────

export function VideoUploadPicker({
  onSelect,
  maxSizeMB = 50,
  value,
  label,
}: VideoUploadPickerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ──
  const [uploading, setUploading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoPickerResult | null>(value ?? null);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryItems, setGalleryItems] = useState<{ key: string; data: StoredVideo }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [galleryPreviewSrc, setGalleryPreviewSrc] = useState<string | null>(null);

  // IndexedDB for persisting uploaded videos
  const videoDB = useIndexedDB<StoredVideo>(VIDEO_STORE_NAME, VIDEO_DB_NAME);

  // Sync controlled value
  useEffect(() => {
    if (value !== undefined) setSelectedVideo(value);
  }, [value]);

  // ── File → base64 ─────────────────────────────────────────────────────────

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        if (base64) resolve(base64);
        else reject(new Error("Failed to read file as base64"));
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  // ── Handle file selection ──────────────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      // Validate type
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
        toast.error(t("Chỉ hỗ trợ file video (mp4, webm, mov, mkv)"));
        return;
      }
      // Validate size
      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(
          `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSizeMB}MB, ${t("file")}: ${sizeMB.toFixed(
            1
          )}MB`
        );
        return;
      }

      try {
        setUploading(true);
        const base64 = await fileToBase64(file);
        const mimeType = file.type || "video/mp4";
        const result: VideoPickerResult = { base64, mimeType };

        // Save to IndexedDB for gallery
        const storeKey = `${file.name}_${Date.now()}`;
        await videoDB.set(storeKey, {
          base64,
          mimeType,
          fileName: file.name,
          fileSizeMB: sizeMB.toFixed(2),
          uploadedAt: Date.now(),
        });

        setSelectedVideo(result);
        onSelect?.(result);
        toast.success(t("Đã upload video thành công"));
      } catch (err) {
        console.error("[VideoUploadPicker] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý video. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, onSelect, t, toast, videoDB]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  // ── Gallery ────────────────────────────────────────────────────────────────

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    try {
      const entries = await videoDB.getAllWithKeys();
      const items = entries
        .filter((e) => e.value?.base64)
        .map((e) => ({ key: String(e.key), data: e.value }))
        .sort((a, b) => (b.data.uploadedAt || 0) - (a.data.uploadedAt || 0)); // newest first
      setGalleryItems(items);
    } catch (err) {
      console.error("[VideoUploadPicker] Error loading gallery:", err);
    } finally {
      setGalleryLoading(false);
    }
  }, [videoDB]);

  const openGallery = () => {
    setShowGallery(true);
    loadGallery();
  };

  const handleGallerySelect = (item: StoredVideo) => {
    const result: VideoPickerResult = { base64: item.base64, mimeType: item.mimeType };
    setSelectedVideo(result);
    onSelect?.(result);
    setShowGallery(false);
    toast.success(t("Đã chọn video từ thư viện"));
  };

  const handleDeleteGalleryItem = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await videoDB.remove(key);
      setGalleryItems((prev) => prev.filter((item) => item.key !== key));
      toast.success(t("Đã xóa video"));
    } catch (err) {
      console.error("[VideoUploadPicker] Error deleting:", err);
    }
  };

  // ── Clear selection ────────────────────────────────────────────────────────

  const handleClear = () => {
    setSelectedVideo(null);
    onSelect?.(null as any);
  };

  // ── Filtered gallery items ─────────────────────────────────────────────────

  const filteredItems = searchQuery?.trim()
    ? galleryItems.filter((item) =>
        item.data.fileName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : galleryItems;

  // ── Video preview src (Blob URL — CSP-safe, no data: URI) ─────────────────

  const selectedVideoSrc = useMemo(() => {
    if (!selectedVideo?.base64) return null;
    return base64ToBlobUrl(selectedVideo.base64, selectedVideo.mimeType);
  }, [selectedVideo?.base64, selectedVideo?.mimeType]);

  // Revoke blob URL when it changes or component unmounts
  useEffect(() => {
    return () => {
      if (selectedVideoSrc) URL.revokeObjectURL(selectedVideoSrc);
    };
  }, [selectedVideoSrc]);

  // ── Gallery blob URLs (memoized + auto-revoked) ───────────────────────────

  const galleryBlobUrls = useMemo(() => {
    if (!showGallery) return new Map<string, string>();
    const map = new Map<string, string>();
    filteredItems.forEach((item) => {
      map.set(item.key, base64ToBlobUrl(item.data.base64, item.data.mimeType));
    });
    return map;
  }, [showGallery, filteredItems]);

  // Revoke gallery blob URLs when they change or gallery closes
  useEffect(() => {
    return () => {
      galleryBlobUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [galleryBlobUrls]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      {/* Label */}
      {label && <Label text={label} />}

      {/* Selected video preview */}
      {selectedVideo && selectedVideoSrc ? (
        <div className="relative rounded-xl overflow-hidden border-2 border-indigo-200 bg-gray-900 group">
          <div className="relative" style={{ paddingTop: "56.25%" }}>
            <video
              src={selectedVideoSrc}
              className="absolute inset-0 w-full h-full object-contain bg-black cursor-pointer"
              muted
              loop
              playsInline
              preload="metadata"
              onClick={() => setShowVideoPreview(true)}
              onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
              onMouseLeave={(e) => {
                const v = e.target as HTMLVideoElement;
                v.pause();
                v.currentTime = 0;
              }}
            />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
              <div className="w-12 h-12 rounded-full bg-white/80 flex items-center justify-center">
                <BiPlayCircle className="text-indigo-600 w-14 h-14" />
              </div>
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
            <span className="text-xs text-gray-500 truncate">
              {selectedVideo.mimeType} •{" "}
              {((selectedVideo.base64.length * 0.75) / (1024 * 1024)).toFixed(1)}MB
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => setShowVideoPreview(true)}
                icon={<RiFullscreenLine />}
                className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-500 hover:bg-indigo-100"
                iconClassName="text-base"
                tooltip={t("Phóng to")}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                icon={<RiUploadCloud2Line />}
                className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-100"
                iconClassName="text-base"
                tooltip={t("Upload video khác")}
              />
              <Button
                onClick={openGallery}
                icon={<RiVideoLine />}
                className="w-7 h-7 rounded-lg bg-purple-50 text-purple-500 hover:bg-purple-100"
                iconClassName="text-base"
                tooltip={t("Chọn từ thư viện")}
              />
              <Button
                onClick={handleClear}
                icon={<RiCloseLine />}
                className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                iconClassName="text-base"
                tooltip={t("Xóa")}
              />
            </div>
          </div>
          {/* Fullscreen Video Preview */}
          <VideoDialog
            videoUrl={selectedVideoSrc}
            isOpen={showVideoPreview}
            onClose={() => setShowVideoPreview(false)}
          />
        </div>
      ) : (
        /* Upload area — drag & drop */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 cursor-pointer transition-all ${
            dragOver
              ? "border-indigo-400 bg-indigo-50"
              : "border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
              <span className="text-sm text-indigo-600 font-medium">{t("Đang xử lý")}...</span>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mb-2">
                <RiUploadCloud2Line className="text-2xl text-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {t("Kéo thả hoặc bấm để chọn video")}
              </span>
              <span className="text-xs text-gray-400 mt-1">
                MP4, WebM, MOV, MKV • {t("Tối đa")} {maxSizeMB}MB
              </span>
            </>
          )}
        </div>
      )}

      {/* Gallery toggle button (shown when no video selected) */}
      {!selectedVideo && galleryItems.length > 0 && (
        <button
          type="button"
          onClick={openGallery}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors cursor-pointer"
        >
          <RiVideoLine className="text-sm" />
          {t("Chọn từ thư viện video")}
        </button>
      )}

      {/* Also show gallery button when no video selected and gallery is empty — only after first load */}
      {!selectedVideo && (
        <button
          type="button"
          onClick={openGallery}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-purple-600 hover:bg-purple-50 transition-colors cursor-pointer border-0 bg-transparent"
        >
          <RiVideoLine className="text-sm" />
          {t("Xem thư viện video")}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Gallery overlay ── */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            {/* Gallery header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <RiVideoLine className="text-purple-600 text-base" />
                </div>
                <span className="text-base font-bold text-gray-800">{t("Thư viện Video")}</span>
                {!galleryLoading && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {filteredItems.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer border-0 transition-colors"
              >
                <RiCloseLine className="text-lg text-gray-600" />
              </button>
            </div>

            {/* Search bar */}
            <div
              className="px-5 py-3 border-b border-gray-50"
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
            >
              <Input
                prefix={<RiSearchLine />}
                placeholder={t("Tìm theo tên file...")}
                value={searchQuery}
                onChange={(val) => setSearchQuery(val)}
                className="w-full text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
              />
            </div>

            {/* Gallery body */}
            <div className="flex-1 overflow-y-auto vw-scrool p-5">
              {/* Loading */}
              {galleryLoading && (
                <div className="flex items-center justify-center py-16">
                  <RiLoader4Line className="text-3xl animate-spin text-purple-500" />
                </div>
              )}

              {/* Empty */}
              {!galleryLoading && filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <RiVideoLine className="mb-3 text-5xl" />
                  <p className="text-base font-medium">{t("Chưa có video nào")}</p>
                  <p className="mt-1 text-sm">{t("Upload video để bắt đầu")}</p>
                </div>
              )}

              {/* Grid */}
              {!galleryLoading && filteredItems.length > 0 && (
                <div className="grid grid-cols-2 gap-3  v-scrollbar max-h-96 overflow-y-auto">
                  {filteredItems.map((item) => {
                    const videoSrc = galleryBlobUrls.get(item.key) || "";
                    return (
                      <div
                        key={item.key}
                        className="relative rounded-xl overflow-hidden border-2 border-transparent hover:border-purple-300 group transition-all hover:shadow-lg bg-gray-50"
                      >
                        {/* Video thumbnail */}
                        <div className="relative" style={{ paddingTop: "56.25%" }}>
                          <video
                            src={videoSrc}
                            className="absolute inset-0 w-full h-full object-cover"
                            muted
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={(e) => {
                              const v = e.target as HTMLVideoElement;
                              v.pause();
                              v.currentTime = 0;
                            }}
                          />
                          {/* Play overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
                            <BiPlayCircle className="text-white w-10 h-10" />
                          </div>
                          {/* Action buttons overlay on hover */}
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Xem (View/Preview) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setGalleryPreviewSrc(videoSrc);
                              }}
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-lg cursor-pointer border-0 transition-colors"
                            >
                              <RiEyeLine className="text-sm" />
                              {t("Xem")}
                            </button>
                            {/* Chọn (Select) */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGallerySelect(item.data);
                              }}
                              className="flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-full shadow-lg cursor-pointer border-0 transition-colors"
                            >
                              <RiCheckLine className="text-sm" />
                              {t("Chọn")}
                            </button>
                          </div>
                        </div>

                        {/* Info */}
                        <div className="px-2.5 py-2 bg-white border-t border-gray-100">
                          <p
                            className="text-xs font-medium text-gray-700 truncate"
                            title={item.data.fileName}
                          >
                            {item.data.fileName}
                          </p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-xs truncate max-w-28 text-gray-400">
                              {item.data.fileSizeMB}MB •{" "}
                              {new Date(item.data.uploadedAt).toLocaleDateString()}
                            </span>
                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteGalleryItem(item.key, e)}
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-0 bg-transparent opacity-0 group-hover:opacity-100"
                              title={t("Xóa")}
                            >
                              <RiDeleteBin6Line className="text-xs" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gallery footer — upload more */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-400">
                {filteredItems.length} {t("video")}
              </span>
              <Button
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowGallery(false);
                }}
                icon={<RiUploadCloud2Line />}
                text={t("Upload thêm")}
                className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700"
              />
            </div>

            {/* Gallery video preview dialog */}
            <VideoDialog
              videoUrl={galleryPreviewSrc}
              isOpen={!!galleryPreviewSrc}
              onClose={() => setGalleryPreviewSrc(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
