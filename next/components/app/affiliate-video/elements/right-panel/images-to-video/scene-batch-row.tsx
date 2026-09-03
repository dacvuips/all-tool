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
  RiDeleteBinLine,
  RiEyeLine,
  RiEyeOffLine,
  RiImageFill,
  RiLoader4Line,
  RiSearchLine,
  RiText,
} from "react-icons/ri";
import { useAlert } from "../../../../../../lib/providers/alert-provider";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { NoTextIcon } from "../../../../../../public/assets/svg/no-text-icon";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { Button, Input } from "../../../../../shared/utilities/form";
import { Img } from "../../../../../shared/utilities/misc";
import { CharacterItem, CopyVideoScene, DB_NAME, ElementFormImage } from "../../../constants";
import { AutoPostSocialSceneTableRow, type SceneBatchLayout } from "../../../shared/auto-post-social/grouped-list";
import { getAutoDownloadDefault } from "../../../shared/autoDownloadUtils";
import { fileToGenerationImageBase64 } from "../../../shared/compressGenerationImage";
import {
  generatedImageToApiBase64Input,
  getGeneratedImagePreviewSrc,
  hasGeneratedImageData,
  toUiGeneratedImage,
} from "../../../shared/generatedMediaUtils";
import { SceneAutoDownloadButton } from "../../../shared/scene-auto-download-button";
import { SceneCardExtendVideoTab } from "../../../shared/scene-card-extend-video-tab";
import { SceneCardImageTab } from "../../../shared/scene-card-image-tab";
import { SceneCardTabs, SceneTabKey } from "../../../shared/scene-card-tabs";
import { SceneCardVideoTab } from "../../../shared/scene-card-video-tab";
import { SceneComponentVideoVoiceSelect } from "../../../shared/scene-component-video-voice-select";
import { SceneEditablePrompt } from "../../../shared/scene-editable-prompt";
import { GeneratedImageData } from "../../hook/useElementApi";

import { useIndexedDB } from "../../../hook/useIndexedDB";
import { useSceneThumbnail } from "../../../hook/useVideoThumbnail";
import { ActionImageEnum, ServiceImageEnum } from "../../constants";
import { useElementSceneMedia } from "../../hook/useElementSceneMedia";
import { useElementContext } from "../../providers/element-provider";
import { createElementImageSlotsChangeHandler } from "../../utils/createElementImageSlotsChangeHandler";
import {
  pickSceneSavedImageSlots,
  resolveActionImageType,
} from "../../utils/elementActionImageUtils";
import { getSceneImageSlotCount } from "../../utils/elementFormImageUtils";
import { mergeElementImageSlotsFromScene, slotHasDisplayMedia } from "../../utils/elementImageSlotPersist";
import { resolveElementAspectRatio } from "../../utils/elementSceneGenerationParams";
import { InsertPosition, NewSceneData } from "../add-scene-modal";
import { SceneElementImagesRow } from "./scene-element-images-row";

// ── Types ──────────────────────────────────────────────────────────────────
export type EditField =
  | "visual_prompt"
  | "motion_description"
  | "original_content"
  | "audio_description"
  | "product_image_prompt"
  | "videoVoice";

function getGeneratedImageAssignStamp(generated: GeneratedImageData): string {
  const remote = (generated.fifeUrl || generated.imageUrl || "").trim();
  if (remote && !remote.startsWith("blob:") && !remote.startsWith("data:")) return remote;
  if (generated.mediaBlob) return `blob:${generated.mediaBlob.size}:${generated.mimeType || ""}`;
  if ((generated.previewUrl || "").trim()) return generated.previewUrl!.trim();
  return `scene-image`;
}

function buildGeneratedAssignSlotName(
  sceneNumber: number | undefined,
  slotIndex: number,
  stamp: string
): string {
  return `gen-assign|${sceneNumber ?? 0}|${slotIndex}|${stamp.slice(0, 120)}`;
}

