/**
 * scene-batch-row.tsx
 * Mỗi hàng scene trong bảng batch + nhóm scene (row group)
 * - Bỏ cột "Cảnh" riêng, thay bằng overlay scene number + toggle trên ảnh
 * - Responsive: trên mobile hiển thị dạng card
 * Extracted from batch-list.tsx – className only, Tailwind CSS
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import {
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiGalleryLine,
  RiImageFill,
  RiLoader4Line,
  RiPencilLine,
  RiSaveLine,
  RiSearchLine,
  RiUploadCloud2Line,
  RiVideoFill,
} from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { GenerateAiIcon } from "../../../../../public/assets/svg/generate-ai";
import { VideoDialog } from "../../../../shared/common/video-dialog";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button, Input } from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { CharacterItem, DB_NAME, SceneScript, StoryModeTypeEnum } from "../../constants";
import { GeneratedImageData } from "../../hook/useAffiliateVideoApi";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { useSceneMedia } from "../../hook/useSceneMedia";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AddSceneButton, InsertPosition, NewSceneData } from "./add-scene-modal";

// ── Types ──────────────────────────────────────────────────────────────────
export type EditField = "imageGenPrompt" | "motionPrompt" | "dialogue" | "audio";

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
  nextSceneId,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
}: {
  scene: SceneScript;
  index: number;
  nextSceneId?: string;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  storyModeType?: StoryModeTypeEnum;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoveredField, setHoveredField] = useState<EditField | null>(null);
  const [copiedField, setCopiedField] = useState<EditField | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showExtendVideoModal, setShowExtendVideoModal] = useState(false);
  const [showGalleryDialog, setShowGalleryDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    handleGenerateImage,
    handleSetImage,
    handleGenerateVideo,
    handleDownloadImage,
    handleDownloadVideo,
    handleDownloadExtendVideo,
  } = useSceneMedia({ scene, nextSceneId });
  const { scriptData } = useAffiliateVideoContext();
  const isPromptToVideo = storyModeType === StoryModeTypeEnum.prompt_to_video;

  const videoPaddingTop = scriptData?.aspectRatio === "16:9" ? "56.25%" : "177.78%";
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 160;

  const truncate = (text: string) =>
    text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "..." : text;

  const needsExpand =
    scene.imageGenPrompt.length > MAX_CHARS ||
    scene.motionPrompt.length > MAX_CHARS ||
    (scene.dialogue?.length || 0) > MAX_CHARS;

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
          {labelEl}
          <span className={`text-xs ${textColor} leading-relaxed pr-14`}>
            {expanded ? text : truncate(text)}
          </span>
          {/* Action icons – visible when hovering this field's area */}
          <div
            className="absolute top-0 -right-6 flex items-center gap-0.5 border border-gray-200 bg-white rounded-md"
            style={{
              opacity: hoveredField === field ? 1 : 0,
              pointerEvents: hoveredField === field ? "auto" : "none",
            }}
          >
            {/* Copy prompt button */}
            <button
              onClick={() => handleCopy(field, text)}
              title="Copy prompt"
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all cursor-pointer border-0 bg-transparent"
            >
              {copiedField === field ? (
                <span className="text-green-500 text-xs font-bold">✓</span>
              ) : (
                <RiFileCopyLine className="text-sm" />
              )}
            </button>
            {/* Edit pencil button */}
            <button
              onClick={() => openEdit(field)}
              title={t("Chỉnh sửa")}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all cursor-pointer border-0 bg-transparent"
            >
              <RiPencilLine className="text-sm" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <tr
      className={`border-t border-gray-200 border-dashed bg-white transition-all duration-200 align-top relative ${
        isDisabled ? "" : "hover:bg-gray-50"
      }`}
      style={
        isGroupHovered && !isDisabled
          ? { outline: "1px dashed #a855f7", outlineOffset: "-1px" }
          : undefined
      }
      onMouseEnter={() => {
        setRowHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setRowHovered(false);
        onMouseLeave?.();
      }}
    >
      {/* Image Prompt */}
      {!isPromptToVideo && (
        <td className={`py-3 px-3 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
          {renderEditablePrompt(
            "imageGenPrompt",
            scene.imageGenPrompt,
            "text-gray-600",
            <span className="text-xs font-bold text-orange mr-1 uppercase tracking-wide">
              IMAGE PROMPT
            </span>
          )}
          {editingField !== "imageGenPrompt" && scene.imageGenPrompt.length > MAX_CHARS && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-xs text-blue-500 hover:text-blue-700 mt-1 cursor-pointer border-0 bg-transparent font-medium"
            >
              {expanded ? "▲ Thu gọn" : "▼ Xem thêm"}
            </button>
          )}
        </td>
      )}

      {/* Motion + Audio */}
      <td className={`py-3 px-3 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        {renderEditablePrompt(
          "motionPrompt",
          scene.motionPrompt,
          "text-teal-700",
          <span className="text-xs font-bold text-teal mr-1 uppercase tracking-wide">
            [MOTION]:
          </span>
        )}
        {renderEditablePrompt(
          "audio",
          scene.audio ?? "",
          "text-purple-700",
          <span className="text-xs font-bold text-green-600 mt-2 mr-1 uppercase tracking-wide inline-block">
            [AUDIO]:
          </span>
        )}
        {renderEditablePrompt(
          "dialogue",
          scene.dialogue ?? "",
          "text-green-700 italic",
          <span className="text-xs font-bold text-green-600 mt-2 mr-1 uppercase tracking-wide inline-block">
            [DIALOGUE]:
          </span>
        )}
        {editingField !== "motionPrompt" && editingField !== "dialogue" && needsExpand && (
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-xs text-blue-500 hover:text-blue-700 mt-1 cursor-pointer border-0 bg-transparent font-medium"
          >
            {expanded ? "▲ Thu gọn" : "▼ Xem thêm"}
          </button>
        )}
      </td>

      {/* Generated Image */}
      {!isPromptToVideo && (
        <td className={`py-3 px-3 w-24 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
          <div className="flex justify-center">
            {generatedImage ? (
              /* ── Show generated image thumbnail ── */
              <div className="relative w-32 h-full group">
                <Img
                  showImageOnClick
                  lazyload={false}
                  src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBytes}`}
                  alt={`Scene ${scene.sceneNumber}`}
                  className="  rounded-md object-cover border    border-dashed border-green-300 shadow-sm"
                  ratio916
                />

                {/* Re-generate overlay on hover */}
                <div className="flex gap-2 mt-2 w-full items-center justify-center flex-wrap">
                  <Button
                    onClick={handleDownloadImage}
                    className="w-8 rounded-lg h-8 bg-success-light text-success"
                    iconClassName="text-xl font-bold"
                    tooltip={t("Tải")}
                    icon={<HiOutlineArrowDownTray />}
                    placement="bottom"
                  />
                  {generatingImage ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 border border-pink-200">
                      <RiLoader4Line className="text-pink-500 text-sm animate-spin" />
                      <span className="text-pink-600 text-[10px] font-bold">{imageProgress}%</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleGenerateImage}
                      icon={<GenerateAiIcon />}
                      placement="bottom"
                      className="w-8 rounded-lg h-8 bg-orange-light  text-orange"
                      iconClassName="text-xl font-bold"
                      tooltip={t("Tạo lại")}
                    />
                  )}
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    icon={<RiUploadCloud2Line />}
                    placement="bottom"
                    className="w-8 rounded-lg h-8 bg-blue-50 text-blue-500"
                    iconClassName="text-xl font-bold"
                    tooltip={t("Upload ảnh")}
                  />
                  <Button
                    onClick={() => setShowGalleryDialog(true)}
                    icon={<RiGalleryLine />}
                    placement="bottom"
                    className="w-8 rounded-lg h-8 bg-purple-50 text-purple-500"
                    iconClassName="text-xl font-bold"
                    tooltip={t("Chọn từ Gallery")}
                  />
                </div>
              </div>
            ) : generatingImage ? (
              /* ── Spinner + progress ── */
              <div className="w-16 h-16 rounded-xl border-2 border-pink-300 bg-pink-50 flex flex-col items-center justify-center">
                <RiLoader4Line className="text-pink-500 text-xl animate-spin" />
                <span className="text-pink-600 text-[10px] font-bold mt-0.5">{imageProgress}%</span>
              </div>
            ) : (
              /* ── Default create button ── */
              <button
                onClick={handleGenerateImage}
                className="w-32 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 bg-gray-50 hover:bg-pink-50 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-xl mb-0.5" />
                <span className="text-gray-400 group-hover:text-pink-500 text-xs font-medium">
                  {t("Tạo ảnh")}
                </span>
              </button>
            )}
          </div>
        </td>
      )}

      {/* Generated Video đơn */}
      <td className={`py-3 px-3 w-24 ${isDisabled ? "opacity-40 pointer-events-none" : ""}`}>
        <div className="flex flex-row items-center gap-2">
          {/* ── Video đơn ── */}
          <div className="flex justify-start w-full">
            {generatedVideo ? (
              <div className="relative w-32 group">
                {(() => {
                  const videoSrc =
                    generatedVideo.videoUri ||
                    (generatedVideo.videoBytes
                      ? `data:${generatedVideo.mimeType};base64,${generatedVideo.videoBytes}`
                      : null);
                  return videoSrc ? (
                    <>
                      <div
                        className="relative w-full rounded-xl overflow-hidden border-2 border-purple-300 shadow-sm"
                        style={{ paddingTop: videoPaddingTop }}
                      >
                        <video
                          src={videoSrc}
                          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                          onMouseLeave={(e) => {
                            const v = e.target as HTMLVideoElement;
                            v.pause();
                            v.currentTime = 0;
                          }}
                          onClick={() => setShowVideoModal(true)}
                          onError={(e) => {
                            console.error("[SceneBatchRow] Video load error:", videoSrc, e);
                          }}
                        />
                        {/* Play icon overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                            <BiPlayCircle className="text-white w-12 h-12" />
                          </div>
                        </div>
                      </div>
                      {/* Fullscreen video modal */}
                      <VideoDialog
                        videoUrl={videoSrc}
                        isOpen={showVideoModal}
                        onClose={() => setShowVideoModal(false)}
                        aspectRatio={scriptData?.aspectRatio}
                      />
                    </>
                  ) : (
                    <div
                      className="relative w-full rounded-xl border-2 border-purple-300 bg-purple-50"
                      style={{ paddingTop: videoPaddingTop }}
                    >
                      <RiVideoFill className="absolute inset-0 m-auto text-purple-400 text-xl" />
                    </div>
                  );
                })()}
                {/* Download & Re-generate buttons */}
                <div className="flex gap-2 mt-2 w-full items-center justify-center">
                  <Button
                    onClick={handleDownloadVideo}
                    className="w-8 rounded-lg h-8 bg-success-light text-success"
                    iconClassName="text-xl font-bold"
                    tooltip={t("Tải")}
                    icon={<HiOutlineArrowDownTray />}
                    placement="bottom"
                  />
                  {generatingVideo ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-50 border border-purple-200">
                      <RiLoader4Line className="text-purple-500 text-sm animate-spin" />
                      <span className="text-purple-600 text-[10px] font-bold">
                        {videoProgress}%
                      </span>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        if (!isPromptToVideo && !generatedImage) {
                          toast.error(t("Cần tạo ảnh trước khi tạo video"));
                          return;
                        }
                        handleGenerateVideo();
                      }}
                      icon={<GenerateAiIcon />}
                      placement="bottom"
                      className="w-8 rounded-lg h-8 bg-orange-light  text-orange"
                      iconClassName="text-xl font-bold"
                      tooltip={t("Tạo lại")}
                    />
                  )}
                </div>
              </div>
            ) : generatingVideo ? (
              <div className="w-16 h-16 rounded-xl border-2 border-purple-300 bg-purple-50 flex flex-col items-center justify-center">
                <RiLoader4Line className="text-purple-500 text-xl animate-spin" />
                <span className="text-purple-600 text-[10px] font-bold mt-0.5">
                  {videoProgress}%
                </span>
              </div>
            ) : (
              <button
                onClick={() => {
                  if (!isPromptToVideo && !generatedImage) {
                    toast.error(t("Cần tạo ảnh trước khi tạo video"));
                    return;
                  }
                  handleGenerateVideo();
                }}
                className="relative w-32 h-16 rounded-xl border-2 border-dashed transition-all group border-gray-200 hover:bg-purple-50 bg-gray-50 hover:border-purple-200 cursor-pointer text-purple-500"
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <AiOutlineVideoCamera className="text-xl mb-0.5 text-gray-300 group-hover:text-purple-400" />
                  <span className="text-xs font-medium text-gray-400 group-hover:text-purple-500">
                    {t("Tạo video đơn")}
                  </span>
                </div>
              </button>
            )}
          </div>

          {/* ── Video nối (extend) – hoàn toàn độc lập ── */}
          {!isPromptToVideo && nextSceneId && (
            <div className="flex justify-center w-full">
              {generatedExtendVideo ? (
                <div className="relative w-32 group">
                  {(() => {
                    const extVideoSrc =
                      generatedExtendVideo.videoUri ||
                      (generatedExtendVideo.videoBytes
                        ? `data:${generatedExtendVideo.mimeType};base64,${generatedExtendVideo.videoBytes}`
                        : null);
                    return extVideoSrc ? (
                      <>
                        <div
                          className="relative w-full rounded-xl overflow-hidden border-2 border-teal-300 shadow-sm"
                          style={{ paddingTop: videoPaddingTop }}
                        >
                          <video
                            src={extVideoSrc}
                            className="absolute inset-0 w-full h-full object-cover cursor-pointer"
                            muted
                            loop
                            playsInline
                            preload="metadata"
                            onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                            onMouseLeave={(e) => {
                              const v = e.target as HTMLVideoElement;
                              v.pause();
                              v.currentTime = 0;
                            }}
                            onClick={() => setShowExtendVideoModal(true)}
                            onError={(e) => {
                              console.error(
                                "[SceneBatchRow] Extend video load error:",
                                extVideoSrc,
                                e
                              );
                            }}
                          />
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                              <BiPlayCircle className="text-white w-12 h-12" />
                            </div>
                          </div>
                        </div>
                        {/* Fullscreen extend video modal */}
                        <VideoDialog
                          videoUrl={extVideoSrc}
                          isOpen={showExtendVideoModal}
                          onClose={() => setShowExtendVideoModal(false)}
                          aspectRatio={scriptData?.aspectRatio}
                        />
                      </>
                    ) : (
                      <div
                        className="relative w-full rounded-xl border-2 border-teal-300 bg-teal-50"
                        style={{ paddingTop: videoPaddingTop }}
                      >
                        <RiVideoFill className="absolute inset-0 m-auto text-teal-400 text-xl" />
                      </div>
                    );
                  })()}
                  {/* Download & Re-generate extend video */}
                  <div className="flex gap-2 mt-2 w-full items-center justify-center">
                    <Button
                      onClick={handleDownloadExtendVideo}
                      className="w-8 rounded-lg h-8 bg-success-light text-success"
                      iconClassName="text-xl font-bold"
                      tooltip={t("Tải")}
                      icon={<HiOutlineArrowDownTray />}
                      placement="bottom"
                    />
                    {generatingExtendVideo ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50 border border-teal-200">
                        <RiLoader4Line className="text-teal-500 text-sm animate-spin" />
                        <span className="text-teal-600 text-[10px] font-bold">
                          {extendVideoProgress}%
                        </span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGenerateVideo(true)}
                        icon={<GenerateAiIcon />}
                        placement="bottom"
                        tooltip={t("Tạo lại video nối")}
                        className="w-8 rounded-lg h-8 bg-orange-light  text-orange"
                        iconClassName="text-xl font-bold"
                      />
                    )}
                  </div>
                </div>
              ) : generatingExtendVideo ? (
                <div className="w-16 h-16 rounded-xl border-2 border-teal-300 bg-teal-50 flex flex-col items-center justify-center">
                  <RiLoader4Line className="text-teal-500 text-xl animate-spin" />
                  <span className="text-teal-600 text-[10px] font-bold mt-0.5">
                    {extendVideoProgress}%
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => handleGenerateVideo(true)}
                  className="relative w-32 h-16 shrink-0 rounded-xl border-2 border-dashed transition-all group border-gray-200 hover:border-primary-dark bg-gray-50 hover:bg-primary-light cursor-pointer"
                >
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <AiOutlineVideoCameraAdd className="text-xl mb-0.5 text-primary group-hover:text-teal-400" />
                    <span className="text-xs font-medium text-primary group-hover:text-teal-500">
                      {t("Tạo video nối")}
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </td>

      {/* Right-side overlay: eye + voice + scene number */}
      <td className="p-0 w-0" style={{ position: "relative" }}>
        <div className="absolute right-2 top-2 bottom-2 flex flex-col items-center justify-between z-10">
          {/* Top group: eye + voice buttons */}
          <div className="flex flex-col items-center gap-1">
            {/* Eye toggle – visible on hover or when disabled */}
            <div
              className={`transition-opacity duration-200 ${
                rowHovered || isDisabled ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <Button
                onClick={() => onToggleDisable(scene.id)}
                className={`w-6 h-6 rounded-md shadow-sm  ${
                  isDisabled
                    ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                    : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
                }`}
                iconClassName="text-sm "
                icon={isDisabled ? <RiEyeLine /> : <RiEyeOffLine />}
                tooltip={isDisabled ? t("Hiện Cảnh") : t("Ẩn Cảnh")}
                placement="bottom"
              />
            </div>
            {/* Voice toggle – visible on hover OR when voiceDisable is true */}
            <div
              className={`transition-opacity duration-200 font-semibold ${
                rowHovered || scene.voiceDisable ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <Button
                disabled={isDisabled}
                onClick={() => onToggleVoiceDisable(scene.id)}
                className={`w-6 h-6 rounded-md shadow-sm ${
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
          {/* Scene number badge – bottom, visible on hover */}
          <span
            className={`text-lg font-extrabold text-gray-300 transition-opacity duration-200 ${
              rowHovered || isDisabled ? "opacity-100" : "opacity-0"
            }`}
          >
            #{scene.sceneNumber}
          </span>
        </div>
      </td>
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
          // Reset input so same file can be re-selected
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
    </tr>
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
  onInsert: (
    scene: SceneScript,
    position: InsertPosition,
    data: NewSceneData
  ) => Promise<void> | void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
}

export function SceneRowGroup({
  scene,
  index,
  nextSceneId,
  isDisabled,
  characters,
  storyModeType,
  onInsert,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
}: SceneRowGroupProps) {
  const [hovered, setHovered] = useState(false);
  const enter = () => setHovered(true);
  const leave = () => setHovered(false);

  const addBtnAbsClass = `absolute left-0 right-0 flex justify-center z-20 transition-all duration-200 ${
    hovered ? "opacity-100" : "opacity-0 pointer-events-none"
  }`;

  return (
    <React.Fragment>
      {/* Add ABOVE button – chỉ hiện trước scene đầu tiên, absolute positioned */}
      {index === 0 && (
        <tr onMouseEnter={enter} onMouseLeave={leave}>
          <td
            colSpan={5}
            className="p-0 relative overflow-visible"
            style={{ height: 0, lineHeight: 0, border: "none" }}
          >
            <div className={addBtnAbsClass} style={{ top: "50%", transform: "translateY(-50%)" }}>
              <AddSceneButton
                scene={scene}
                position="above"
                characters={characters}
                onInsert={onInsert}
              />
            </div>
          </td>
        </tr>
      )}

      {/* Scene data row – highlighted w0ith colored border on hover */}
      <SceneBatchRow
        scene={scene}
        index={index}
        nextSceneId={nextSceneId}
        isDisabled={isDisabled}
        isGroupHovered={hovered}
        storyModeType={storyModeType}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onUpdateScene={onUpdateScene}
        onToggleDisable={onToggleDisable}
        onToggleVoiceDisable={onToggleVoiceDisable}
      />

      {/* Add BELOW button – absolute positioned, floats between rows */}
      <tr onMouseEnter={enter} onMouseLeave={leave}>
        <td
          colSpan={5}
          className="p-0 relative overflow-visible"
          style={{ height: 0, lineHeight: 0, border: "none" }}
        >
          <div className={addBtnAbsClass} style={{ top: "50%", transform: "translateY(-50%)" }}>
            <AddSceneButton
              scene={scene}
              position="below"
              characters={characters}
              onInsert={onInsert}
            />
          </div>
        </td>
      </tr>
    </React.Fragment>
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
            className="w-full py-2 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <RiLoader4Line className="text-3xl animate-spin text-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredImages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
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
                className="relative overflow-hidden transition-all border-2 border-transparent rounded-xl cursor-pointer group hover:border-primary hover:shadow-lg"
                onClick={() => onSelect(item.data)}
              >
                <div className="relative aspect-[9/16] bg-gray-50">
                  <Img
                    showImageOnClick
                    lazyload={false}
                    src={`data:${item.data.mimeType};base64,${item.data.imageBytes}`}
                    alt={item.key}
                    className="  rounded-md object-cover border    border-dashed border-green-300 shadow-sm"
                    ratio916
                  />

                  {/* Hover overlay */}
                  <div className="absolute inset-0 flex items-center justify-center transition-opacity opacity-0 bg-black/30 group-hover:opacity-100 rounded-xl">
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
