/**
 * scene-batch-row.tsx
 * Mỗi hàng scene trong bảng batch + nhóm scene (row group)
 * - Bỏ cột "Cảnh" riêng, thay bằng overlay scene number + toggle trên ảnh
 * - Responsive: trên mobile hiển thị dạng card
 * Extracted from batch-list.tsx – className only, Tailwind CSS
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import {
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiImageFill,
  RiLoader4Line,
  RiPencilLine,
  RiSaveLine,
  RiSearchLine,
  RiText,
} from "react-icons/ri";

import { useToast } from "../../../../../lib/providers/toast-provider";
import { NoTextIcon } from "../../../../../public/assets/svg/no-text-icon";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button, Input } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { CharacterItem, DB_NAME, SceneScript, StoryModeTypeEnum } from "../../constants";
import { GeneratedImageData } from "../../copy-video/hook/useCopyVideoApi";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { useSceneMedia } from "../../hook/useSceneMedia";
import { SceneCardExtendVideoTab } from "../../shared/scene-card-extend-video-tab";
import { SceneCardImageTab } from "../../shared/scene-card-image-tab";
import { SceneCardTabs, SceneTabKey } from "../../shared/scene-card-tabs";
import { SceneCardVideoTab } from "../../shared/scene-card-video-tab";
import { normalizeSceneAudioField } from "../../shared/sceneAudioUtils";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { InsertPosition, NewSceneData } from "./add-scene-modal";

// ── Types ──────────────────────────────────────────────────────────────────
export type EditField =
  | "imageGenPrompt"
  | "motionPrompt"
  | "dialogue"
  | "audio"
  | "product_image_prompt";

/** Số ký tự tối đa trước khi cắt */
const PROMPT_MAX_CHARS = 160;

// ─────────────────────────────────────────────────────────────────────────────
// SceneBatchRow – mỗi hàng scene trong bảng
// ─────────────────────────────────────────────────────────────────────────────

