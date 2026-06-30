/**
 * element-images-upload.tsx
 * Upload ảnh cho artStyleImg, objectImg, itemImg – kéo thả hoặc chọn file.
 * Tailwind CSS className only – no inline styles.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiRefreshLine,
  RiUploadCloud2Line,
  RiVideoLine,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { ImageDialog } from "../../../../shared/utilities/dialog/image-dialog";
import {
  fileToGenerationImageBase64,
  GENERATION_IMAGE_ACCEPTED_EXTENSIONS,
  GENERATION_IMAGE_ACCEPTED_TYPES,
} from "../../shared/compressGenerationImage";
import { Button, Field } from "../../../../shared/utilities/form";
import { ElementFormImage, ElementFormVideo, StoryboardImageStatus } from "../../constants";
import { getElementFormImagePreviewSrc, getImageDisplayName } from "../utils/elementFormImageUtils";

const ACCEPTED_IMAGE_TYPES = GENERATION_IMAGE_ACCEPTED_TYPES;
const ACCEPTED_EXTENSIONS = GENERATION_IMAGE_ACCEPTED_EXTENSIONS;

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

interface ImageUploadSlotProps {
  label: string;
  value?: ElementFormImage;
  onChange: (value: ElementFormImage | undefined) => void;
  maxSizeMB?: number;
  readOnly?: boolean;
}

function ImageUploadSlot({
  label,
  value,
  onChange,
  maxSizeMB = 10,
  readOnly = false,
}: ImageUploadSlotProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoomImage, setZoomImage] = useState("");

  const previewSrc = useMemo(() => {
    if (!value) return null;
    return getElementFormImagePreviewSrc(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (previewSrc && previewSrc.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  const processFile = useCallback(
    async (file: File) => {
      if (readOnly) return;

      const isImage =
        ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!isImage) {
        toast.error(t("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)"));
        return;
      }

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
        const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
        onChange({
          fifeUrl: "",
          imageBytes,
          mimeType,
          name: file.name,
        });
        toast.success(t("Đã upload ảnh thành công"));
      } catch (err) {
        console.error("[ImageUploadSlot] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, onChange, readOnly, t, toast]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setDragOver(true);
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

  const handleClear = () => onChange(undefined);

  const openFilePicker = () => {
    if (!readOnly && !uploading) fileInputRef.current?.click();
  };

  return (
    <Field noError label={label}>
      <div>
        {value?.imageBytes && previewSrc ? (
          <div className="overflow-hidden relative bg-gray-50 rounded-xl border-2 border-indigo-200">
            <div
              role="button"
              tabIndex={0}
              className="flex justify-center items-center w-full h-40 bg-gray-100 cursor-pointer"
              onClick={() => setZoomImage(previewSrc)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setZoomImage(previewSrc);
                }
              }}
            >
              <img
                src={previewSrc}
                alt={value.name || label}
                className="object-contain max-w-full max-h-full pointer-events-none"
              />
            </div>
            <ImageDialog
              isOpen={!!zoomImage}
              image={zoomImage}
              onClose={() => setZoomImage("")}
              imageDialogClassName="object-contain max-w-full max-h-[80vh]"
            />
            <div className="flex justify-between items-center px-3 py-2 bg-white border-t border-gray-200">
              <span className="text-xs text-gray-600 truncate" title={value.name}>
                {value.name}
              </span>
              {!readOnly && (
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  <Button
                    onClick={openFilePicker}
                    icon={<RiUploadCloud2Line />}
                    className="w-7 h-7 text-blue-500 bg-blue-50 rounded-lg hover:bg-blue-100"
                    iconClassName="text-base"
                    tooltip={t("Đổi ảnh")}
                  />
                  <Button
                    onClick={handleClear}
                    icon={<RiCloseLine />}
                    className="w-7 h-7 text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                    iconClassName="text-base"
                    tooltip={t("Xóa")}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={openFilePicker}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-all ${
              readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
            } ${
              dragOver
                ? "bg-indigo-50 border-indigo-400"
                : "border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30"
            }`}
          >
            {uploading ? (
              <div className="flex flex-col gap-2 items-center">
                <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
                <span className="text-sm font-medium text-indigo-600">{t("Đang xử lý")}...</span>
              </div>
            ) : (
              <>
                <div className="flex justify-center items-center mb-2 w-10 h-10 bg-indigo-50 rounded-full">
                  <RiUploadCloud2Line className="text-xl text-indigo-500" />
                </div>
                <span className="text-sm font-semibold text-center text-gray-700">
                  {t("Kéo thả hoặc bấm để chọn ảnh")}
                </span>
                <span className="mt-1 text-xs text-center text-gray-400">
                  JPG, PNG, WebP, GIF • {t("Tối đa")} {maxSizeMB}MB
                </span>
              </>
            )}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          disabled={readOnly}
          onChange={handleFileChange}
        />
      </div>
    </Field>
  );
}

interface MultiImageUploadSlotProps {
  label: string;
  value?: ElementFormImage[];
  onChange: (value: ElementFormImage[] | undefined) => void;
  maxSizeMB?: number;
  /** Giới hạn tổng số ảnh (undefined = không giới hạn) */
  maxImages?: number;
  readOnly?: boolean;
  getImageStatus?: (index: number) => StoryboardImageStatus | undefined;
  onRetryImage?: (index: number) => void;
}

