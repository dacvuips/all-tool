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
import { RiAddLine, RiEdit2Line, RiMagicLine } from "react-icons/ri";

import { MdClose } from "react-icons/md";
import { useToast } from "../../../../lib/providers/toast-provider";
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
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { ObjectToPersonifyPublic } from "../hook/useAffiliateVideoApi";
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
  const { generateStyleText, getActiveObjectToPersonifyList } = useAffiliateVideoApi();

  // ── Dialog state ──
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);

  // ── Form fields ──
  const [objectName, setObjectName] = useState("");
  const [objectPrompt, setObjectPrompt] = useState("");
  const [objectImages, setObjectImages] = useState<string[]>([]);

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
    setObjectImages([]);
    setShowImageInput(false);
  };

  // ── Open dialog ──
  const openDialog = () => {
    resetForm();
    setIsDialogOpen(true);
    loadServerObjects();
  };

  // ── Generate object description via API ──
  const handleGenerateDescription = async () => {
    if (!objectName.trim()) {
      toast.error(t("Vui lòng nhập nhân vật nhân hóa"));
      return;
    }

    setIsGenerating(true);
    try {
      const generatedText = await generateStyleText(objectImages);
      if (generatedText) {
        setObjectPrompt(generatedText);
        toast.success(t("Đã tạo mô tả đồ vật thành công"));
      }
    } catch {
      toast.error(t("Không thể tạo mô tả. Vui lòng thử lại."));
    } finally {
      setIsGenerating(false);
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
      const newObj: CustomPersonifyObject = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: objectName.trim(),
        prompt: objectPrompt.trim(),
        images: objectImages,
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
          <div className="space-y-4 pt-3">
            {/* ── Server Objects Grid ── */}
            {isLoadingServer ? (
              <div className="flex items-center justify-center py-8">
                <CgSpinner className="animate-spin text-2xl text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">{t("Đang tải...")}</span>
              </div>
            ) : serverObjects.length > 0 ? (
              <div>
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
                            ${isSelected ? "text-blue-700" : "text-gray-700 group-hover:text-blue-600"}
                          `}
                          >
                            {item.name}
                          </span>
                        </div>

                        {/* Selected checkmark */}
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-sm text-gray-400">
                {t("Chưa có nhân vật nhân hoá nào")}
              </div>
            )}

            {/* ── Divider ── */}
            {serverObjects.length > 0 && showImageInput && (
              <div className="border-t border-gray-200 my-2" />
            )}

            {/* ── Custom object creation form ── */}
            {showImageInput && (
              <div className="space-y-4 bg-gray-50 rounded-xl p-4">
                <Label
                  text={t("Tạo nhân vật mới")}
                  className="text-sm font-semibold text-gray-700"
                />
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

                {/* ── Prompt (required) ── */}
                <Field label={t("Prompt mô tả nhân vật")} required>
                  <Textarea
                    id="custom-object-prompt"
                    className="border-gray-200"
                    placeholder={t("Mô tả chi tiết nhân vật bạn muốn nhân hoá...")}
                    value={objectPrompt}
                    onChange={(v) => setObjectPrompt(v)}
                  />
                </Field>

                {/* ── Image input ── */}
                <div className="space-y-3">
                  <Label text={t("Ảnh tham chiếu")} className="text-sm font-medium text-gray-700" />
                  <ImageInput
                    multi
                    value={objectImages}
                    onChange={(v) => setObjectImages(v as string[])}
                    cols={3}
                    limit={5}
                  />

                  {/* ── Generate Description Button ── */}
                  <div className="flex items-center gap-2">
                    <Button
                      outline
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors rounded-lg"
                      onClick={handleGenerateDescription}
                      disabled={isGenerating || !objectName.trim()}
                    >
                      {isGenerating ? (
                        <CgSpinner className="animate-spin text-base" />
                      ) : (
                        <RiMagicLine className="text-base" />
                      )}
                      {isGenerating ? t("Đang tạo...") : t("Tạo mô tả nhân vật từ AI")}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <Dialog.Footer>
            <div className="flex items-center justify-end gap-2 w-full mt-2 border-t pt-4  ">
              <Button
                primary={!showImageInput}
                outline={showImageInput}
                danger={showImageInput}
                icon={showImageInput ? <MdClose /> : <RiAddLine />}
                text={t(showImageInput ? t("Hủy tạo nhân vật mới") : t("Tạo nhân vật mới"))}
                onClick={() => setShowImageInput(!showImageInput)}
              />

              {showImageInput && (
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
              )}
            </div>
          </Dialog.Footer>
        </Dialog.Body>
      </Dialog>
    </>
  );
}
