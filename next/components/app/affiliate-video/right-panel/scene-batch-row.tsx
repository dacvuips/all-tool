/**
 * scene-batch-row.tsx
 * Mỗi hàng scene trong bảng batch + nhóm scene (row group)
 * - Bỏ cột "Cảnh" riêng, thay bằng overlay scene number + toggle trên ảnh
 * - Responsive: trên mobile hiển thị dạng card
 * Extracted from batch-list.tsx – className only, Tailwind CSS
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
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
  RiVideoFill,
} from "react-icons/ri";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { CharacterItem, SceneScript } from "../constants";
import { useSceneMedia } from "../hook/useSceneMedia";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AddSceneButton, InsertPosition, NewSceneData } from "./add-scene-modal";

// ── Types ──────────────────────────────────────────────────────────────────
export type EditField = "imageGenPrompt" | "motionPrompt" | "dialogue" | "audio";

/** Số ký tự tối đa trước khi cắt */
const PROMPT_MAX_CHARS = 160;

// ─────────────────────────────────────────────────────────────────────────────
// SceneBatchRow – mỗi hàng scene trong bảng
// ─────────────────────────────────────────────────────────────────────────────

interface SceneBatchRowProps {
  scene: SceneScript;
  index: number;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
}

export function SceneBatchRow({
  scene,
  isDisabled,
  isGroupHovered,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
  onToggleVoiceDisable,
}: {
  scene: SceneScript;
  index: number;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
  onToggleVoiceDisable: (sceneId: string) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [rowHovered, setRowHovered] = useState(false);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [hoveredField, setHoveredField] = useState<EditField | null>(null);
  const [copiedField, setCopiedField] = useState<EditField | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const {
    generatedImage,
    generatingImage,
    imageProgress,
    generatedVideo,
    generatingVideo,
    videoProgress,
    videoStatusMessage,
    handleGenerateImage,
    handleGenerateVideo,
    handleDownloadImage,
    handleDownloadVideo,
  } = useSceneMedia({ scene });
  const { videoConfig } = useAffiliateVideoContext();
  const videoPaddingTop = videoConfig?.aspectRatio === "16:9" ? "56.25%" : "177.78%";
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
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors disabled:opacity-50"
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
        isDisabled ? "opacity-40" : "hover:bg-gray-50"
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
      <td className="py-3 px-3">
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

      {/* Motion + Audio */}
      <td className="py-3 px-3">
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
      <td className="py-3 px-3 w-24">
        <div className="flex justify-center">
          {generatedImage ? (
            /* ── Show generated image thumbnail ── */
            <div className="relative w-32 h-full group">
              <Img
                showImageOnClick
                src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBytes}`}
                alt={`Scene ${scene.sceneNumber}`}
                className="  rounded-md object-cover border    border-dashed border-green-300 shadow-sm"
                ratio916
              />

              {/* Re-generate overlay on hover */}
              <div className="flex gap-2 mt-2  w-full items-center justify-center">
                <Button
                  onClick={handleDownloadImage}
                  className="w-8 rounded-lg h-8 bg-success-light text-success"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tải")}
                  icon={<HiOutlineArrowDownTray />}
                  placement="bottom"
                />
                <Button
                  onClick={handleGenerateImage}
                  disabled={generatingImage}
                  icon={<GenerateAiIcon />}
                  placement="bottom"
                  className="w-8 rounded-lg h-8 bg-orange-light  text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
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

      {/* Generated Video */}
      <td className="py-3 px-3 w-24">
        <div className="flex justify-center">
          {generatedVideo ? (
            /* ── Show generated video thumbnail ── */
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
                      aspectRatio={videoConfig?.aspectRatio}
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
                <Button
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                  icon={<GenerateAiIcon />}
                  placement="bottom"
                  className="w-8 rounded-lg h-8 bg-orange-light  text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              </div>
            </div>
          ) : generatingVideo ? (
            /* ── Spinner + progress ── */
            <div
              className="relative w-32 rounded-xl border-2 border-purple-300 bg-purple-50"
              style={{ paddingTop: videoPaddingTop }}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <RiLoader4Line className="text-purple-500 text-xl animate-spin" />
                <span className="text-purple-600 text-[10px] font-bold mt-0.5">
                  {videoProgress}%
                </span>
              </div>
            </div>
          ) : (
            /* ── Default create button ── */
            <button
              onClick={handleGenerateVideo}
              disabled={!generatedImage}
              title={!generatedImage ? t("Cần tạo ảnh trước khi tạo video") : undefined}
              className={`relative w-32 h-16 rounded-xl border-2 border-dashed transition-all group ${
                generatedImage
                  ? "border-gray-200 hover:border-purple-300 bg-gray-50 hover:bg-purple-50 cursor-pointer"
                  : "border-gray-100 bg-gray-50 cursor-not-allowed opacity-50"
              }`}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <RiVideoFill
                  className={`text-xl mb-0.5 ${
                    generatedImage ? "text-gray-300 group-hover:text-purple-400" : "text-gray-200"
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    generatedImage ? "text-gray-400 group-hover:text-purple-500" : "text-gray-300"
                  }`}
                >
                  {t("Tạo video")}
                </span>
              </div>
            </button>
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
                className={`w-6 h-6 rounded-md shadow-sm ${
                  isDisabled
                    ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                    : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
                }`}
                iconClassName="text-sm"
                icon={isDisabled ? <RiEyeLine /> : <RiEyeOffLine />}
                tooltip={isDisabled ? t("Hiện Cảnh") : t("Ẩn Cảnh")}
                placement="bottom"
              />
            </div>
            {/* Voice toggle – visible on hover OR when voiceDisable is true */}
            <div
              className={`transition-opacity duration-200 ${
                rowHovered || scene.voiceDisable ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <Button
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
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneRowGroup – nhóm row: nút thêm trên + scene row + nút thêm dưới
// Quản lý hover state chung cho cả nhóm
// ─────────────────────────────────────────────────────────────────────────────

interface SceneRowGroupProps {
  scene: SceneScript;
  index: number;
  isDisabled: boolean;
  characters: CharacterItem[];
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
  isDisabled,
  characters,
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
        isDisabled={isDisabled}
        isGroupHovered={hovered}
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