export const SceneBatchRow = React.memo(function SceneBatchRow({
  scene,
  isDisabled,
  isGroupHovered,
  storyModeType,
  hideImageColumn,
  nextSceneId,
  forcedTab,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
  onToggleNoText,
  onUpdateSelectedProductImages,
}: {
  scene: SceneScript;
  index: number;
  nextSceneId?: string;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  storyModeType?: StoryModeTypeEnum;
  hideImageColumn?: boolean;
  /** Tab được ép chọn đồng loạt từ bên ngoài */
  forcedTab?: SceneTabKey | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
  onToggleNoText: (sceneId: string) => void;
  onUpdateSelectedProductImages?: (sceneId: string, images: string[]) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();

  const [rowHovered, setRowHovered] = useState(false);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedField, setExpandedField] = useState<EditField | null>(null);
  const [hoveredField, setHoveredField] = useState<EditField | null>(null);
  const [copiedField, setCopiedField] = useState<EditField | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showExtendVideoModal, setShowExtendVideoModal] = useState(false);
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Product image selection (per-scene, persisted in IndexedDB) ──
  const storyboardContext = useAffiliateVideoContext();
  const { scriptData, affiliateVideoFormConfig } = storyboardContext;
  const productImages = scriptData?.productImages || affiliateVideoFormConfig?.productImages || [];
  const selectedProductImagesDB = useIndexedDB<string[]>(
    "selected-product-images",
    DB_NAME.generateScene
  );
  const [selectedProductImages, setSelectedProductImages] = useState<string[]>(
    scene.selectedProductImages || []
  );

  useEffect(() => {
    // Prefer scene-level data; fall back to separate DB for backward compat
    if (scene.selectedProductImages?.length) {
      setSelectedProductImages(scene.selectedProductImages);
    } else {
      selectedProductImagesDB.get(scene.id).then((saved) => {
        if (saved) setSelectedProductImages(saved);
        else setSelectedProductImages([]);
      });
    }
  }, [scene.id, scene.selectedProductImages]);

  const handleToggleProductImage = useCallback(
    (imageUrl: string) => {
      setSelectedProductImages((prev) => {
        const next = prev.includes(imageUrl)
          ? prev.filter((url) => url !== imageUrl)
          : [...prev, imageUrl];
        // 1. Keep the legacy per-scene DB in sync
        selectedProductImagesDB.set(scene.id, next);
        // 2. Persist into sceneHistory & lastScript
        onUpdateSelectedProductImages?.(scene.id, next);
        return next;
      });
    },
    [scene.id, selectedProductImagesDB, onUpdateSelectedProductImages]
  );

  // ── Local state for product_image_prompt (avoids losing text on context re-render) ──
  const [localProductPrompt, setLocalProductPrompt] = useState(scene.product_image_prompt ?? "");
  useEffect(() => {
    setLocalProductPrompt(scene.product_image_prompt ?? "");
  }, [scene.id, scene.product_image_prompt]);

  const {
    generatedImage,
    generatingImage,
    imageProgress,
    generatedVideo,
    generatingVideo,
    videoProgress,

    generatedExtendVideo,
    generatingExtendVideo,
    extendVideoProgress,
    imageError,
    videoError,
    extendVideoError,
    handleGenerateImage,
    handleSetImage,
    handleGenerateVideo,
    handleDownloadVideo,
    handleDownloadExtendVideo,
    reportVideoError,
  } = useSceneMedia({
    scene,
    nextSceneId,
    selectedProductImages,
    noText: scene.noText,
    providerContext: storyboardContext,
  });
  const isPromptToVideo = storyModeType === StoryModeTypeEnum.prompt_to_video;

  /** Ảnh panel đã cắt từ storyboard – hiển thị phía trên (Ảnh gốc) */
  const storyboardOriginUrl = useMemo(() => {
    const crop = scene.storyboardCropImage;
    if (!crop?.imageBytes) return null;
    return `data:${crop.mimeType || "image/png"};base64,${crop.imageBytes}`;
  }, [scene.storyboardCropImage]);

  const aspectRatio = (scriptData?.aspectRatio ??
    affiliateVideoFormConfig?.aspectRatio ??
    "9:16") as "16:9" | "9:16";
  const sceneAudioText = useMemo(
    () => normalizeSceneAudioField(scene.audio),
    [scene.audio]
  );
  const videoPaddingTop = aspectRatio === "16:9" ? "56.25%" : "177.78%";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openEdit = (field: EditField) => {
    setEditingField(field);
    setEditValue(
      field === "audio" ? sceneAudioText : ((scene[field] as string | undefined) ?? "")
    );
    // focus textarea on next tick
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const closeEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleSave = async () => {
    if (!editingField) return;
    setSaving(true);
    try {
      onUpdateScene(scene.id, editingField, editValue);
    } finally {
      setSaving(false);
      closeEdit();
    }
  };

  const handleCopy = (field: EditField, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  // auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editValue]);

  /** Renders editable prompt cell content */
  const renderEditablePrompt = (
    field: EditField,
    text: string,
    textColor: string,
    labelEl: React.ReactNode
  ) => (
    <div
      className="relative"
      onMouseEnter={() => setHoveredField(field)}
      onMouseLeave={() => setHoveredField(null)}
    >
      {editingField === field ? (
        /* ── Edit mode ── */
        <div>
          {labelEl}
          <textarea
            ref={field === editingField ? textareaRef : undefined}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-blue-300 bg-blue-50 text-xs text-gray-700 px-2.5 py-2 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 resize-none transition-colors leading-relaxed"
          />
          <div className="flex items-center gap-1.5 mt-1.5 justify-end">
            <button
              onClick={closeEdit}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors  "
            >
              <RiCloseLine className="text-sm" />
              {t("Đóng")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer border-0 transition-colors disabled:opacity-60 shadow-sm"
            >
              {saving ? (
                <RiLoader4Line className="text-sm animate-spin" />
              ) : (
                <RiSaveLine className="text-sm" />
              )}
              {saving ? `${t("Đang lưu")}...` : `${t("Lưu")}`}
            </button>
          </div>
        </div>
      ) : (
        /* ── Display mode ── */
        <div className="relative">
          <span
            className={`text-xs leading-relaxed whitespace-pre-line ${textColor}`}
            style={
              expandedField !== field
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as any,
                    overflow: "hidden",
                  }
                : {}
            }
          >
            {labelEl}
            {text}
          </span>
          {/* Action icons – visible on hover */}
          <div
            className="absolute top-0 right-2 flex items-center gap-0.5 border border-primary shadow-sm bg-gray-50 rounded-md transition-opacity"
            style={{
              opacity: hoveredField === field ? 1 : 0,
              pointerEvents: hoveredField === field ? "auto" : "none",
            }}
          >
            {/* Toggle view prompt button */}
            <button
              onClick={() => setExpandedField(expandedField === field ? null : field)}
              title={expandedField === field ? t("Thu gọn") : t("Xem prompt")}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer border-0 bg-transparent ${
                expandedField === field
                  ? "text-purple-600 bg-purple-50"
                  : "text-gray-400 hover:text-purple-600 hover:bg-purple-50"
              }`}
            >
              {expandedField === field ? (
                <RiEyeOffLine className="text-sm" />
              ) : (
                <RiEyeLine className="text-sm" />
              )}
            </button>
            {/* Copy prompt button */}
            <button
              onClick={() => handleCopy(field, text)}
              title="Copy prompt"
              className="flex justify-center items-center w-6 h-6 text-gray-400 bg-transparent rounded-md border-0 transition-all cursor-pointer hover:text-green-600 hover:bg-green-50"
            >
              {copiedField === field ? (
                <span className="text-xs font-bold text-green-500">✓</span>
              ) : (
                <RiFileCopyLine className="text-sm" />
              )}
            </button>
            {/* Edit pencil button */}
            <button
              onClick={() => openEdit(field)}
              title={t("Chỉnh sửa")}
              className="flex justify-center items-center w-6 h-6 text-gray-400 bg-transparent rounded-md border-0 transition-all cursor-pointer hover:text-blue-600 hover:bg-blue-50"
            >
              <RiPencilLine className="text-sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (scene.storyboardPending) {
    const imageSlot = (scene.storyboardSourceIndex ?? 0) + 1;
    return (
      <div className="overflow-hidden bg-white rounded-xl border border-dashed border-indigo-200 shadow-sm">
        <div className="flex gap-3 items-center px-4 py-6 bg-indigo-50/50">
          <RiLoader4Line className="text-2xl text-indigo-500 animate-spin shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-gray-700">
              {t("Đang phân tích ảnh storyboard")} #{imageSlot}
            </span>
            <span className="text-xs text-gray-500">
              {t("Phân cảnh sẽ xuất hiện đúng vị trí ảnh đã upload")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all duration-200 overflow-hidden ${
        isDisabled ? "opacity-60" : "hover:shadow-md"
      } ${isGroupHovered && !isDisabled ? "ring-1 ring-purple-300" : ""}`}
      onMouseEnter={() => {
        setRowHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setRowHovered(false);
        onMouseLeave?.();
      }}
    >
      {/* ── Card Header: Scene number + toggle buttons ── */}
      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-800 text-white whitespace-nowrap mr-1">
          {`${t("Cảnh")} #${scene.sceneNumber}`}
        </span>
        <div className="flex gap-1 items-center">
          <Button
            onClick={() => onToggleDisable(scene.id)}
            className={`w-6 h-6 px-2 rounded-md shadow-sm ${
              isDisabled
                ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
            }`}
            iconClassName="text-sm"
            icon={isDisabled ? <RiEyeLine /> : <RiEyeOffLine />}
            tooltip={isDisabled ? t("Hiện Cảnh") : t("Ẩn Cảnh")}
            placement="bottom"
          />
          <Button
            disabled={isDisabled}
            onClick={() => onToggleNoText(scene.id)}
            className={`w-6 h-6 px-2 rounded-md shadow-sm ${
              scene.noText
                ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                : "text-gray-400 bg-white hover:text-blue-500 hover:bg-blue-50"
            }`}
            iconClassName="text-sm"
            icon={scene.noText ? <RiText /> : <NoTextIcon />}
            tooltip={
              scene.noText
                ? t("Đang cho phép hiển thị Chữ' trong ảnh")
                : t("Không cho phép hiển thị 'Chữ' trong ảnh")
            }
            placement="bottom"
          />
          <Button
            disabled={isDisabled}
            onClick={() => onToggleVoiceDisable(scene.id)}
            className={`w-6 h-6 px-2 rounded-md shadow-sm ${
              scene.voiceDisable
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
            }`}
            iconClassName="text-sm"
            icon={scene.voiceDisable ? <MdVoiceOverOff /> : <MdRecordVoiceOver />}
            tooltip={scene.voiceDisable ? t("Bật thoại") : t("Tắt thoại")}
            placement="bottom"
          />
        </div>
      </div>

      {/* ── Prompt section (product images only) ── */}
      <div className={`px-3 py-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        {/* Product Select Image */}
        {productImages.length > 0 && (
          <div className="relative mt-1.5">
            <span className="mr-1 text-xs font-bold tracking-wide text-blue-600 uppercase">
              {`  ${t("Chọn ảnh SP để gắn vào ảnh và video")}:`}
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {productImages.map((imgUrl, idx) => (
                <label
                  key={idx}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    selectedProductImages.includes(imgUrl)
                      ? "border-blue-500 shadow-md ring-1 ring-blue-300"
                      : "border-gray-200 hover:border-gray-300 opacity-60 hover:opacity-100"
                  }`}
                  style={{ width: 48, height: 48 }}
                >
                  <input
                    type="checkbox"
                    className="absolute top-0.5 left-0.5 z-10 w-3.5 h-3.5 accent-blue-500 cursor-pointer"
                    checked={selectedProductImages.includes(imgUrl)}
                    onChange={() => handleToggleProductImage(imgUrl)}
                  />
                  <Img
                    src={imgUrl}
                    alt={`Product ${idx + 1}`}
                    className="object-cover w-full h-full"
                    lazyload={false}
                  />
                  {selectedProductImages.includes(imgUrl) && (
                    <div className="absolute inset-0 pointer-events-none bg-blue-500/10" />
                  )}
                </label>
              ))}
            </div>
            {selectedProductImages.length > 0 && (
              <span className="text-9 text-blue-500 mt-0.5 block">
                {t("Đã chọn")} {selectedProductImages.length}/{productImages.length}
              </span>
            )}
            {selectedProductImages.length > 0 && (
              <div className="mt-2">
                <span className="font-semibold tracking-wide text-blue-600 uppercase text-9">
                  {t("Prompt SP")}:
                </span>
                <textarea
                  value={localProductPrompt}
                  onChange={(e) => setLocalProductPrompt(e.target.value)}
                  onBlur={() => onUpdateScene(scene.id, "product_image_prompt", localProductPrompt)}
                  placeholder={t(
                    "Nhập prompt tùy chỉnh cho ảnh sản phẩm... (để trống sẽ dùng prompt mặc định)"
                  )}
                  rows={2}
                  className="w-full mt-1 rounded-lg border border-blue-200 bg-blue-50/50 text-xs text-gray-700 px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors placeholder-gray-400 leading-relaxed"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Media tabs (Hình ảnh / Video đơn / Video nối) ── */}
      <SceneCardTabs
        hideImageTab={isPromptToVideo || !!hideImageColumn}
        hideExtendTab={isPromptToVideo || !nextSceneId}
        forcedTab={forcedTab}
        tabStatus={{
          image: { loading: generatingImage, progress: imageProgress, done: !!generatedImage },
          video: { loading: generatingVideo, progress: videoProgress, done: !!generatedVideo },
          extend: {
            loading: generatingExtendVideo,
            progress: extendVideoProgress,
            done: !!generatedExtendVideo,
          },
        }}
        renderImageTab={() => (
          <SceneCardImageTab
            aspectRatio={aspectRatio}
            generatedImage={generatedImage}
            generatingImage={generatingImage}
            imageProgress={imageProgress}
            sceneNumber={scene.sceneNumber}
            isDisabled={isDisabled}
            onGenerateImage={handleGenerateImage}
            onSetImage={handleSetImage}
            onOpenGallery={() => setShowGalleryDialog(true)}
            originThumbnailUrl={storyboardOriginUrl}
            errorMessage={imageError}
          />
        )}
        renderVideoTab={() => (
          <SceneCardVideoTab
            generatedVideo={generatedVideo}
            generatingVideo={generatingVideo}
            videoProgress={videoProgress}
            isDisabled={isDisabled}
            hasImage={!!generatedImage}
            isPromptToVideo={isPromptToVideo}
            aspectRatio={aspectRatio}
            errorMessage={videoError}
            onImageRequired={() => reportVideoError(t("Cần tạo ảnh trước khi tạo video"))}
            sceneNumber={scene.sceneNumber}
            onGenerateVideo={() => handleGenerateVideo()}
          />
        )}
        renderExtendTab={() => (
          <SceneCardExtendVideoTab
            generatedExtendVideo={generatedExtendVideo}
            generatingExtendVideo={generatingExtendVideo}
            extendVideoProgress={extendVideoProgress}
            isDisabled={isDisabled}
            nextSceneId={nextSceneId}
            aspectRatio={aspectRatio}
            errorMessage={extendVideoError}
            sceneNumber={scene.sceneNumber}
            onGenerateExtendVideo={() => handleGenerateVideo(true)}
          />
        )}
        renderImagePrompt={() => (
          <div className={`${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            {renderEditablePrompt(
              "imageGenPrompt",
              scene.imageGenPrompt,
              "text-gray-600",
              <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                IMAGE PROMPT
              </span>
            )}
          </div>
        )}
        renderVideoPrompts={() => (
          <div className={`${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            {renderEditablePrompt(
              "motionPrompt",
              scene.motionPrompt,
              "text-teal-700",
              <span className="mr-1 text-xs font-bold tracking-wide uppercase text-teal">
                [MOTION]:
              </span>
            )}
            {renderEditablePrompt(
              "audio",
              sceneAudioText,
              "text-purple-700",
              <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                [AUDIO]:
              </span>
            )}
            {renderEditablePrompt(
              "dialogue",
              scene.dialogue ?? "",
              "text-green-700 italic",
              <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                [DIALOGUE]:
              </span>
            )}
          </div>
        )}
      />

      {/* Hidden file input for upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            const base64 = (reader.result as string).split(",")[1];
            if (base64) {
              handleSetImage({
                imageBytes: base64,
                mimeType: file.type || "image/png",
                fifeUrl: "",
              });
              toast.success(t("Đã upload ảnh thành công"));
            }
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
      {/* Gallery Dialog */}
      <ImageGalleryDialog
        isOpen={showGalleryDialog}
        onClose={() => setShowGalleryDialog(false)}
        onSelect={(imageData) => {
          handleSetImage(imageData);
          setShowGalleryDialog(false);
          toast.success(t("Đã chọn ảnh từ Gallery"));
        }}
      />
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SceneRowGroup – nhóm row: nút thêm trên + scene row + nút thêm dưới
// Quản lý hover state chung cho cả nhóm
// ─────────────────────────────────────────────────────────────────────────────

interface SceneRowGroupProps {
  scene: SceneScript;
  index: number;
  nextSceneId?: string;
  isDisabled: boolean;
  characters: CharacterItem[];
  storyModeType?: StoryModeTypeEnum;
  hideImageColumn?: boolean;
  forcedTab?: SceneTabKey | null;
  onInsert: (
    scene: SceneScript,
    position: InsertPosition,
    data: NewSceneData
  ) => Promise<void> | void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
  onToggleNoText: (sceneId: string) => void;
  onUpdateSelectedProductImages?: (sceneId: string, images: string[]) => void;
}

export function SceneRowGroup({
  scene,
  index,
  nextSceneId,
  isDisabled,
  characters,
  storyModeType,
  forcedTab,
  onInsert,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
  onToggleNoText,
  onUpdateSelectedProductImages,
}: SceneRowGroupProps) {
  const [hovered, setHovered] = useState(false);
  const enter = () => setHovered(true);
  const leave = () => setHovered(false);

  return (
    <div className="relative group" onMouseEnter={enter} onMouseLeave={leave}>
      {/* Add ABOVE button – centered on top border, only visible on hover
      {index === 0 && (
        <div
          className={`absolute -top-3 left-0 right-0 flex justify-center z-20 transition-all duration-200 ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <AddSceneButton
            scene={scene}
            position="above"
            characters={characters}
            onInsert={onInsert}
          />
        </div>
      )} */}

      {/* Scene data row */}
      <SceneBatchRow
        scene={scene}
        index={index}
        nextSceneId={nextSceneId}
        isDisabled={isDisabled}
        isGroupHovered={hovered}
        storyModeType={storyModeType}
        forcedTab={forcedTab}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onUpdateScene={onUpdateScene}
        onToggleDisable={onToggleDisable}
        onToggleVoiceDisable={onToggleVoiceDisable}
        onToggleNoText={onToggleNoText}
        onUpdateSelectedProductImages={onUpdateSelectedProductImages}
      />

      {/* Add BELOW button – centered on bottom border, only visible on hover
      <div
        className={`absolute -bottom-3 left-0 right-0 flex justify-center z-20 transition-all duration-200 ${
          hovered ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <AddSceneButton
          scene={scene}
          position="below"
          characters={characters}
          onInsert={onInsert}
        />
      </div> */}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ImageGalleryDialog – hiển thị danh sách ảnh từ IndexedDB để chọn
// ─────────────────────────────────────────────────────────────────────────────

function ImageGalleryDialog({
  isOpen,
  onClose,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageData: GeneratedImageData) => void;
}) {
  const { t } = useTranslation();
  const imageDB = useIndexedDB<GeneratedImageData>("generated-images", DB_NAME.generateImage);
  const [images, setImages] = useState<{ key: string; data: GeneratedImageData }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await imageDB.getAllWithKeys();
      const items = entries
        .filter((e) => e.value?.imageBytes)
        .map((e) => ({
          key: String(e.key),
          data: e.value,
        }))
        .reverse(); // newest first
      setImages(items);
    } catch (err) {
      console.error("[ImageGalleryDialog] Error loading images:", err);
    } finally {
      setLoading(false);
    }
  }, [imageDB]);

  useEffect(() => {
    if (isOpen) {
      loadImages();
    }
  }, [isOpen]);

  const filteredImages = searchQuery.trim()
    ? images.filter((img) => img.key.toLowerCase().includes(searchQuery.toLowerCase()))
    : images;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Chọn ảnh từ Gallery")}
      width="90vw"
      maxWidth="800px"
    >
      <div className="p-4">
        {/* Search bar */}
        <div className="relative mb-4">
          <Input
            prefix={<RiSearchLine />}
            placeholder={t("Tìm theo key...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="py-2 pr-3 w-full text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <RiLoader4Line className="text-3xl animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredImages.length === 0 && (
          <div className="flex flex-col justify-center items-center py-16 text-gray-400">
            <RiImageFill className="mb-3 text-5xl" />
            <p className="text-base">{t("Chưa có ảnh nào")}</p>
            <p className="mt-1 text-sm">{t("Ảnh được tạo từ AI sẽ xuất hiện ở đây")}</p>
          </div>
        )}

        {/* Grid */}
        {!loading && filteredImages.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredImages.map((item) => (
              <div
                key={item.key}
                className="overflow-hidden relative rounded-xl border-2 border-transparent transition-all cursor-pointer group hover:border-primary hover:shadow-lg"
                onClick={() => onSelect(item.data)}
              >
                <div className="relative aspect-[9/16] bg-gray-50">
                  <Img
                    showImageOnClick
                    lazyload={false}
                    src={`data:${item.data.mimeType};base64,${item.data.imageBytes}`}
                    alt={item.key}
                    className="object-cover rounded-md border border-green-300 border-dashed shadow-sm"
                    ratio916
                  />

                  {/* Hover overlay */}
                  <div className="flex absolute inset-0 justify-center items-center rounded-xl opacity-0 transition-opacity bg-black/30 group-hover:opacity-100">
                    <span className="px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-full shadow-lg">
                      {t("Chọn ảnh")}
                    </span>
                  </div>
                </div>
                {/* Key label */}
                <div className="px-2 py-1.5 bg-white">
                  <span
                    className="text-[10px] text-gray-500 truncate block max-w-full"
                    title={item.key}
                  >
                    {item.key}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total count */}
        {!loading && filteredImages.length > 0 && (
          <div className="mt-3 text-sm text-center text-gray-400">
            {t("Tổng")}: {filteredImages.length} {t("ảnh")}
          </div>
        )}
      </div>
    </Dialog>
  );
}
