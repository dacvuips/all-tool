/**
 * Upload nhiều ảnh + video cho Xóa Logo AI
 * Danh sách chờ: click / nút zoom xem lớn, nút xóa item
 */
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiDeleteBinLine,
  RiImage2Line,
  RiRefreshLine,
  RiSearchEyeLine,
  RiUploadCloud2Line,
  RiVideoLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { uid } from "../../constants";
import {
  formatFileSize,
  REMOVE_LOGO_ACCEPT,
  REMOVE_LOGO_IMAGE_MAX_MB,
  REMOVE_LOGO_IMAGE_TYPES,
  REMOVE_LOGO_MAX_FILES,
  REMOVE_LOGO_VIDEO_MAX_MB,
  REMOVE_LOGO_VIDEO_TYPES,
  RemoveLogoMediaKind,
  RemoveLogoUploadItem,
} from "../constants";
import { useRemoveLogoContext } from "../providers/remove-logo-provider";
import { RemoveLogoMediaLightbox } from "../right-panel/remove-logo-media-lightbox";

function detectKind(file: File): RemoveLogoMediaKind | null {
  if (REMOVE_LOGO_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return "image";
  }
  if (REMOVE_LOGO_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov)$/i.test(file.name)) {
    return "video";
  }
  return null;
}

function mimeFromFile(file: File, kind: RemoveLogoMediaKind): string {
  if (file.type) {
    if (file.type === "image/jpg") return "image/jpeg";
    return file.type;
  }
  if (kind === "video") {
    if (/\.webm$/i.test(file.name)) return "video/webm";
    if (/\.mov$/i.test(file.name)) return "video/quicktime";
    return "video/mp4";
  }
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  if (/\.gif$/i.test(file.name)) return "image/gif";
  return "image/jpeg";
}

function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

type PreviewState = {
  kind: RemoveLogoMediaKind;
  url: string;
  name: string;
} | null;