function MultiImageListItem({
  img,
  index,
  readOnly,
  onRemove,
  status,
  onRetry,
}: {
  img: ElementFormImage;
  index: number;
  readOnly: boolean;
  onRemove: (index: number) => void;
  status?: StoryboardImageStatus;
  onRetry?: (index: number) => void;
}) {
  const { t } = useTranslation();
  const [zoomImage, setZoomImage] = useState("");
  const previewSrc = useMemo(() => getElementFormImagePreviewSrc(img), [img]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
        URL.revokeObjectURL(previewSrc);
      }
    };
  }, [previewSrc]);

  if (!previewSrc) return null;

  const displayName = getImageDisplayName(img) || `image-${index + 1}`;

  return (
    <li className="flex flex-col w-full min-w-0">
      <div
        role="button"
        tabIndex={0}
        className={`relative flex justify-center items-center w-full aspect-square overflow-hidden bg-gray-100 rounded-lg cursor-pointer group ${
          status === "error" ? "ring-2 ring-red-500" : ""
        }`}
        onClick={() => setZoomImage(previewSrc)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setZoomImage(previewSrc);
          }
        }}
      >
        <img
          src={previewSrc}
          alt={displayName}
          className="object-contain w-full h-full max-w-full max-h-full pointer-events-none"
        />
        {status === "loading" && (
          <div className="flex absolute inset-0 z-10 justify-center items-center bg-black/40">
            <RiLoader4Line className="text-2xl text-white animate-spin" />
          </div>
        )}
        {status === "error" && onRetry && (
          <Button
            onClick={(e) => {
              e?.stopPropagation?.();
              onRetry(index);
            }}
            icon={<RiRefreshLine />}
            className="absolute inset-0 z-10 flex justify-center items-center bg-red-500/60 rounded-lg border-0 hover:bg-red-500/75"
            iconClassName="text-2xl text-white"
            tooltip={t("Tạo lại phân cảnh")}
          />
        )}
        {!readOnly && status !== "loading" && (
          <Button
            onClick={(e) => {
              e?.stopPropagation?.();
              onRemove(index);
            }}
            icon={<RiCloseLine />}
            className="absolute -top-1 -right-1 z-10 px-0 w-6 h-6 bg-white rounded-full opacity-0 transition-opacity text-danger group-hover:opacity-100 hover:bg-black/70"
            iconClassName="text-sm"
            tooltip={t("Xóa")}
          />
        )}
      </div>
      <ImageDialog
        isOpen={!!zoomImage}
        image={zoomImage}
        onClose={() => setZoomImage("")}
        imageDialogClassName="object-contain max-w-full max-h-[80vh]"
      />
      <span className="mt-1 w-full text-xs text-center text-gray-600 truncate" title={displayName}>
        {displayName}
      </span>
    </li>
  );
}

