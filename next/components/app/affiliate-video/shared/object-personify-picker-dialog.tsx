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

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import {
  RiAddLine,
  RiArrowDropLeftLine,
  RiArrowLeftLine,
  RiBookletLine,
  RiDeleteBin6Line,
  RiEdit2Line,
} from "react-icons/ri";
import { uploadImage } from "../../../../lib/helpers/image";

import { useToast } from "../../../../lib/providers/toast-provider";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button, Field, ImageInput, Input, Label, Textarea } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { ObjectToPersonifyPublic, useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ObjectPersonifyPickerDialogProps {
  /** Current objectToPersonify value */
  value?: string;
  /** Fired when the user picks a custom object or types free text */
  onChange?: (value: string) => void;
  /** Callback to set display name separately (optional) */
  onNameChange?: (name: string) => void;
  /** Field label override */
  label?: string;
  /** Pass `true` to hide the Field wrapper error display */
  noError?: boolean;
  /** Optional field name for react-hook-form */
  name?: string;
}

const DEFAULT_PROMPT = `SYS Style Prompt Generator, Please describe the character in the image in the most detailed and complete manner possible (skin tone, hair color, description of eyes, nose, mouth, eyebrows, skin wrinkles, clothing stitching, accessories, dimensions, materials, colors of all parts, style, lighting, atmosphere, effects, 8k resolution, etc.). Do not use abbreviations, do not add creative elements, and describe every single part of the character.`;

// ── Component ──────────────────────────────────────────────────────────────

export function ObjectPersonifyPickerDialog({
  value,
  onChange,
  onNameChange,
  label,
  noError = true,
  name,
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

  // ── Selected display name (for showing in the input) ──
  const [selectedDisplayName, setSelectedDisplayName] = useState("");

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
    if (onChange) {
      // Pass the code as the objectToPersonify value
      onChange(item.code);
    }
    setSelectedDisplayName(item.name);
    setIsDialogOpen(false);
  };

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
          if (onChange) onChange("");
          setSelectedDisplayName("");
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
        // Auto-select the new custom object
        if (onChange) {
          onChange(result.code);
        }
        setSelectedDisplayName(result.name);

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
          group relative cursor-pointer rounded-xl overflow-hidden
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
        <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
          {item.imageUrl ? (
            <Img
              showImageOnClick
              src={item.imageUrl}
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
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
              <CgSpinner className="animate-spin text-white text-xs" />
            ) : (
              <RiDeleteBin6Line className="text-white text-xs" />
            )}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {/* ── Field with pen icon + Input ── */}
      <Field
        noError={noError}
        name={name}
        label={
          <span className="flex items-center gap-1.5 justify-between w-full">
            {label || t("Nhân hoá đồ vật")}
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
        <div className="space-y-2">
          <Input
            id="object-to-personify-input"
            className="border-gray-200"
            placeholder={t("VD: Một quả chuối tươi")}
            value={selectedDisplayName || value || ""}
            onChange={(v) => {
              if (onChange) onChange(v);
              setSelectedDisplayName(v);
            }}
          />
        </div>
      </Field>

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
          <div className=" ">
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
                <div className="flex items-center justify-center py-8">
                  <CgSpinner className="animate-spin text-2xl text-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">{t("Đang tải...")}</span>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  {/* ── Customer Objects Section ("Nhân vật của tôi") ── */}
                  {customerObjects.length > 0 && (
                    <div>
                      <Label
                        text={t("Nhân vật của tôi")}
                        className="text-sm font-semibold text-purple-700 mb-3"
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
                        className="text-sm font-semibold text-gray-700 mb-3"
                      />
                      <div className="grid md:grid-cols-4 sm:grid-cols-3 grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1">
                        {serverObjects.map((item) => renderObjectCard(item))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {serverObjects.length === 0 && customerObjects.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-400">
                      {t("Chưa có nhân vật nhân hoá nào")}
                    </div>
                  )}

                  {/* ── Create new button ── */}
                  <div className="w-full mt-4 flex items-center justify-center  ">
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
                  <div className="border border-gray-200 rounded-xl p-2">
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
                              <div className="absolute top-20 inset-0 flex flex-col items-center justify-center bg-white/70 rounded-lg z-10">
                                <CgSpinner className="animate-spin text-2xl text-blue-500" />
                                <span className="mt-2 text-sm text-blue-500 font-medium">
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
                            placeholder={t("VD: Quả chuối tươi")}
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
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg top-5">
                                <div className="flex items-center gap-2 text-sm text-blue-500">
                                  <CgSpinner className="animate-spin text-lg" />
                                  {t("Đang tạo prompt...")}
                                </div>
                              </div>
                            )}
                          </div>
                        </Field>
                      </div>
                    </div>
                    {showImageInput && (
                      <div className="flex items-center justify-end">
                        <Button
                          primary
                          className={`px-4 py-2 text-sm font-semibold transition-all ${
                            canSubmit
                              ? "bg-blue-600 hover:bg-blue-700 text-white"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
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
                {/* ── Image input toggle + section ── */}
                <div>
                  <div className="mt-2 space-y-3 border p-2 border-gray-200 rounded-xl   border-dashed">
                    <h3 className="text-md font-semibold text-yellow-700 flex items-center gap-1 uppercase">
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

                    {/* ── Generate Description Button ── */}
                    <div className="flex items-center gap-2">
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
                          className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded-lg"
                          onClick={handleGenerateDescription}
                          disabled={isGenerating || objectImages.length === 0}
                        >
                          {isGenerating ? (
                            <CgSpinner className="animate-spin text-base" />
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
