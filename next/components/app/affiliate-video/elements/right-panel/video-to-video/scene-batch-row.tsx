/**
 * scene-batch-row.tsx
 * Mỗi hàng scene trong bảng batch + nhóm scene (row group)
 * - Bỏ cột "Cảnh" riêng, thay bằng overlay scene number + toggle trên ảnh
 * - Responsive: trên mobile hiển thị dạng card
 * Extracted from batch-list.tsx – className only, Tailwind CSS
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import {
  RiCloseLine,
  RiDeleteBinLine,
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
import { useAlert } from "../../../../../../lib/providers/alert-provider";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { NoTextIcon } from "../../../../../../public/assets/svg/no-text-icon";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { Button, Input } from "../../../../../shared/utilities/form";
import { Img } from "../../../../../shared/utilities/misc";
import {
  CharacterItem,
  CopyVideoScene,
  DB_NAME,
  ElementFormImage,
  ElementFormVideo,
} from "../../../constants";
import { SceneAutoDownloadButton } from "../../../shared/scene-auto-download-button";
import { SceneCardExtendVideoTab } from "../../../shared/scene-card-extend-video-tab";
import { SceneCardImageTab } from "../../../shared/scene-card-image-tab";
import { fileToGenerationImageBase64 } from "../../../shared/compressGenerationImage";
import {
  getGeneratedImagePreviewSrc,
  hasGeneratedImageData,
  toUiGeneratedImage,
} from "../../../shared/generatedMediaUtils";
import { SceneCardTabs, SceneTabKey } from "../../../shared/scene-card-tabs";
import { SceneCardVideoTab } from "../../../shared/scene-card-video-tab";
import { GeneratedImageData } from "../../hook/useElementApi";

import { useIndexedDB } from "../../../hook/useIndexedDB";
import { useSceneThumbnail } from "../../../hook/useVideoThumbnail";
import { useElementSceneMedia } from "../../hook/useElementSceneMedia";
import { useElementContext } from "../../providers/element-provider";
import { resolveElementAspectRatio } from "../../utils/elementSceneGenerationParams";
import { createElementImageSlotsChangeHandler } from "../../utils/createElementImageSlotsChangeHandler";
import { InsertPosition, NewSceneData } from "../add-scene-modal";
import { SceneElementImagesRow } from "./scene-element-images-row";
import { SceneElementVideosRow } from "./scene-element-videos-row";

// ── Types ──────────────────────────────────────────────────────────────────
export type EditField =
  | "visual_prompt"
  | "motion_description"
  | "original_content"
  | "audio_description"
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
  hideImageColumn,
  nextSceneId,
  forcedTab,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
  onToggleNoText,
  onToggleNoDownload,
  onSetSceneAutoDownloadImageResolution,
  onSetSceneAutoDownloadVideoResolution,
  onUpdateSelectedProductImages,
  onUpdateElementImageSlots,
  onUpdateElementVideoSlots,
  onDeleteScene,
}: {
  scene: CopyVideoScene;
  index: number;
  nextSceneId?: string;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  hideImageColumn?: boolean;
  /** Tab được ép chọn đồng loạt từ bên ngoài */
  forcedTab?: SceneTabKey | null;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
  onToggleNoText: (sceneId: string) => void;
  onToggleNoDownload: (sceneId: string) => void;
  onSetSceneAutoDownloadImageResolution: (sceneId: string, resolution: "1K" | "2K" | "4K") => void;
  onSetSceneAutoDownloadVideoResolution: (sceneId: string, resolution: "720p" | "1080p") => void;
  onUpdateSelectedProductImages?: (sceneId: string, images: string[]) => void;
  onUpdateElementImageSlots?: (
    sceneId: string,
    slots: (ElementFormImage | undefined)[],
    imageUrls: string[]
  ) => void;
  onUpdateElementVideoSlots?: (sceneId: string, slots: (ElementFormVideo | undefined)[]) => void;
  onDeleteScene?: (sceneId: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const Alert = useAlert();

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
  // ── Thumbnail from IndexedDB (saved during video analysis) ──
  const { thumbnailUrl: thumbnailOriginImage, loading: thumbnailLoading } = useSceneThumbnail(
    scene.id
  );
  const { scriptData, elementFormConfig } = useElementContext();
  const aspectRatio = resolveElementAspectRatio(
    scriptData,
    elementFormConfig?.aspectRatio
  ) as "16:9" | "9:16";

  // ── Ảnh tham chiếu 3 ô (per-scene) ──
  const selectedProductImagesDB = useIndexedDB<string[]>(
    "selected-images",
    DB_NAME.generateElement
  );
  const [selectedProductImages, setSelectedProductImages] = useState<string[]>(
    scene.selectedProductImages || []
  );
  const [selectedElementImageSlots, setSelectedElementImageSlots] = useState<
    (ElementFormImage | undefined)[]
  >(scene.elementImageSlots || []);

  useEffect(() => {
    if (scene.selectedProductImages?.length) {
      setSelectedProductImages(scene.selectedProductImages);
    } else {
      selectedProductImagesDB.get(scene.id).then((saved) => {
        if (saved) setSelectedProductImages(saved);
        else setSelectedProductImages([]);
      });
    }
  }, [scene.id, scene.selectedProductImages]);

  useEffect(() => {
    setSelectedElementImageSlots(scene.elementImageSlots || []);
  }, [scene.id, scene.elementImageSlots]);

  const handleElementImageSlotsChange = useCallback(
    createElementImageSlotsChangeHandler({
      sceneId: scene.id,
      elementFormConfig,
      setSelectedElementImageSlots,
      setSelectedProductImages,
      selectedProductImagesDB,
      onUpdateSelectedProductImages,
      onUpdateElementImageSlots,
    }),
    [
      scene.id,
      elementFormConfig,
      selectedProductImagesDB,
      onUpdateSelectedProductImages,
      onUpdateElementImageSlots,
    ]
  );

  // ── Video tham chiếu 1 ô (per-scene) ──
  const [selectedElementVideoSlots, setSelectedElementVideoSlots] = useState<
    (ElementFormVideo | undefined)[]
  >(scene.elementVideoSlots || []);

  useEffect(() => {
    setSelectedElementVideoSlots(scene.elementVideoSlots || []);
  }, [scene.id, scene.elementVideoSlots]);

  const handleElementVideoSlotsChange = useCallback(
    (slots: (ElementFormVideo | undefined)[]) => {
      setSelectedElementVideoSlots(slots);
      onUpdateElementVideoSlots?.(scene.id, slots);
    },
    [scene.id, onUpdateElementVideoSlots]
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
    imageError,
    generatedVideo,
    generatingVideo,
    videoProgress,
    videoError,
    handleGenerateImage,
    generatedExtendVideo,
    generatingExtendVideo,
    extendVideoProgress,
    extendVideoError,
    handleSetImage,
    handleGenerateVideo,
    handleDownloadVideo,
    handleDownloadExtendVideo,
    reportVideoError,
    handleGenerateVideoToVideo,
    handleStopImageGeneration,
    imageActionPending,
    handleStopVideoGeneration,
    videoActionPending,
    handleStopExtendVideoGeneration,
    extendActionPending,
  } = useElementSceneMedia({
    scene,
    nextSceneId,
    thumbnailOriginImage,
    selectedProductImages,
    selectedElementImageSlots,
    selectedElementVideoSlots,
    noText: scene.noText,
  });

  const videoPaddingTop = "56.25%";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const openEdit = (field: EditField) => {
    setEditingField(field);
    setEditValue(scene[field] ?? "");
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

  const handleDeleteScene = async () => {
    const confirmed = await Alert.danger(
      t("Xác nhận xoá phân cảnh"),
      t("Nếu xoá sẽ không thể hoàn lại, cân nhắc trước khi xác nhận.")
    );
    if (!confirmed) return;
    onDeleteScene?.(scene.id);
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
          {/* Action icons – always visible on mobile, hover on desktop */}
          <div
            className={`absolute -top-3 -right-1.5 sm:-right-2.5 flex items-center gap-0.5 border border-primary shadow-sm bg-gray-50 rounded-md transition-opacity opacity-100 pointer-events-auto ${
              hoveredField === field
                ? "md:opacity-100 md:pointer-events-auto"
                : "md:opacity-0 md:pointer-events-none"
            }`}
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
      {/* ── Card Header ── */}
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
          <SceneAutoDownloadButton
            disabled={isDisabled}
            noDownload={scene.noDownload}
            autoDownloadImageResolution={scene.autoDownloadImageResolution}
            autoDownloadVideoResolution={scene.autoDownloadVideoResolution}
            onToggle={() => onToggleNoDownload(scene.id)}
            onImageResolutionChange={(resolution) =>
              onSetSceneAutoDownloadImageResolution(scene.id, resolution)
            }
            onVideoResolutionChange={(resolution) =>
              onSetSceneAutoDownloadVideoResolution(scene.id, resolution)
            }
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
                ? t("Đang cho phép hiển thị 'Chữ' trong ảnh")
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
          {onDeleteScene && (
            <Button
              onClick={() => void handleDeleteScene()}
              className="w-6 h-6 px-2 rounded-md shadow-sm text-gray-400 bg-white hover:text-red-600 hover:bg-red-50"
              iconClassName="text-sm"
              icon={<RiDeleteBinLine />}
              tooltip={t("Xoá phân cảnh")}
              placement="bottom"
            />
          )}
        </div>
      </div>

      {/* ── Video tham chiếu (1 ô, match tên video trong prompt) ── */}
      <div className={`px-3 py-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <SceneElementVideosRow
          sceneId={scene.id}
          prompt={scene.visual_prompt || ""}
          elementFormConfig={elementFormConfig}
          savedSlots={scene.elementVideoSlots}
          readOnly={isDisabled}
          onSlotsChange={handleElementVideoSlotsChange}
        />
      </div>

      {/* ── Ảnh tham chiếu (3 ô, match tên trong prompt) ── */}
      <div className={`px-3 py-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <SceneElementImagesRow
          sceneId={scene.id}
          prompt={scene.visual_prompt || ""}
          elementFormConfig={elementFormConfig}
          savedSlots={scene.elementImageSlots}
          readOnly={isDisabled}
          onSlotsChange={handleElementImageSlotsChange}
        />
      </div>
      {/* ── Media tabs ── */}
      <SceneCardTabs
        hideImageTab={true}
        hideExtendTab={true}
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
            originThumbnailUrl={thumbnailOriginImage}
            originThumbnailLoading={thumbnailLoading}
            sceneTimestamp={scene.timestamp}
            errorMessage={imageError}
            onStopGeneration={() => void handleStopImageGeneration()}
            generationActionPending={imageActionPending}
          />
        )}
        renderVideoTab={() => (
          <SceneCardVideoTab
            generatedVideo={generatedVideo}
            generatingVideo={generatingVideo}
            videoProgress={videoProgress}
            isDisabled={isDisabled || true}
            hasImage={!!generatedImage}
            isPromptToVideo
            aspectRatio={aspectRatio}
            errorMessage={videoError}
            onImageRequired={() => reportVideoError(t("Cần tạo ảnh trước khi tạo video"))}
            sceneNumber={scene.sceneNumber}
            onGenerateVideo={() => handleGenerateVideoToVideo()}
            onStopGeneration={() => void handleStopVideoGeneration()}
            generationActionPending={videoActionPending}
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
            onStopGeneration={() => void handleStopExtendVideoGeneration()}
            generationActionPending={extendActionPending}
          />
        )}
        renderImagePrompt={() => (
          <div className={`${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            {renderEditablePrompt(
              "visual_prompt",
              scene.visual_prompt,
              "text-gray-600",
              <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                PROMPT
              </span>
            )}
          </div>
        )}
        renderVideoPrompts={() => (
          <div className={`${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            {renderEditablePrompt(
              "visual_prompt",
              scene.visual_prompt,
              "text-gray-600",
              <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                PROMPT
              </span>
            )}
            {renderEditablePrompt(
              "motion_description",
              scene.motion_description,
              "text-teal-700",
              <span className="mr-1 text-xs font-bold tracking-wide uppercase text-teal">
                [MOTION]:
              </span>
            )}
            {renderEditablePrompt(
              "audio_description",
              scene.audio_description ?? "",
              "text-purple-700",
              <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                [AUDIO]:
              </span>
            )}
            {renderEditablePrompt(
              "original_content",
              scene.original_content ?? "",
              "text-green-700 italic",
              <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                [DIALOGUE]:
              </span>
            )}
          </div>
        )}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            const { imageBytes, mimeType } = await fileToGenerationImageBase64(file);
            handleSetImage({
              imageBytes,
              mimeType,
              fifeUrl: "",
            });
            toast.success(t("Đã upload ảnh thành công"));
          } catch {
            toast.error(t("Lỗi khi xử lý ảnh. Vui lòng thử lại."));
          }
        }}
      />
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
  scene: CopyVideoScene;
  index: number;
  nextSceneId?: string;
  isDisabled: boolean;
  characters: CharacterItem[];
  hideImageColumn?: boolean;
  forcedTab?: SceneTabKey | null;
  onToggleNoText: (sceneId: string) => void;
  onToggleNoDownload: (sceneId: string) => void;
  onSetSceneAutoDownloadImageResolution: (sceneId: string, resolution: "1K" | "2K" | "4K") => void;
  onSetSceneAutoDownloadVideoResolution: (sceneId: string, resolution: "720p" | "1080p") => void;
  onInsert: (
    scene: CopyVideoScene,
    position: InsertPosition,
    data: NewSceneData
  ) => Promise<void> | void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
  onUpdateSelectedProductImages?: (sceneId: string, images: string[]) => void;
  onUpdateElementImageSlots?: (
    sceneId: string,
    slots: (ElementFormImage | undefined)[],
    imageUrls: string[]
  ) => void;
  onUpdateElementVideoSlots?: (sceneId: string, slots: (ElementFormVideo | undefined)[]) => void;
  onDeleteScene?: (sceneId: string) => void;
}

