/**
 * object-personify-picker-dialog.tsx
 *
 * Shared component used in affiliate config sidebar.
 * Renders a <Textarea> for object personification with a ✏️ pen icon that opens a Dialog
 * for creating / managing custom personified objects (name, prompt, reference images).
 *
 * Features:
 *  - Pen icon inline with the label → opens a Dialog
 *  - Dialog shows a grid of server-managed ObjectToPersonify items (image + name)
 *  - Prompt field is NOT shown to customers
 *  - Click to select → sets name display + code as value
 *  - Customer can create custom objects saved via GraphQL API (with customerId)
 *  - "Nhân vật của tôi" section shows customer's own characters with delete option
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import {
  RiAddLine,
  RiArrowDropLeftLine,
  RiArrowLeftLine,
  RiBookletLine,
  RiCloseLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiLoader4Line,
  RiUploadCloud2Line,
} from "react-icons/ri";
import { uploadImage } from "../../../../lib/helpers/image";
import { useToast } from "../../../../lib/providers/toast-provider";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { ImageDialog } from "../../../shared/utilities/dialog/image-dialog";
import { Button, Field, ImageInput, Input, Label, Textarea } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { ElementFormImage } from "../constants";
import {
  getElementFormImagePreviewSrc,
  getImageDisplayName,
} from "../elements/utils/elementFormImageUtils";
import { ObjectToPersonifyPublic, useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";

// ── Types ──────────────────────────────────────────────────────────────────

type ObjectPersonifyFieldTab = "image" | "prompt";

export type { ObjectPersonifyFieldTab };

export interface ObjectPersonifyPickerDialogProps {
  /** Current objectToPersonify value */
  value?: string;
  /** Fired when the user picks a custom object or types free text */
  onChange?: (value: string) => void;
  /** Fired when the user picks a custom object – passes the code for API */
  onCodeChange?: (code: string) => void;
  /** Callback to set display name separately (optional) */
  onNameChange?: (name: string) => void;
  /** Field label override */
  label?: string;
  /** Pass `true` to hide the Field wrapper error display */
  noError?: boolean;
  /** Optional field name for react-hook-form */
  name?: string;
  /** Ảnh tham chiếu nhân hoá (base64, tab Ảnh) */
  imageValue?: ElementFormImage;
  onImageChange?: (image: ElementFormImage | undefined) => void;
  readOnly?: boolean;
  /** Tab Ảnh / Prompt bên ngoài field nhân hoá (controlled) */
  fieldTab?: ObjectPersonifyFieldTab;
  onFieldTabChange?: (tab: ObjectPersonifyFieldTab) => void;
}

const DEFAULT_PROMPT = `SYS Style Prompt Generator, Please describe the character in the image in the most detailed and complete manner possible (skin tone, hair color, description of eyes, nose, mouth, eyebrows, skin wrinkles, clothing stitching, accessories, dimensions, materials, colors of all parts, style, lighting, atmosphere, effects, 8k resolution, etc.). Do not use abbreviations, do not add creative elements, and describe every single part of the character.`;

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.gif";