function MultiImageUploadSlot({
  label,
  value = [],
  onChange,
  maxSizeMB = 10,
  maxImages,
  readOnly = false,
  getImageStatus,
  onRetryImage,
}: MultiImageUploadSlotProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const atMaxImages = maxImages != null && value.length >= maxImages;

  const processFile = useCallback(
    async (file: File): Promise<ElementFormImage | null> => {
      if (readOnly) return null;

      const isImage =
        ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!isImage) {
        toast.error(t("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP, GIF)"));
        return null;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(
          `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSizeMB}MB, ${t("file")}: ${sizeMB.toFixed(
            1
          )}MB`
        );
        return null;
      }

      try {
        const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
        return {
          fifeUrl: "",
          imageBytes,
          mimeType,
          name: file.name,
        };
      } catch (err) {
        console.error("[MultiImageUploadSlot] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
        return null;
      }
    },
    [maxSizeMB, readOnly, t, toast]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (readOnly || uploading || atMaxImages) {
        if (atMaxImages && maxImages != null) {
          toast.error(`${t("Tối đa")} ${maxImages} ${t("ảnh")}`);
        }
        return;
      }
      const fileArr = Array.from(files);
      if (!fileArr.length) return;

      const remaining =
        maxImages != null ? Math.max(0, maxImages - value.length) : fileArr.length;
      if (remaining <= 0) {
        toast.error(`${t("Tối đa")} ${maxImages} ${t("ảnh")}`);
        return;
      }
      const filesToProcess = fileArr.slice(0, remaining);
      if (filesToProcess.length < fileArr.length && maxImages != null) {
        toast.info(`${t("Chỉ thêm được")} ${remaining}/${fileArr.length} ${t("ảnh")} (${t("Tối đa")} ${maxImages})`);
      }

      setUploading(true);
      const added: ElementFormImage[] = [];
      for (const file of filesToProcess) {
        const img = await processFile(file);
        if (img) added.push(img);
      }
      setUploading(false);

      if (added.length) {
        onChange([...value, ...added]);
        toast.success(
          added.length === 1
            ? t("Đã upload ảnh thành công")
            : `${t("Đã upload")} ${added.length} ${t("ảnh")}`
        );
      }
    },
    [atMaxImages, maxImages, onChange, processFile, readOnly, t, toast, uploading, value]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) addFiles(files);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setDragOver(true);
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
    const files = e.dataTransfer.files;
    if (files?.length) addFiles(files);
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next.length ? next : undefined);
  };

  const openFilePicker = () => {
    if (!readOnly && !uploading && !atMaxImages) fileInputRef.current?.click();
  };

  const maxImagesHint =
    maxImages != null
      ? `${t("Tối đa")} ${maxImages} ${t("ảnh")} (${value.length}/${maxImages})`
      : t("Có thể chọn nhiều ảnh");

  return (
    <Field noError label={label}>
      <div className="space-y-2">
        {!atMaxImages && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-all ${
            readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          } ${
            dragOver
              ? "bg-indigo-50 border-indigo-400"
              : "border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/30"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col gap-2 items-center">
              <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
              <span className="text-sm font-medium text-indigo-600">{t("Đang xử lý")}...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center mb-2 w-10 h-10 bg-indigo-50 rounded-full">
                <RiUploadCloud2Line className="text-xl text-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-center text-gray-700">
                {value.length > 0
                  ? t("Kéo thả hoặc bấm để thêm ảnh")
                  : t("Kéo thả hoặc bấm để chọn ảnh")}
              </span>
              <span className="mt-1 text-xs text-center text-gray-400">
                JPG, PNG, WebP, GIF • {t("Tối đa")} {maxSizeMB}MB • {maxImagesHint}
              </span>
            </>
          )}
        </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          className="sr-only"
          disabled={readOnly || atMaxImages}
          onChange={handleFileChange}
        />

        {value.length > 0 && (
          <div className="space-y-2">
            {!readOnly && (
              <div className="flex justify-end">
                <Button
                  onClick={() => onChange(undefined)}
                  icon={<RiDeleteBinLine />}
                  className="gap-1 px-2 h-7 text-xs text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                  iconClassName="text-sm"
                  tooltip={t("Xóa tất cả ảnh")}
                >
                  {t("Xóa tất cả")}
                </Button>
              </div>
            )}
            <ul className="grid grid-cols-5 gap-2 auto-rows-fr max-h-[400px] overflow-y-auto pr-1">
              {value.map((img, index) => (
                <MultiImageListItem
                  key={`${img.name}-${index}`}
                  img={img}
                  index={index}
                  readOnly={readOnly}
                  onRemove={handleRemove}
                  status={getImageStatus?.(index)}
                  onRetry={onRetryImage}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}

export interface ElementImagesUploadProps {
  artStyleImg?: ElementFormImage[];
  onArtStyleImgChange: (value: ElementFormImage[] | undefined) => void;
  readOnly?: boolean;
  maxSizeMB?: number;
  maxImages?: number;
  label?: string;
  getImageStatus?: (index: number) => StoryboardImageStatus | undefined;
  onRetryImage?: (index: number) => void;
}

// ── Video upload constants ────────────────────────────────────────────────
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
const ACCEPTED_VIDEO_EXTENSIONS = ".mp4,.webm,.mov,.avi";

function fileToBase64Video(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read video as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64VideoToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType });
  return URL.createObjectURL(blob);
}

interface VideoUploadSlotProps {
  label: string;
  value?: ElementFormVideo[];
  onChange: (value: ElementFormVideo[] | undefined) => void;
  maxSizeMB?: number;
  readOnly?: boolean;
}

function MultiVideoListItem({
  video,
  index,
  readOnly,
  onRemove,
}: {
  video: ElementFormVideo;
  index: number;
  readOnly: boolean;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const previewSrc = useMemo(() => {
    if (!video.videoBytes && !video.fifeUrl) return null;
    if (video.fifeUrl) return video.fifeUrl;
    return base64VideoToBlobUrl(video.videoBytes, video.mimeType || "video/mp4");
  }, [video.videoBytes, video.fifeUrl, video.mimeType]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  if (!previewSrc) return null;

  const displayName =
    (video.name || `video-${index + 1}`).replace(/\.[^./\\]+$/, "").trim() || `video-${index + 1}`;

  return (
    <li className="flex flex-col min-w-0">
      <div className="overflow-hidden relative w-full bg-black rounded-lg group aspect-video">
        <video src={previewSrc} className="object-cover w-full h-full" muted preload="metadata" />
        {!readOnly && (
          <Button
            onClick={(e) => {
              e?.stopPropagation?.();
              onRemove(index);
            }}
            icon={<RiCloseLine />}
            className="absolute -top-1 -right-1 z-10 px-0 w-6 h-6 bg-white rounded-full opacity-0 transition-opacity text-danger group-hover:opacity-100 hover:bg-black/70"
            iconClassName="text-sm"
            tooltip={t("Xóa")}
          />
        )}
      </div>
      <span className="mt-1 w-full text-xs text-center text-gray-600 truncate" title={displayName}>
        {displayName}
      </span>
    </li>
  );
}

function MultiVideoUploadSlot({
  label,
  value = [],
  onChange,
  maxSizeMB = 100,
  readOnly = false,
}: VideoUploadSlotProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = useCallback(
    async (file: File): Promise<ElementFormVideo | null> => {
      if (readOnly) return null;

      const isVideo =
        ACCEPTED_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov|avi)$/i.test(file.name);
      if (!isVideo) {
        toast.error(t("Chỉ hỗ trợ file video (MP4, WebM, MOV, AVI)"));
        return null;
      }

      const sizeMB = file.size / (1024 * 1024);
      if (sizeMB > maxSizeMB) {
        toast.error(
          `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSizeMB}MB, ${t("file")}: ${sizeMB.toFixed(
            1
          )}MB`
        );
        return null;
      }

      try {
        const videoBytes = await fileToBase64Video(file);
        const mimeType = file.type || "video/mp4";
        return { fifeUrl: "", videoBytes, mimeType, name: file.name };
      } catch (err) {
        console.error("[MultiVideoUploadSlot] Error processing file:", err);
        toast.error(t("Lỗi khi xử lý video. Vui lòng thử lại."));
        return null;
      }
    },
    [maxSizeMB, readOnly, t, toast]
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      if (readOnly || uploading) return;
      const fileArr = Array.from(files);
      if (!fileArr.length) return;

      setUploading(true);
      const added: ElementFormVideo[] = [];
      for (const file of fileArr) {
        const vid = await processFile(file);
        if (vid) added.push(vid);
      }
      setUploading(false);

      if (added.length) {
        onChange([...value, ...added]);
        toast.success(
          added.length === 1
            ? t("Đã upload video thành công")
            : `${t("Đã upload")} ${added.length} ${t("video")}`
        );
      }
    },
    [onChange, processFile, readOnly, t, toast, uploading, value]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) addFiles(files);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!readOnly) setDragOver(true);
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
    const files = e.dataTransfer.files;
    if (files?.length) addFiles(files);
  };

  const handleRemove = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    onChange(next.length ? next : undefined);
  };

  const openFilePicker = () => {
    if (!readOnly && !uploading) fileInputRef.current?.click();
  };

  return (
    <Field noError label={label}>
      <div className="space-y-2">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 transition-all ${
            readOnly ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
          } ${
            dragOver
              ? "bg-violet-50 border-violet-400"
              : "border-gray-300 hover:border-violet-300 hover:bg-violet-50/30"
          }`}
        >
          {uploading ? (
            <div className="flex flex-col gap-2 items-center">
              <RiLoader4Line className="text-3xl text-violet-500 animate-spin" />
              <span className="text-sm font-medium text-violet-600">{t("Đang xử lý")}...</span>
            </div>
          ) : (
            <>
              <div className="flex justify-center items-center mb-2 w-10 h-10 bg-violet-50 rounded-full">
                <RiVideoLine className="text-xl text-violet-500" />
              </div>
              <span className="text-sm font-semibold text-center text-gray-700">
                {value.length > 0
                  ? t("Kéo thả hoặc bấm để thêm video")
                  : t("Kéo thả hoặc bấm để chọn video")}
              </span>
              <span className="mt-1 text-xs text-center text-gray-400">
                MP4, WebM, MOV, AVI • {t("Tối đa")} {maxSizeMB}MB • {t("Có thể chọn nhiều video")}
              </span>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_VIDEO_EXTENSIONS}
          multiple
          className="sr-only"
          disabled={readOnly}
          onChange={handleFileChange}
        />

        {value.length > 0 && (
          <div className="space-y-2">
            {!readOnly && (
              <div className="flex justify-end">
                <Button
                  onClick={() => onChange(undefined)}
                  icon={<RiDeleteBinLine />}
                  className="gap-1 px-2 h-7 text-xs text-red-500 bg-red-50 rounded-lg hover:bg-red-100"
                  iconClassName="text-sm"
                  tooltip={t("Xóa tất cả video")}
                >
                  {t("Xóa tất cả")}
                </Button>
              </div>
            )}
            <ul className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1">
              {value.map((vid, index) => (
                <MultiVideoListItem
                  key={`${vid.name}-${index}`}
                  video={vid}
                  index={index}
                  readOnly={readOnly}
                  onRemove={handleRemove}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </Field>
  );
}

export interface ElementVideoUploadProps {
  videoRef?: ElementFormVideo[];
  onVideoRefChange: (value: ElementFormVideo[] | undefined) => void;
  readOnly?: boolean;
  maxSizeMB?: number;
}

export function ElementVideoUpload({
  videoRef,
  onVideoRefChange,
  readOnly = false,
  maxSizeMB = 100,
}: ElementVideoUploadProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <MultiVideoUploadSlot
        label={t("Video tham chiếu (Tùy chọn)")}
        value={videoRef}
        onChange={onVideoRefChange}
        readOnly={readOnly}
        maxSizeMB={maxSizeMB}
      />
    </div>
  );
}

export function ElementImagesUpload({
  artStyleImg,
  onArtStyleImgChange,
  readOnly = false,
  maxSizeMB = 10,
  maxImages,
  label,
  getImageStatus,
  onRetryImage,
}: ElementImagesUploadProps) {
  return (
    <div className="space-y-3">
      <MultiImageUploadSlot
        label={label}
        value={artStyleImg}
        onChange={onArtStyleImgChange}
        readOnly={readOnly}
        maxSizeMB={maxSizeMB}
        maxImages={maxImages}
        getImageStatus={getImageStatus}
        onRetryImage={onRetryImage}
      />
    </div>
  );
}