export function SceneRowGroup({
  scene,
  index,
  nextSceneId,
  isDisabled,
  characters,
  forcedTab,
  onInsert,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
  onToggleNoText,
  onToggleNoDownload,
  onSetSceneAutoDownloadImageResolution,
  onSetSceneAutoDownloadVideoResolution,
  onUpdateSelectedProductImages,
  onUpdateElementImageSlots,
  onUpdateElementVideoSlots,
  onDeleteScene,
}: SceneRowGroupProps) {
  const [hovered, setHovered] = useState(false);
  const enter = () => setHovered(true);
  const leave = () => setHovered(false);

  return (
    <div className="flex relative flex-col group" onMouseEnter={enter} onMouseLeave={leave}>
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

      {/* Scene data row – flex-1 so it fills the grid cell height */}
      <div className="flex-1">
        <SceneBatchRow
          scene={scene}
          index={index}
          nextSceneId={nextSceneId}
          isDisabled={isDisabled}
          isGroupHovered={hovered}
          forcedTab={forcedTab}
          onMouseEnter={enter}
          onMouseLeave={leave}
          onUpdateScene={onUpdateScene}
          onToggleDisable={onToggleDisable}
          onToggleVoiceDisable={onToggleVoiceDisable}
          onToggleNoText={onToggleNoText}
          onToggleNoDownload={onToggleNoDownload}
          onSetSceneAutoDownloadImageResolution={onSetSceneAutoDownloadImageResolution}
          onSetSceneAutoDownloadVideoResolution={onSetSceneAutoDownloadVideoResolution}
          onUpdateSelectedProductImages={onUpdateSelectedProductImages}
          onUpdateElementImageSlots={onUpdateElementImageSlots}
          onUpdateElementVideoSlots={onUpdateElementVideoSlots}
          onDeleteScene={onDeleteScene}
        />
      </div>

      {/* Add BELOW button – always at the bottom of the group, only visible on hover
      <div
        className={`flex justify-center py-1.5 transition-all duration-200 ${
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
        .filter((e) => hasGeneratedImageData(e.value))
        .map((e) => ({
          key: String(e.key),
          data: toUiGeneratedImage(e.value),
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
                    src={getGeneratedImagePreviewSrc(item.data)}
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