function isSlotMatchingGeneratedImage(
  slot: ElementFormImage | undefined,
  generated: GeneratedImageData,
  slotIndex: number,
  sceneNumber?: number
): boolean {
  if (!slot) return false;
  if (!slotHasDisplayMedia(slot)) return false;
  const assignPrefix = `gen-assign|${sceneNumber ?? 0}|${slotIndex}|`;
  if ((slot.name || "").startsWith(assignPrefix)) return true;
  const stamp = getGeneratedImageAssignStamp(generated);
  if (slot.name === buildGeneratedAssignSlotName(sceneNumber, slotIndex, stamp)) {
    return true;
  }
  const genRemote = (generated.fifeUrl || generated.imageUrl || "").trim();
  const slotUrl = (slot.fifeUrl || "").trim();
  if (
    genRemote &&
    !genRemote.startsWith("blob:") &&
    !genRemote.startsWith("data:") &&
    slotUrl &&
    slotUrl === genRemote
  ) {
    return true;
  }
  if (generated.imageBytes && slot.imageBytes) {
    return slot.imageBytes === generated.imageBytes;
  }
  return false;
}

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
  layout = "card",
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
  layout?: SceneBatchLayout;
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
    imageUrls: string[],
    actionMode?: ActionImageEnum
  ) => void;
  onDeleteScene?: (sceneId: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const Alert = useAlert();

  const [rowHovered, setRowHovered] = useState(false);

  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<SceneTabKey>("image");
  const fileInputRef = useRef<HTMLInputElement>(null);
  // ── Thumbnail from IndexedDB (saved during video analysis) ──
  const { thumbnailUrl: thumbnailOriginImage, loading: thumbnailLoading } = useSceneThumbnail(
    scene.id
  );
  const { scriptData, elementFormConfig } = useElementContext();
  const actionImageType = resolveActionImageType(elementFormConfig);
  /** Auto: dùng elementImageSlots trực tiếp (luồng gốc). Sequential: lọc theo action mode. */
  const sceneSavedImageSlots = useMemo(() => {
    if (actionImageType === ActionImageEnum.sequential) {
      return pickSceneSavedImageSlots(scene, actionImageType) ?? [];
    }
    return scene.elementImageSlots ?? [];
  }, [
    scene.id,
    scene.elementImageSlots,
    scene.elementImageSlotsActionMode,
    actionImageType,
  ]);
  const aspectRatio = resolveElementAspectRatio(scriptData, elementFormConfig?.aspectRatio);
  const imageSlotCount = getSceneImageSlotCount(elementFormConfig?.serviceImageType);

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
  >(sceneSavedImageSlots || []);

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
    if (actionImageType === ActionImageEnum.sequential) {
      setSelectedElementImageSlots(sceneSavedImageSlots ?? []);
      return;
    }
    if (!scene.elementImageSlots) return;
    setSelectedElementImageSlots((prev) =>
      mergeElementImageSlotsFromScene(prev, scene.elementImageSlots ?? [], imageSlotCount)
    );
  }, [scene.id, scene.elementImageSlots, sceneSavedImageSlots, actionImageType, imageSlotCount]);

  const handleElementImageSlotsChange = useCallback(
    createElementImageSlotsChangeHandler({
      sceneId: scene.id,
      elementFormConfig,
      actionImageType,
      setSelectedElementImageSlots,
      setSelectedProductImages,
      selectedProductImagesDB,
      onUpdateSelectedProductImages,
      onUpdateElementImageSlots,
      resolvePersistActionMode: (type) =>
        type === ActionImageEnum.sequential ? type : undefined,
    }),
    [
      scene.id,
      elementFormConfig,
      actionImageType,
      selectedProductImagesDB,
      onUpdateSelectedProductImages,
      onUpdateElementImageSlots,
    ]
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
    noText: scene.noText,
  });

  const handleDeleteScene = async () => {
    const confirmed = await Alert.danger(
      t("Xác nhận xoá phân cảnh"),
      t("Nếu xoá sẽ không thể hoàn lại, cân nhắc trước khi xác nhận.")
    );
    if (!confirmed) return;
    onDeleteScene?.(scene.id);
  };

  const isImageOnly = elementFormConfig?.serviceImageType === ServiceImageEnum.imageOnly;
  const showComponentVoice =
    elementFormConfig?.serviceImageType === ServiceImageEnum.startAddEnd;

  const assignedSlotIndices = useMemo(() => {
    if (!generatedImage) return [];
    return selectedElementImageSlots.reduce<number[]>((acc, slot, i) => {
      if (isSlotMatchingGeneratedImage(slot, generatedImage, i, scene.sceneNumber)) {
        acc.push(i);
      }
      return acc;
    }, []);
  }, [generatedImage, selectedElementImageSlots, scene.sceneNumber]);

  const handleAssignGeneratedImageToSlot = useCallback(
    async (slotIndex: number) => {
      if (!generatedImage || isDisabled) return;
      try {
        // Không dùng blob:/previewUrl của ảnh chính — tránh revoke làm mất ảnh cột Ảnh.
        const remoteUrl = (
          generatedImage.fifeUrl ||
          generatedImage.imageUrl ||
          ""
        ).trim();
        const safeRemoteUrl =
          remoteUrl &&
          !remoteUrl.startsWith("blob:") &&
          !remoteUrl.startsWith("data:")
            ? remoteUrl
            : "";

        // Copy binary riêng (base64 trong slot) — preview qua blob URL, không dùng chung blob ảnh generate.
        const converted = await generatedImageToApiBase64Input(generatedImage);
        const stamp = getGeneratedImageAssignStamp(generatedImage);
        const elementImage: ElementFormImage = {
          fifeUrl: safeRemoteUrl,
          imageBytes: converted.imageBytes,
          mimeType: converted.mimeType || generatedImage.mimeType || "image/png",
          name: buildGeneratedAssignSlotName(scene.sceneNumber, slotIndex, stamp),
        };
        const nextSlots = [...selectedElementImageSlots];
        while (nextSlots.length < imageSlotCount) nextSlots.push(undefined);
        nextSlots[slotIndex] = elementImage;
        handleElementImageSlotsChange(nextSlots.slice(0, imageSlotCount));
        toast.success(t("Đã gắn ảnh vào ô {{n}}", { n: slotIndex + 1 }));
      } catch (err) {
        console.error("[handleAssignGeneratedImageToSlot]", err);
        toast.error(t("Không thể gắn ảnh vào ô"));
      }
    },
    [
      generatedImage,
      isDisabled,
      selectedElementImageSlots,
      imageSlotCount,
      scene.sceneNumber,
      handleElementImageSlotsChange,
      toast,
      t,
    ]
  );

  const isRowLayout = layout === "row";
  const utilBtnIdle = isRowLayout
    ? "text-gray-500 bg-transparent shadow-none hover:bg-gray-200 hover:text-gray-700"
    : "text-gray-400 bg-white shadow-sm hover:text-red-500 hover:bg-red-50";
  const utilBtnActive = isRowLayout
    ? "text-gray-700 bg-gray-200 shadow-none hover:bg-gray-300"
    : "text-blue-500 bg-blue-50 shadow-sm hover:bg-blue-100";
  const utilBtnVoiceOff = isRowLayout
    ? "text-gray-700 bg-gray-200 shadow-none hover:bg-gray-300"
    : "text-red-500 bg-red-50 shadow-sm hover:bg-red-100";

  const utilityButtons = (
    <div
      className={`flex flex-row flex-wrap gap-0.5 items-center ${
        isRowLayout ? "p-1 rounded-lg bg-gray-50 border border-gray-100" : ""
      }`}
    >
      <Button
        onClick={() => onToggleDisable(scene.id)}
        className={`w-6 h-6 px-2 rounded-md ${isDisabled ? utilBtnActive : utilBtnIdle}`}
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
        buttonClassName={`w-6 h-6 px-2 rounded-md ${
          (scene.noDownload ?? getAutoDownloadDefault()) ? utilBtnActive : utilBtnIdle
        }`}
      />
      <Button
        disabled={isDisabled}
        onClick={() => onToggleNoText(scene.id)}
        className={`w-6 h-6 px-2 rounded-md ${scene.noText ? utilBtnActive : utilBtnIdle}`}
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
        className={`w-6 h-6 px-2 rounded-md ${
          scene.voiceDisable ? utilBtnVoiceOff : utilBtnIdle
        }`}
        iconClassName="text-sm"
        icon={scene.voiceDisable ? <MdVoiceOverOff /> : <MdRecordVoiceOver />}
        tooltip={scene.voiceDisable ? t("Bật thoại") : t("Tắt thoại")}
        placement="bottom"
      />
      {onDeleteScene && (
        <Button
          onClick={() => void handleDeleteScene()}
          className={`px-2 w-6 h-6 rounded-md ${utilBtnIdle}`}
          iconClassName="text-sm"
          icon={<RiDeleteBinLine />}
          tooltip={t("Xoá phân cảnh")}
          placement="bottom"
        />
      )}
    </div>
  );

  const galleryAndUpload = (
    <>
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
    </>
  );

  const imageTab = (
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
      slotAssignCount={imageSlotCount}
      assignedSlotIndices={assignedSlotIndices}
      onAssignToSlot={handleAssignGeneratedImageToSlot}
      onStopGeneration={() => void handleStopImageGeneration()}
      generationActionPending={imageActionPending}
      inline={layout === "row"}
    />
  );

  const videoTab = (
    <SceneCardVideoTab
      generatedVideo={generatedVideo}
      generatingVideo={generatingVideo}
      videoProgress={videoProgress}
      isDisabled={isDisabled}
      hasImage={!!generatedImage}
      isPromptToVideo
      aspectRatio={aspectRatio}
      errorMessage={videoError}
      onImageRequired={() => reportVideoError(t("Cần tạo ảnh trước khi tạo video"))}
      sceneNumber={scene.sceneNumber}
      onGenerateVideo={() => handleGenerateVideo()}
      onStopGeneration={() => void handleStopVideoGeneration()}
      generationActionPending={videoActionPending}
      inline={layout === "row"}
      inlineFooter={
        layout === "row" && showComponentVoice ? (
          <SceneComponentVideoVoiceSelect
            compact
            value={scene.videoVoice}
            disabled={isDisabled}
            onChange={(voiceId) => onUpdateScene(scene.id, "videoVoice", voiceId)}
          />
        ) : undefined
      }
    />
  );

  if (layout === "row") {
    return (
      <>
        <AutoPostSocialSceneTableRow
          isDisabled={isDisabled}
          isHovered={!!isGroupHovered}
          onMouseEnter={() => {
            setRowHovered(true);
            onMouseEnter?.();
          }}
          onMouseLeave={() => {
            setRowHovered(false);
            onMouseLeave?.();
          }}
          reference={
            <div className="flex flex-row flex-nowrap gap-2 items-center shrink-0">
              <span className="inline-flex shrink-0 items-center justify-center min-w-6 h-6 px-1.5 rounded-md text-16  font-bold text-gray-400 ">
                {`#${scene.sceneNumber}`}
              </span>
              <SceneElementImagesRow
                sceneId={scene.id}
                sceneNumber={scene.sceneNumber}
                prompt={scene.visual_prompt || ""}
                elementFormConfig={elementFormConfig}
                slotSource="artStyleImg"
                savedSlots={selectedElementImageSlots}
                readOnly={isDisabled}
                hideLabel
                onSlotsChange={handleElementImageSlotsChange}
              />
            </div>
          }
          prompt={
            <SceneEditablePrompt
              text={scene.visual_prompt}
              textColor="text-gray-600"
              title="PROMPT"
              compact
              labelEl={
                <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                  PROMPT
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "visual_prompt", value)}
            />
          }
          image={imageTab}
          video={videoTab}
          actions={utilityButtons}
        />
        {galleryAndUpload}
      </>
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
      {/* ── Card Header ── */}
      <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-800 text-white whitespace-nowrap mr-1">
          {`${t("Cảnh")} #${scene.sceneNumber}`}
        </span>
        {utilityButtons}
      </div>
      {/* ── Ảnh tham chiếu (3 ô, match tên trong prompt) ── */}
      <div className={`px-3 py-2 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <SceneElementImagesRow
          sceneId={scene.id}
          sceneNumber={scene.sceneNumber}
          prompt={scene.visual_prompt || ""}
          elementFormConfig={elementFormConfig}
          slotSource="artStyleImg"
          savedSlots={selectedElementImageSlots}
          readOnly={isDisabled}
          onSlotsChange={handleElementImageSlotsChange}
        />
        {showComponentVoice && activeMediaTab === "video" ? (
          <SceneComponentVideoVoiceSelect
            value={scene.videoVoice}
            disabled={isDisabled}
            onChange={(voiceId) => onUpdateScene(scene.id, "videoVoice", voiceId)}
          />
        ) : null}
      </div>
      {/* ── Media tabs ── */}
      <SceneCardTabs
        hideExtendTab={true}
        forcedTab={forcedTab}
        onActiveTabChange={setActiveMediaTab}
        tabStatus={{
          image: { loading: generatingImage, progress: imageProgress, done: !!generatedImage },
          video: { loading: generatingVideo, progress: videoProgress, done: !!generatedVideo },
          extend: {
            loading: generatingExtendVideo,
            progress: extendVideoProgress,
            done: !!generatedExtendVideo,
          },
        }}
        renderImageTab={() => imageTab}
        renderVideoTab={() => videoTab}
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
            <SceneEditablePrompt
              text={scene.visual_prompt}
              textColor="text-gray-600"
              title="PROMPT"
              compact={layout === "row"}
              labelEl={
                <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                  PROMPT
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "visual_prompt", value)}
            />
          </div>
        )}
        renderVideoPrompts={() => (
          <div className={`${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
            <SceneEditablePrompt
              text={scene.visual_prompt}
              textColor="text-gray-600"
              title="PROMPT"
              compact={layout === "row"}
              labelEl={
                <span className="mr-1 text-xs font-bold tracking-wide uppercase text-orange">
                  PROMPT
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "visual_prompt", value)}
            />
            <SceneEditablePrompt
              text={scene.motion_description}
              textColor="text-teal-700"
              title="[MOTION]"
              compact={layout === "row"}
              labelEl={
                <span className="mr-1 text-xs font-bold tracking-wide uppercase text-teal">
                  [MOTION]:
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "motion_description", value)}
            />
            <SceneEditablePrompt
              text={scene.audio_description ?? ""}
              textColor="text-purple-700"
              title="[AUDIO]"
              compact={layout === "row"}
              labelEl={
                <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                  [AUDIO]:
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "audio_description", value)}
            />
            <SceneEditablePrompt
              text={scene.original_content ?? ""}
              textColor="text-green-700 italic"
              title="[DIALOGUE]"
              compact={layout === "row"}
              labelEl={
                <span className="inline-block mt-2 mr-1 text-xs font-bold tracking-wide text-green-600 uppercase">
                  [DIALOGUE]:
                </span>
              }
              onSave={(value) => onUpdateScene(scene.id, "original_content", value)}
            />
          </div>
        )}
      />
      {galleryAndUpload}
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
  layout?: SceneBatchLayout;
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
    imageUrls: string[],
    actionMode?: ActionImageEnum
  ) => void;
  onDeleteScene?: (sceneId: string) => void;
}

export function SceneRowGroup({
  scene,
  index,
  nextSceneId,
  isDisabled,
  characters,
  forcedTab,
  layout = "card",
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
  onDeleteScene,
}: SceneRowGroupProps) {
  const [hovered, setHovered] = useState(false);
  const enter = () => setHovered(true);
  const leave = () => setHovered(false);

  return (
    <div
      className={layout === "row" ? "w-full" : "flex relative flex-col group"}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
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
          layout={layout}
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