export function RemoveLogoUpload({ onRetry }: { onRetry?: (id: string) => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploads, setUploads, running } = useRemoveLogoContext();
  const [dragOver, setDragOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList || []);
      if (!files.length) return;

      const remaining = REMOVE_LOGO_MAX_FILES - uploads.length;
      if (remaining <= 0) {
        toast.error(t("Tối đa {{count}} file mỗi lần", { count: REMOVE_LOGO_MAX_FILES }));
        return;
      }

      setReading(true);
      const next: RemoveLogoUploadItem[] = [];

      for (const file of files.slice(0, remaining)) {
        const kind = detectKind(file);
        if (!kind) {
          toast.error(`${file.name}: ${t("Định dạng không hỗ trợ")}`);
          continue;
        }

        const maxMb = kind === "video" ? REMOVE_LOGO_VIDEO_MAX_MB : REMOVE_LOGO_IMAGE_MAX_MB;
        const sizeMb = file.size / (1024 * 1024);
        if (sizeMb > maxMb) {
          toast.error(
            `${file.name}: ${t("File quá lớn")}. ${t("Tối đa")} ${maxMb}MB (${sizeMb.toFixed(1)}MB)`
          );
          continue;
        }

        try {
          const mediaBase64 = await readFileBase64(file);
          const mimeType = mimeFromFile(file, kind);
          const previewUrl = URL.createObjectURL(file);
          next.push({
            id: uid(),
            kind,
            name: file.name,
            mimeType,
            sizeBytes: file.size,
            mediaBase64,
            previewUrl,
            status: "ready",
          });
        } catch {
          toast.error(`${file.name}: ${t("Không đọc được file")}`);
        }
      }

      if (next.length) {
        setUploads((prev) => [...prev, ...next].slice(0, REMOVE_LOGO_MAX_FILES));
      }
      setReading(false);
    },
    [setUploads, toast, t, uploads.length]
  );

  const openPreview = (item: RemoveLogoUploadItem) => {
    if (!item.previewUrl) return;
    setPreview({ kind: item.kind, url: item.previewUrl, name: item.name });
  };

  const removeUpload = (id: string) => {
    setUploads((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
    setPreview((cur) => {
      if (!cur) return cur;
      const still = uploads.some((u) => u.id !== id && u.previewUrl === cur.url);
      return still ? cur : null;
    });
  };

  /** Đưa item đã xong về trạng thái chờ để tạo lại */
  const retryUpload = (id: string) => {
    if (running) {
      toast.warn(t("Đang xử lý, vui lòng đợi..."));
      return;
    }
    if (onRetry) {
      void onRetry(id);
      return;
    }
    // fallback: chỉ reset status chờ (batch CTA)
    setUploads((prev) =>
      prev.map((u) =>
        u.id === id && u.status === "done"
          ? { ...u, status: "ready" as const, errorMessage: undefined }
          : u
      )
    );
    toast.success(t("Đã đưa vào danh sách chờ tạo lại"));
  };

  const clearAll = () => {
    setUploads((prev) => {
      prev.forEach((p) => {
        if (p.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl);
      });
      return [];
    });
    setPreview(null);
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <div
        className={`relative flex flex-col justify-center items-center px-4 py-8 text-center rounded-2xl border-2 border-dashed transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary-light"
            : "border-gray-200 bg-gray-50 hover:border-primary hover:bg-primary-light"
        } ${running ? "pointer-events-none opacity-60" : ""}`}
        onClick={() => !running && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!running) void processFiles(e.dataTransfer.files);
        }}
      >
        <RiUploadCloud2Line className="mb-2 text-3xl text-primary" />
        <p className="text-sm font-semibold text-gray-700">
          {reading ? t("Đang đọc file...") : t("Kéo thả hoặc chọn ảnh / video")}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {t("Ảnh ≤ {{img}}MB (JPG/PNG/WebP/GIF) · Video ≤ {{vid}}MB (MP4/WebM/MOV)", {
            img: REMOVE_LOGO_IMAGE_MAX_MB,
            vid: REMOVE_LOGO_VIDEO_MAX_MB,
          })}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">
          {t("Tối đa {{count}} file · có thể chọn nhiều", { count: REMOVE_LOGO_MAX_FILES })}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={REMOVE_LOGO_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void processFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-600">
              {t("Danh sách chờ")} ({uploads.length})
            </span>
            <button
              type="button"
              disabled={running}
              onClick={clearAll}
              className="text-xs font-medium text-red-500 hover:underline disabled:opacity-40"
            >
              {t("Bỏ hết")}
            </button>
          </div>
          <ul className="overflow-y-auto space-y-2 max-h-64 v-scrollbar">
            {uploads.map((item) => (
              <li
                key={item.id}
                className="flex gap-2 items-center p-2 bg-white rounded-xl border border-gray-100"
              >
                <button
                  type="button"
                  onClick={() => openPreview(item)}
                  className="overflow-hidden relative flex-shrink-0 w-12 h-12 bg-gray-100 rounded-lg border-0 cursor-pointer group"
                  title={t("Xem lớn")}
                >
                  {item.kind === "video" ? (
                    <video src={item.previewUrl} className="object-cover w-full h-full" muted />
                  ) : (
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="object-cover w-full h-full"
                    />
                  )}
                  <span className="flex absolute inset-0 justify-center items-center opacity-0 transition-opacity bg-black/40 group-hover:opacity-100">
                    <RiSearchEyeLine className="text-lg text-white" />
                  </span>
                </button>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => openPreview(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") openPreview(item);
                  }}
                >
                  <p className="text-xs font-semibold text-gray-800 truncate" title={item.name}>
                    {item.name}
                  </p>
                  <p className="flex gap-1 items-center text-xs text-gray-400">
                    {item.kind === "video" ? (
                      <RiVideoLine className="text-primary" />
                    ) : (
                      <RiImage2Line className="text-primary" />
                    )}
                    {formatFileSize(item.sizeBytes)}
                    {item.status === "error" && (
                      <span className="text-red-500 truncate"> · {item.errorMessage}</span>
                    )}
                    {item.status === "skipped" && (
                      <span className="text-amber-600 truncate"> · {item.errorMessage}</span>
                    )}
                    {item.status === "processing" && (
                      <span className="text-primary"> · {t("Đang xử lý...")}</span>
                    )}
                    {item.status === "done" && (
                      <span className="text-green-600"> · {t("Xong")}</span>
                    )}
                  </p>
                </div>

                {/* Tạo lại — chỉ hiện khi item đã xong */}
                {item.status === "done" && (
                  <button
                    type="button"
                    disabled={running}
                    onClick={() => retryUpload(item.id)}
                    className="flex flex-shrink-0 justify-center items-center w-7 h-7 text-primary bg-primary-light rounded-full border-0 cursor-pointer hover:bg-primary hover:text-white disabled:opacity-40"
                    title={t("Tạo lại")}
                  >
                    <RiRefreshLine className="text-base" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={running && item.status === "processing"}
                  onClick={() => removeUpload(item.id)}
                  className="flex flex-shrink-0 justify-center items-center w-7 h-7 text-red-500 bg-red-50 rounded-full border-0 cursor-pointer hover:bg-red-500 hover:text-white disabled:opacity-40"
                  title={t("Xóa khỏi danh sách")}
                >
                  <RiDeleteBinLine className="text-base" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <RemoveLogoMediaLightbox
          open
          kind={preview.kind}
          src={preview.url}
          title={preview.name}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
