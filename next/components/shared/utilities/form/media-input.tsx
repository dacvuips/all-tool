import isEqual from "lodash/isEqual";
import { ChangeEvent, MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
  RiCloseLine,
  RiFileLine,
  RiFileMusicLine,
  RiUpload2Line,
  RiVideoLine,
} from "react-icons/ri";
import { uploadMedia } from "../../../../lib/helpers/video";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Dialog } from "../dialog/dialog";
import { Button } from "./button";

const VIDEO_EXTENSIONS = ["mp4", "mov", "webm", "mkv"];
const AUDIO_EXTENSIONS = ["mp3"];
const FILE_EXTENSIONS = [];
const DEFAULT_ALLOWED_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...FILE_EXTENSIONS];
const HARD_LIMIT_SIZE_MB = 120;

type MediaKind = "video" | "audio" | "file";

export interface MediaInputProps extends FormControlProps {
  multi?: boolean;
  limit?: number;
  maxSizeMB?: number;
  allowedExtensions?: string[];
  controlClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
}

export function MediaInput({
  controlClassName = "form-control",
  className = "",
  inputClassName = "",
  buttonClassName = "",
  style = {},
  multi = false,
  limit = 1,
  maxSizeMB = 120,
  allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
  ...props
}: MediaInputProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [value, setValue] = useState<string | string[]>();
  const ref: MutableRefObject<HTMLInputElement> = useRef();
  const [uploading, setUploading] = useState(false);
  const [fileRejectionItems, setFileRejectionItems] = useState<string>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const normalizedAllowedExtensions = useMemo(
    () => (allowedExtensions || []).map((x) => x.toLowerCase().replace(/^\./, "")).filter(Boolean),
    [allowedExtensions]
  );
  const effectiveMaxSizeMB = Math.min(maxSizeMB, HARD_LIMIT_SIZE_MB);
  const maxSizeBytes = effectiveMaxSizeMB * 1024 * 1024;
  const acceptString = normalizedAllowedExtensions.map((x) => `.${x}`).join(",");

  const { getRootProps, getInputProps, fileRejections } = useDropzone({
    disabled: props.readOnly,
    maxFiles: limit,
    maxSize: maxSizeBytes,
    onDrop: (acceptedFiles) => {
      onFileChanged(acceptedFiles, true);
    },
  });

  useEffect(() => {
    if (!isEqual(props.value, value)) {
      if (props.value !== undefined) {
        setValue(props.value || getDefaultValue({ multi }));
      } else {
        setValue(getDefaultValue({ multi }));
      }
    }
  }, [props.value]);

  useEffect(() => {
    const firstError = fileRejections?.[0]?.errors?.[0]?.code;
    if (!firstError) return;
    if (firstError === "file-too-large") {
      setFileRejectionItems(`*${t("Kích thước file lớn")} / ${effectiveMaxSizeMB}MB`);
      return;
    }
    if (firstError === "too-many-files") {
      setFileRejectionItems(`*${t("Vượt quá số lượng file tải lên cùng lúc là")} (${limit})`);
    }
  }, [fileRejections, effectiveMaxSizeMB, limit]);

  const onFileChanged = async (e: ChangeEvent<HTMLInputElement> | File[] | any, drag?: boolean) => {
    setFileRejectionItems(null);
    const files = Array.from(!drag ? e.target.files || [] : e || []) as File[];
    if (!files.length) return;

    if (files.length > limit) {
      setFileRejectionItems(`*${t("Vượt quá số lượng file tải lên cùng lúc là")} (${limit})`);
      return;
    }

    const invalidFile = files.find((file) => {
      const extension = getExtension(file.name);
      return !normalizedAllowedExtensions.includes(extension);
    });
    if (invalidFile) {
      setFileRejectionItems(
        `*${t("Đuôi file không được hỗ trợ")}: .${getExtension(invalidFile.name)}. ${t(
          "Chỉ nhận"
        )}: ${acceptString || "(none)"}`
      );
      return;
    }

    const oversizeFile = files.find((file) => file.size > maxSizeBytes);
    if (oversizeFile) {
      setFileRejectionItems(
        `*${t("Kích thước file lớn")}: ${getFileSizeInMB(
          oversizeFile.size
        )}MB / ${effectiveMaxSizeMB}MB`
      );
      return;
    }

    try {
      setUploading(true);
      const uploaded = await Promise.all(files.map((file) => uploadMedia(file)));
      const links = uploaded.map((item) => item.link);

      if (multi) {
        const currentValue = (Array.isArray(value) ? value : []).filter(Boolean);
        const newValue = [...currentValue, ...links];
        setValue(newValue);
        props.onChange?.(newValue);
      } else {
        const nextValue = links[0] || "";
        setValue(nextValue);
        props.onChange?.(nextValue);
      }
    } catch (err) {
      console.error(err);
      toast.error(t("Upload media thất bại. Vui lòng thử lại."));
    } finally {
      setUploading(false);
    }
  };

  const mediaValues = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    return [value];
  }, [value]);

  const removeAt = (index: number) => {
    const next = [...(value as string[])];
    next.splice(index, 1);
    setValue(next);
    props.onChange?.(next);
  };

  const removeSingle = () => {
    setValue("");
    props.onChange?.("");
  };

  const openPreview = (url: string) => {
    setPreviewUrl(url);
    setIsPreviewOpen(true);
  };

  const previewType = getMediaType(previewUrl);
  const previewName = getNameFromUrl(previewUrl);

  return (
    <>
      {multi ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mediaValues.map((item, index) => {
              const type = getMediaType(item);
              return (
                <div
                  key={`${item}-${index}`}
                  className="relative p-3 bg-white rounded-xl border border-gray-200 shadow-sm transition group hover:border-primary hover:shadow-md"
                >
                  <button
                    type="button"
                    className="flex gap-3 items-start w-full text-left"
                    onClick={() => openPreview(item)}
                  >
                    <span className="p-2 text-2xl bg-gray-100 rounded-lg text-primary">
                      {renderMediaIcon(type)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate text-accent">
                        {getNameFromUrl(item)}
                      </span>
                      <span className="mt-1 inline-flex rounded bg-primary-light px-2 py-0.5 text-xs font-medium text-primary">
                        {getMediaLabel(type, t)}
                      </span>
                    </span>
                  </button>
                  {!props.readOnly && (
                    <Button
                      outline
                      danger
                      className="absolute top-2 right-2 px-0 w-7 h-7 rounded-full border opacity-0 transition border-danger group-hover:opacity-100"
                      icon={<RiCloseLine />}
                      onClick={() => removeAt(index)}
                    />
                  )}
                </div>
              );
            })}

            {!props.readOnly && (
              <div {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                <button
                  type="button"
                  className={`flex h-full min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition ${
                    uploading
                      ? "border-primary bg-primary-light text-primary"
                      : "border-gray-300 hover:border-primary hover:bg-gray-50"
                  }`}
                >
                  <RiUpload2Line className="text-2xl" />
                  <span className="mt-2 text-sm font-semibold">{t("Tải media lên")}</span>
                  <span className="mt-1 text-xs text-gray-500">
                    {t("Kéo thả hoặc bấm để chọn file")}
                  </span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div
          className={`${controlClassName} mt-0 relative flex items-center focus-within:border-primary-dark group px-0 ${
            props.readOnly ? "readOnly" : ""
          } ${props.error ? "error" : ""} ${className}`}
          style={{ ...style }}
        >
          <button
            type="button"
            className="flex items-center px-3 h-full text-lg border-r border-gray-200 text-primary"
            onClick={() => value && openPreview(value as string)}
          >
            {renderMediaIcon(getMediaType(value as string))}
          </button>

          <input
            tabIndex={props.noFocus && -1}
            className={`flex-grow bg-transparent self-stretch px-2 ${inputClassName || ""}`}
            name={props.name}
            value={(value as string) || ""}
            placeholder={props.placeholder || t("Link media sẽ hiển thị tại đây")}
            readOnly={props.readOnly}
            onChange={(e) => {
              setValue(e.target.value);
              props.onChange?.(e.target.value);
            }}
          />

          {!props.readOnly && (
            <>
              {!!value && (
                <Button
                  className="self-stretch px-3"
                  tooltip={t("Xóa")}
                  icon={<RiCloseLine />}
                  unfocusable
                  onClick={removeSingle}
                />
              )}
              <Button
                className={`self-stretch px-3 bg-gray-50 rounded-l-none border-l border-gray-200 ${buttonClassName}`}
                isLoading={uploading}
                tooltip={t("Tải lên")}
                icon={<RiUpload2Line />}
                unfocusable
                onClick={() => ref.current?.click()}
              />
            </>
          )}

          <input
            hidden
            type="file"
            accept={acceptString}
            ref={ref}
            onChange={onFileChanged}
            multiple={false}
          />
        </div>
      )}

      {fileRejectionItems && (
        <div className="font-semibold text-sm pt-0.5 min-h-6 text-danger text-right pr-0.5 w-full ">
          <span className="form-error animate-emerge-up">{fileRejectionItems}</span>
        </div>
      )}

      {!fileRejectionItems && (
        <div className="flex flex-wrap gap-2 items-center mt-1 text-xs text-gray-500">
          <span className="px-2 py-1">
            {t("Tối đa mỗi file")}: {effectiveMaxSizeMB}MB
          </span>
        </div>
      )}

      <Dialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={t("Xem media")}
        width={"820px"}
      >
        <Dialog.Body>
          <div className="space-y-3">
            <div className="text-sm font-semibold truncate text-accent">{previewName}</div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              {previewType === "video" && (
                <video
                  controls
                  src={previewUrl}
                  className="max-h-[70vh] w-full rounded-lg bg-black"
                />
              )}
              {previewType === "audio" && <audio controls src={previewUrl} className="w-full" />}
              {previewType === "file" && (
                <div className="flex gap-3 justify-between items-center p-4 bg-white rounded-lg">
                  <div className="flex gap-3 items-center">
                    <span className="p-2 text-2xl bg-gray-100 rounded-lg text-primary">
                      <RiFileLine />
                    </span>
                    <span className="font-medium truncate">{previewName}</span>
                  </div>
                  <Button
                    outline
                    text={t("Mở file")}
                    onClick={() => {
                      if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}

function getExtension(fileName: unknown = ""): string {
  const normalizedFileName =
    typeof fileName === "string"
      ? fileName
      : fileName instanceof File
      ? fileName.name
      : String(fileName ?? "");
  const name = normalizedFileName.toLowerCase();
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return name.slice(dotIndex + 1);
}

function getMediaType(url: string): MediaKind {
  const extension = getExtension(url || "");
  if (VIDEO_EXTENSIONS.includes(extension)) return "video";
  if (AUDIO_EXTENSIONS.includes(extension)) return "audio";
  return "file";
}

function getNameFromUrl(url = ""): string {
  try {
    const withoutQuery = url.split("?")[0];
    const parts = withoutQuery.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "media");
  } catch {
    return "media";
  }
}

function getFileSizeInMB(sizeInBytes: number): string {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
}

function renderMediaIcon(type: MediaKind) {
  if (type === "video") return <RiVideoLine />;
  if (type === "audio") return <RiFileMusicLine />;
  return <RiFileLine />;
}

function getMediaLabel(type: MediaKind, t: (value: string) => string) {
  if (type === "video") return t("Video");
  if (type === "audio") return t("Audio");
  return t("File");
}

const getDefaultValue = (props: MediaInputProps) => {
  return props.multi ? [] : "";
};

MediaInput.getDefaultValue = getDefaultValue;