function ObjectPersonifyFieldTabBar({
  activeTab,
  imageLabel,
  promptLabel,
  onChange,
}: {
  activeTab: ObjectPersonifyFieldTab;
  imageLabel: string;
  promptLabel: string;
  onChange: (tab: ObjectPersonifyFieldTab) => void;
}) {
  const tabs: { id: ObjectPersonifyFieldTab; label: string }[] = [
    { id: "image", label: imageLabel },
    { id: "prompt", label: promptLabel },
  ];

  return (
    <div className="relative w-full overflow-hidden bg-white border-b border-gray-200">
      <div className="relative flex items-center text-center">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`relative flex flex-col flex-1 items-center py-2 text-sm font-semibold whitespace-nowrap cursor-pointer ${
                isActive ? "text-gray-800" : "text-gray-600 hover:text-gray-800"
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-1 rounded-t bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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
}

interface ObjectPersonifyImageUploadProps {
  imageValue?: ElementFormImage;
  onImageChange?: (image: ElementFormImage | undefined) => void;
  readOnly?: boolean;
  maxSizeMB?: number;
}

function ObjectPersonifyImageUpload({
  imageValue,
  onImageChange,
  readOnly = false,
  maxSizeMB = 10,
}: ObjectPersonifyImageUploadProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [zoomImage, setZoomImage] = useState("");

  const previewSrc = useMemo(() => {
    if (!imageValue) return null;
    return getElementFormImagePreviewSrc(imageValue);
  }, [imageValue]);

  useEffect(() => {
    return () => {
      if (previewSrc?.startsWith("blob:")) {
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
        const imageBytes = await fileToBase64(file);
        onImageChange?.({
          fifeUrl: "",
          imageBytes,
          mimeType: file.type || "image/png",
          name: file.name,
        });
        toast.success(t("Đã chọn ảnh thành công"));
      } catch (err) {
        console.error("[ObjectPersonifyImageUpload] Error:", err);
        toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
      } finally {
        setUploading(false);
      }
    },
    [maxSizeMB, onImageChange, readOnly, t, toast]
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

  const handleClear = () => onImageChange?.(undefined);

  const openFilePicker = () => {
    if (!readOnly && !uploading) fileInputRef.current?.click();
  };

  const displayName = imageValue ? getImageDisplayName(imageValue) : "";

  return (
    <div>
      {imageValue?.imageBytes && previewSrc ? (
        <div className="overflow-hidden relative bg-gray-50 rounded-xl border-2 border-indigo-200">
          <div
            role="button"
            tabIndex={0}
            className="flex relative justify-center items-center w-full h-40 bg-gray-100 cursor-pointer"
            onClick={() => !uploading && setZoomImage(previewSrc)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!uploading) setZoomImage(previewSrc);
              }
            }}
          >
            <img
              src={previewSrc}
              alt={t("Ảnh tham chiếu nhân hoá")}
              className="object-contain max-w-full max-h-full pointer-events-none"
            />
            {uploading && (
              <div className="flex absolute inset-0 flex-col gap-2 justify-center items-center bg-white/70">
                <RiLoader4Line className="text-3xl text-indigo-500 animate-spin" />
                <span className="text-sm font-medium text-indigo-600">{t("Đang xử lý")}...</span>
              </div>
            )}
          </div>
          <ImageDialog
            isOpen={!!zoomImage}
            image={zoomImage}
            onClose={() => setZoomImage("")}
            imageDialogClassName="object-contain max-w-full max-h-[80vh]"
          />
          <div className="flex justify-between items-center px-3 py-2 bg-white border-t border-gray-200">
            <span className="text-xs text-gray-600 truncate" title={displayName || imageValue.name}>
              {displayName || t("Ảnh tham chiếu")}
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
        disabled={readOnly || uploading}
        onChange={handleFileChange}
      />
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function ObjectPersonifyPickerDialog({
  value,
  onChange,
  onCodeChange,
  onNameChange,
  label,
  noError = true,
  name,
  imageValue,
  onImageChange,
  readOnly,
  fieldTab: fieldTabProp,
  onFieldTabChange,
}: ObjectPersonifyPickerDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const {
    generateStyleText,
    generateImage,
    getActiveObjectToPersonifyList,
    getCustomerObjectToPersonifyList,
    createCustomerObjectToPersonify,
    deleteCustomerObjectToPersonify,
  } = useAffiliateVideoApi();

  // ── Dialog state ──
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // ── Form fields ──
  const [objectName, setObjectName] = useState("");
  const [objectPrompt, setObjectPrompt] = useState("");
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_PROMPT);
  const [objectImages, setObjectImages] = useState<string[]>([]);
  const [objectImageUrl, setObjectImageUrl] = useState<string>("");
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // ── Loading states ──
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // ── Server-managed objects (system) ──
  const [serverObjects, setServerObjects] = useState<ObjectToPersonifyPublic[]>([]);
  const [isLoadingServer, setIsLoadingServer] = useState(false);

  // ── Customer's own objects ──
  const [customerObjects, setCustomerObjects] = useState<ObjectToPersonifyPublic[]>([]);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(false);

  const [internalFieldTab, setInternalFieldTab] = useState<ObjectPersonifyFieldTab>("image");
  const fieldTab = fieldTabProp ?? internalFieldTab;
  const setFieldTab = (tab: ObjectPersonifyFieldTab) => {
    onFieldTabChange?.(tab);
    if (fieldTabProp === undefined) setInternalFieldTab(tab);
  };

  // ── Load server objects (system) ──
  const loadServerObjects = useCallback(async () => {
    setIsLoadingServer(true);
    try {
      const items = await getActiveObjectToPersonifyList();
      setServerObjects(items);
    } catch {
      setServerObjects([]);
    } finally {
      setIsLoadingServer(false);
    }
  }, [getActiveObjectToPersonifyList]);

  // ── Load customer objects ──
  const loadCustomerObjects = useCallback(async () => {
    setIsLoadingCustomer(true);
    try {
      const items = await getCustomerObjectToPersonifyList();
      setCustomerObjects(items);
    } catch {
      setCustomerObjects([]);
    } finally {
      setIsLoadingCustomer(false);
    }
  }, [getCustomerObjectToPersonifyList]);

  // ── Reset form ──
  const resetForm = () => {
    setObjectName("");
    setObjectPrompt("");
    setAiPrompt(DEFAULT_PROMPT);
    setObjectImages([]);
    setObjectImageUrl("");
    setShowImageInput(false);
    setShowPrompt(false);
  };

  // ── Open dialog ──
  const openDialog = () => {
    resetForm();
    setIsDialogOpen(true);
    loadServerObjects();
    loadCustomerObjects();
  };

  // ── Generate object description via API ──
  const handleGenerateDescription = async () => {
    if (objectImages.length === 0) {
      toast.error(t("Vui lòng chọn ảnh để tạo mô tả"));
      return;
    }

    let generatedText = "";

    setIsGenerating(true);
    try {
      generatedText = await generateStyleText(objectImages, aiPrompt);
      if (generatedText) {
        setObjectPrompt(generatedText);
        setShowPrompt(false);
        toast.success(t("Đã tạo mô tả đồ vật thành công"));
      }
    } catch {
      toast.error(t("Không thể tạo mô tả. Vui lòng thử lại."));
    } finally {
      setIsGenerating(false);
    }

    // After prompt is done, generate image separately
    if (generatedText) {
      setIsGeneratingImage(true);
      try {
        const imageResult = await generateImage({
          sceneId: `personify-${Date.now()}`,
          prompt: generatedText,
          aspectRatio: "1:1",
        });

        if (imageResult?.imageBytes) {
          // Convert base64 to File and upload to get a URL
          const byteString = atob(imageResult.imageBytes);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: imageResult.mimeType || "image/png" });
          const file = new File([blob], `personify-${Date.now()}.png`, {
            type: imageResult.mimeType || "image/png",
          });

          const uploadResult = await uploadImage(file);
          if (uploadResult?.link) {
            setObjectImageUrl(uploadResult.link);
            toast.success(t("Đã tạo ảnh nhân vật thành công"));
          }
        } else if (imageResult?.fifeUrl) {
          // If the API returns a direct URL, use it
          setObjectImageUrl(imageResult.fifeUrl);
          toast.success(t("Đã tạo ảnh nhân vật thành công"));
        }
      } catch {
        toast.error(t("Không thể tạo ảnh. Vui lòng thử lại."));
      } finally {
        setIsGeneratingImage(false);
      }
    }
  };

  // ── Handle server/customer object selection ──
  const handleSelectObject = (item: ObjectToPersonifyPublic) => {
    onImageChange?.(undefined);
    onChange?.(item.name);
    onCodeChange?.(item.code);
    setIsDialogOpen(false);
  };

  const handlePromptChange = useCallback(
    (v: string) => {
      onChange?.(v);
      if (!v?.trim()) {
        onCodeChange?.("");
      } else if (imageValue?.imageBytes) {
        onImageChange?.(undefined);
      }
    },
    [onChange, onCodeChange, onImageChange, imageValue]
  );

  const handleImageChange = useCallback(
    (image: ElementFormImage | undefined) => {
      onImageChange?.(image);
      if (image?.imageBytes) {
        onChange?.("");
        onCodeChange?.("");
      }
    },
    [onChange, onCodeChange, onImageChange]
  );

  // ── Handle delete customer object ──
  const handleDeleteCustomerObject = async (e: React.MouseEvent, item: ObjectToPersonifyPublic) => {
    e.stopPropagation(); // Prevent card click (selection)
    if (!confirm(t("Bạn có chắc muốn xoá nhân vật này?"))) return;

    setIsDeletingId(item.id);
    try {
      const success = await deleteCustomerObjectToPersonify(item.id);
      if (success) {
        toast.success(t("Đã xoá nhân vật"));
        // Remove from local state
        setCustomerObjects((prev) => prev.filter((o) => o.id !== item.id));
        // If currently selected, clear selection
        if (value === item.code) {
          onChange?.("");
        }
      }
    } catch {
      toast.error(t("Không thể xoá nhân vật"));
    } finally {
      setIsDeletingId(null);
    }
  };

  // ── Submit handler (custom object → GraphQL API) ──
  const handleSubmit = async () => {
    // Validation
    if (!objectName.trim()) {
      toast.error(t("Vui lòng nhập tên nhân vật nhân hóa"));
      return;
    }
    if (!objectPrompt.trim()) {
      toast.error(t("Vui lòng nhập prompt mô tả"));
      return;
    }

    setIsSaving(true);
    try {
      const result = await createCustomerObjectToPersonify({
        name: objectName.trim(),
        prompt: objectPrompt.trim(),
        imageUrl: objectImageUrl || undefined,
      });

      if (result) {
        onChange?.(result.name);
        onCodeChange?.(result.code);

        // Add to local customer objects list
        setCustomerObjects((prev) => [result, ...prev]);

        toast.success(t("Đã lưu nhân vật tùy chỉnh"));
        setIsDialogOpen(false);
        resetForm();
      }
    } catch {
      toast.error(t("Không thể lưu. Vui lòng thử lại."));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Validation flags ──
  const canSubmit = objectName.trim().length > 0 && objectPrompt.trim().length > 0;

  const isLoading = isLoadingServer || isLoadingCustomer;

  // ── Render object card (shared between system & customer grids) ──
  const renderObjectCard = (item: ObjectToPersonifyPublic, options?: { showDelete?: boolean }) => {
    const isSelected = value === item.code;
    const isDeleting = isDeletingId === item.id;

    return (
      <div
        key={item.id}
        onClick={() => handleSelectObject(item)}
        className={`
          group relative  cursor-pointer rounded-xl overflow-hidden
          border-2 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
          ${
            isSelected
              ? "border-blue-500 shadow-md shadow-blue-100 ring-2 ring-blue-200"
              : "border-gray-200 hover:border-blue-300"
          }
          ${isDeleting ? "opacity-50 pointer-events-none" : ""}
        `}
      >
        {/* Image */}
        <div className="overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 aspect-square">
          {item.imageUrl ? (
            <Img
              showImageOnClick
              src={item.imageUrl}
              alt={item.name}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="flex justify-center items-center w-full h-full text-4xl text-gray-300">
              🎭
            </div>
          )}
        </div>

        {/* Name overlay */}
        <div
          className={`
          px-2 py-2 text-center transition-colors duration-200
          ${isSelected ? "bg-blue-50" : "bg-white group-hover:bg-blue-50/50"}
        `}
        >
          <span
            className={`
            text-xs font-medium line-clamp-2 leading-tight
            ${isSelected ? "text-blue-700" : "text-gray-700 group-hover:text-blue-600"}
          `}
          >
            {item.name}
          </span>
        </div>

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {/* Delete button (customer objects only) */}
        {options?.showDelete && (
          <button
            type="button"
            onClick={(e) => handleDeleteCustomerObject(e, item)}
            className="absolute top-1.5 left-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            title={t("Xoá nhân vật")}
          >
            {isDeleting ? (
              <CgSpinner className="text-xs text-white animate-spin" />
            ) : (
              <RiDeleteBin6Line className="text-xs text-white" />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ── Field with pen icon + Input ── */}
      <div className="p-2 rounded-xl border border-gray-200">
        <Field
          noError={noError}
          label={
            <span className="flex items-center gap-1.5 justify-between w-full">
              {label || t("Nhân vật")}
              <Button
                outline
                info
                onClick={openDialog}
                className="px-1 h-6"
                text={t("Mẫu")}
                icon={<RiEdit2Line className="text-sm" />}
              />
            </span>
          }
        >
          <div className="w-full">
            <ObjectPersonifyFieldTabBar
              activeTab={fieldTab}
              imageLabel={t("Ảnh")}
              promptLabel={t("Prompt")}
              onChange={setFieldTab}
            />
            <div className="pt-2">
              {fieldTab === "image" ? (
                <ObjectPersonifyImageUpload
                  imageValue={imageValue}
                  onImageChange={handleImageChange}
                  readOnly={readOnly}
                />
              ) : (
                <Textarea
                  name={name}
                  id="object-to-personify-input"
                  className="border-gray-200"
                  placeholder={`${t("VD")}: ${t("Một quả chuối tươi")}`}
                  value={value || ""}
                  readOnly={readOnly}
                  onChange={handlePromptChange}
                />
              )}
            </div>
          </div>
        </Field>
      </div>
      {/* ── Dialog ── */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={t("Chọn nhân vật nhân hoá")}
        width="640px"
        maxWidth="95vw"
        onOverlayClick={() => {
          // Tắt overlay click
        }}
      >
        <Dialog.Body>
          <div className="">
            {/* ── Back button when creating ── */}
            <div
              className={`flex items-center gap-2  w-full ${
                showImageInput ? "justify-start" : "justify-end"
              }`}
            >
              {showImageInput && (
                <Button
                  icon={<RiArrowLeftLine />}
                  text={t("Quay lại danh sách")}
                  className="px-0 h-8"
                  onClick={() => setShowImageInput(!showImageInput)}
                />
              )}
            </div>

            {/* ── Lists (system + customer objects) ── */}
            {!showImageInput &&
              (isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <CgSpinner className="text-2xl text-blue-500 animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">{t("Đang tải...")}</span>
                </div>
              ) : (
                <div className="space-y-4 w-full">
                  {/* ── Customer Objects Section ("Nhân vật của tôi") ── */}
                  {customerObjects.length > 0 && (
                    <div>
                      <Label
                        text={t("Nhân vật của tôi")}
                        className="mb-3 text-sm font-semibold text-purple-700"
                      />
                      <div className="grid md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-3 max-h-[250px] overflow-y-auto pr-1">
                        {customerObjects.map((item) =>
                          renderObjectCard(item, { showDelete: true })
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Server Objects Section ("Nhân vật có sẵn") ── */}
                  {serverObjects.length > 0 && (
                    <div>
                      <Label
                        text={t("Danh sách nhân vật có sẵn")}
                        className="mb-3 text-sm font-semibold text-gray-700"
                      />
                      <div className="grid md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                        {serverObjects.map((item) => renderObjectCard(item))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {serverObjects.length === 0 && customerObjects.length === 0 && (
                    <div className="py-6 text-sm text-center text-gray-400">
                      {t("Chưa có nhân vật nhân hoá nào")}
                    </div>
                  )}

                  {/* ── Create new button ── */}
                  <div className="flex justify-center items-center mt-4 w-full">
                    <Button
                      primary
                      icon={<RiAddLine />}
                      text={t("Tạo nhân vật mới")}
                      className="rounded-lg"
                      onClick={() => setShowImageInput(!showImageInput)}
                    />
                  </div>
                </div>
              ))}

            {/* ── Custom object creation form ── */}

            {showImageInput && (
              <div className="rounded-xl">
                {
                  <div className="p-2 rounded-xl border border-gray-200">
                    <div className="flex gap-4 w-full">
                      <div className="w-1/3">
                        {" "}
                        <Field>
                          <div className="relative">
                            <ImageInput
                              largeImage
                              value={objectImageUrl}
                              onChange={(v) => setObjectImageUrl(v as string)}
                              placeholder={t("Link Ảnh nhân vật nhân hóa")}
                            />
                            {isGeneratingImage && (
                              <div className="flex absolute inset-0 top-20 z-10 flex-col justify-center items-center rounded-lg bg-white/70">
                                <CgSpinner className="text-2xl text-blue-500 animate-spin" />
                                <span className="mt-2 text-sm font-medium text-blue-500">
                                  {t("Đang tạo ảnh nhân vật từ AI...")}
                                </span>
                              </div>
                            )}
                          </div>
                        </Field>
                      </div>
                      <div className="w-full">
                        {/* ── Name (required) ── */}
                        <Field label={t("Tên nhân vật nhân hóa")} required>
                          <Input
                            id="custom-object-name"
                            className="border-gray-200"
                            placeholder={`${t("VD")}: ${t("Quả chuối tươi")}`}
                            value={objectName}
                            onChange={(v) => setObjectName(v)}
                          />
                        </Field>
                        {/* ── Prompt (always visible) ── */}
                        <Field label={t("Prompt mô tả nhân vật")} required>
                          <div className="relative">
                            <Textarea
                              id="custom-object-prompt"
                              className="border-gray-200 h-22"
                              placeholder={t("Mô tả chi tiết nhân vật bạn muốn nhân hoá...")}
                              value={objectPrompt}
                              maxRows={5}
                              onChange={(v) => setObjectPrompt(v)}
                            />
                            {isGenerating && (
                              <div className="flex absolute inset-0 top-5 justify-center items-center rounded-lg bg-white/70">
                                <div className="flex gap-2 items-center text-sm text-blue-500">
                                  <CgSpinner className="text-lg animate-spin" />
                                  {t("Đang tạo prompt...")}
                                </div>
                              </div>
                            )}
                          </div>
                        </Field>
                      </div>
                    </div>
                    {showImageInput && (
                      <div className="flex justify-end items-center">
                        <Button
                          primary
                          className={`px-4 py-2 text-sm font-semibold transition-all ${
                            canSubmit
                              ? "text-white bg-blue-600 hover:bg-blue-700"
                              : "text-gray-400 bg-gray-200 cursor-not-allowed"
                          }`}
                          text={t("Lưu nhân vật")}
                          onClick={handleSubmit}
                          disabled={!canSubmit || isSaving}
                          isLoading={isSaving}
                        />
                      </div>
                    )}
                  </div>
                }
                {/* ── AI prompt helper ── */}
                <div>
                  <div className="p-2 mt-2 space-y-3 rounded-xl border border-gray-200 border-dashed">
                    <h3 className="flex gap-1 items-center font-semibold text-yellow-700 uppercase text-md">
                      <RiBookletLine /> {t("Tạo prompt mô tả nhân vật bằng AI")}
                    </h3>
                    {showPrompt && (
                      <>
                        <Field label={t("Ảnh tham chiếu")}>
                          <ImageInput
                            multi
                            value={objectImages}
                            onChange={(v) => setObjectImages(v as string[])}
                            cols={3}
                            limit={5}
                          />
                        </Field>

                        <Field label={t("Prompt")}>
                          <Textarea
                            id="custom-ai-prompt"
                            className="border-gray-200"
                            placeholder={t("Nhập prompt để tạo nhân vật theo ảnh")}
                            value={aiPrompt}
                            onChange={(v) => setAiPrompt(v)}
                          />
                        </Field>
                      </>
                    )}

                    <div className="flex gap-2 items-center">
                      <Button
                        info={!showPrompt}
                        disabled={isGenerating || isGeneratingImage}
                        onClick={() => setShowPrompt(!showPrompt)}
                        className={`px-2 whitespace-nowrap rounded-lg ${
                          showPrompt ? "text-danger" : ""
                        }`}
                        icon={
                          showPrompt ? (
                            <RiArrowDropLeftLine className="tmd" />
                          ) : (
                            <GenerateAiIcon className="tmd" />
                          )
                        }
                        text={t(showPrompt ? t("Trở lại") : t("Gợi ý prompt bằng (AI)"))}
                      />
                      {showPrompt && (
                        <Button
                          outline
                          className="flex gap-2 justify-center items-center py-2 w-full text-sm font-medium text-blue-600 rounded-lg border-blue-300 transition-colors hover:bg-blue-50"
                          onClick={handleGenerateDescription}
                          disabled={isGenerating || objectImages.length === 0}
                        >
                          {isGenerating ? (
                            <CgSpinner className="text-base animate-spin" />
                          ) : (
                            <GenerateAiIcon className="text-base" />
                          )}
                          {isGenerating ? t("Đang tạo...") : t("Tạo mô tả nhân vật từ AI")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}
