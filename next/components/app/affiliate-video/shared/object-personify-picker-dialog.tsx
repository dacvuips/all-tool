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
 *  - Also supports creating custom objects stored locally in IndexedDB
 *  - A Select dropdown to pick previously saved custom objects
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { CgSpinner } from "react-icons/cg";
import {
  RiAddLine,
  RiArrowDropLeftLine,
  RiArrowLeftLine,
  RiBookletLine,
  RiEdit2Line,
} from "react-icons/ri";
import { uploadImage } from "../../../../lib/helpers/image";

import { useToast } from "../../../../lib/providers/toast-provider";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import {
  Button,
  Field,
  ImageInput,
  Input,
  Label,
  Select,
  Textarea,
} from "../../../shared/utilities/form";
import { DB_NAME } from "../constants";
import { ObjectToPersonifyPublic, useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { useIndexedDB } from "../hook/useIndexedDB";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CustomPersonifyObject {
  id: string;
  name: string;
  prompt: string;
  images: string[];
  createdAt: number;
}

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

// ── DB constants ───────────────────────────────────────────────────────────

const CUSTOM_OBJECT_STORE = "custom-personify-objects";
const CUSTOM_OBJECT_DB = DB_NAME.generateImage || "generate-image";

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
  const { generateStyleText, generateImage, getActiveObjectToPersonifyList } =
    useAffiliateVideoApi();

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

  // ── Server-managed objects ──
  const [serverObjects, setServerObjects] = useState<ObjectToPersonifyPublic[]>([]);
  const [isLoadingServer, setIsLoadingServer] = useState(false);

  // ── Selected display name (for showing in the input) ──
  const [selectedDisplayName, setSelectedDisplayName] = useState("");

  // ── Custom objects from IndexedDB ──
  const [customObjects, setCustomObjects] = useState<CustomPersonifyObject[]>([]);

  const db = useIndexedDB<CustomPersonifyObject>(CUSTOM_OBJECT_STORE, CUSTOM_OBJECT_DB);

  // ── Load custom objects on mount ──
  useEffect(() => {
    loadCustomObjects();
  }, []);

  const loadCustomObjects = useCallback(async () => {
    try {
      const all = await db.getAll();
      setCustomObjects(all || []);
    } catch {
      setCustomObjects([]);
    }
  }, [db]);

  // ── Load server objects when dialog opens ──
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

  // ── Build options from custom objects ──
  const customOptions = customObjects.map((o) => ({
    value: `custom_${o.id}`,
    label: `✨ ${o.name}`,
  }));

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

  // ── Save to IndexedDB ──
  const saveCustomObject = useCallback(
    async (obj: CustomPersonifyObject) => {
      try {
        await db.set(obj.id, obj);
        await loadCustomObjects();
      } catch (err) {
        console.error("[ObjectPersonifyPickerDialog] saveCustomObject error:", err);
        throw err;
      }
    },
    [db, loadCustomObjects]
  );

  // ── Handle select change (custom objects from IndexedDB) ──
  const handleSelectChange = (v: string) => {
    if (!v) {
      // Cleared selection
      if (onChange) onChange("");
      setSelectedDisplayName("");
      return;
    }

    // Check if it's a custom object
    if (v.startsWith("custom_")) {
      const objId = v.replace("custom_", "");
      const obj = customObjects.find((o) => o.id === objId);
      if (obj && onChange) {
        // Use the object's name as the value for objectToPersonify
        onChange(obj.name);
        setSelectedDisplayName(obj.name);
      }
    }
  };

  // ── Handle server object selection ──
  const handleSelectServerObject = (item: ObjectToPersonifyPublic) => {
    if (onChange) {
      // Pass the code as the objectToPersonify value
      onChange(item.code);
    }
    setSelectedDisplayName(item.name);
    setIsDialogOpen(false);
  };

  // ── Submit handler (custom object) ──
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
      // Include the AI-generated image URL alongside reference images
      const allImages = objectImageUrl ? [objectImageUrl, ...objectImages] : objectImages;

      const newObj: CustomPersonifyObject = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: objectName.trim(),
        prompt: objectPrompt.trim(),
        images: allImages,
        createdAt: Date.now(),
      };

      await saveCustomObject(newObj);

      // Auto-select the new custom object → set name as value
      if (onChange) {
        onChange(newObj.name);
      }
      setSelectedDisplayName(newObj.name);

      toast.success(t("Đã lưu đồ vật tùy chỉnh"));
      setIsDialogOpen(false);
      resetForm();
    } catch {
      toast.error(t("Không thể lưu. Vui lòng thử lại."));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Validation flags ──
  const canSubmit = objectName.trim().length > 0 && objectPrompt.trim().length > 0;

  return (
    <>
      {/* ── Field with pen icon + Textarea ── */}
      <Field
        noError={noError}
        name={name}
        label={
          <span className="flex items-center gap-1.5">
            {label || t("Nhân hoá đồ vật")}
            <button
              type="button"
              onClick={openDialog}
              className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-blue-100 transition-colors text-gray-500 hover:text-blue-600"
              title={t("Chọn nhân vật nhân hoá")}
            >
              <RiEdit2Line className="text-sm" />
            </button>
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
          {/* Quick-pick from saved custom objects */}
          {customOptions.length > 0 && (
            <Select
              native
              id="object-personify-select"
              className="border-gray-200"
              options={[{ value: "", label: t("-- Chọn đồ vật đã lưu --") }, ...customOptions]}
              onChange={handleSelectChange}
            />
          )}
        </div>
      </Field>

      {/* ── Dialog ── */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={t("Chọn nhân vật nhân hoá")}
        width="640px"
        maxWidth="95vw"
      >
        <Dialog.Body>
          <div className=" ">
            {/* ── Server Objects Grid ── */}
            <div
              className={`flex items-center gap-2  w-full ${
                showImageInput ? "justify-start" : "justify-end"
              }`}
            >
              {showImageInput && (
                <Button
                  icon={<RiArrowLeftLine />}
                  text={t("Quay lại")}
                  className="px-0 h-8"
                  onClick={() => setShowImageInput(!showImageInput)}
                />
              )}
            </div>
            {!showImageInput &&
              (isLoadingServer ? (
                <div className="flex items-center justify-center py-8">
                  <CgSpinner className="animate-spin text-2xl text-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">{t("Đang tải...")}</span>
                </div>
              ) : serverObjects.length > 0 ? (
                <div className="w-full">
                  <Label
                    text={t("Danh sách nhân vật có sẵn")}
                    className="text-sm font-semibold text-gray-700 mb-3"
                  />
                  <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                    {serverObjects.map((item) => {
                      const isSelected = value === item.code;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectServerObject(item)}
                          className={`
                            group relative cursor-pointer rounded-xl overflow-hidden
                            border-2 transition-all duration-200 hover:shadow-lg hover:scale-[1.02]
                            ${
                              isSelected
                                ? "border-blue-500 shadow-md shadow-blue-100 ring-2 ring-blue-200"
                                : "border-gray-200 hover:border-blue-300"
                            }
                          `}
                        >
                          {/* Image */}
                          <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                            {item.imageUrl ? (
                              <img
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
                              ${
                                isSelected
                                  ? "text-blue-700"
                                  : "text-gray-700 group-hover:text-blue-600"
                              }
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
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
              ) : (
                <div className="text-center py-6 text-sm text-gray-400">
                  {t("Chưa có nhân vật nhân hoá nào")}
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
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/70 rounded-lg z-10">
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
                              <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
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
