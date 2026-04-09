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
}

export function SceneBatchRow({
  scene,
  isDisabled,
  isGroupHovered,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
}: SceneBatchRowProps) {
  const { t } = useTranslation();

  // ── UI state ──
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hoveredField, setHoveredField] = useState<EditField | null>(null);
  const [copiedField, setCopiedField] = useState<EditField | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);

  // ── Media hooks (ảnh / video đã tạo) ──
  const {
    generatedImage,
    generatingImage,
    imageProgress,
    generatedVideo,
    generatingVideo,
    videoProgress,
    handleGenerateImage,
    handleGenerateVideo,
    handleDownloadImage,
    handleDownloadVideo,
  } = useSceneMedia({ scene });

  const { videoConfig } = useAffiliateVideoContext();
  const videoPaddingTop = videoConfig?.aspectRatio === "16:9" ? "56.25%" : "177.78%";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Cắt text nếu vượt quá giới hạn */
  const truncateText = (text: string) =>
    text.length > PROMPT_MAX_CHARS ? text.slice(0, PROMPT_MAX_CHARS) + "..." : text;

  /** Kiểm tra xem có cần nút "Xem thêm" không */
  const needsExpandButton =
    scene.imageGenPrompt.length > PROMPT_MAX_CHARS ||
    scene.motionPrompt.length > PROMPT_MAX_CHARS ||
    (scene.dialogue?.length || 0) > PROMPT_MAX_CHARS;

  // ── Edit handlers ──
  const openEdit = (field: EditField) => {
    setEditingField(field);
    setEditValue(scene[field] ?? "");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const closeEdit = () => {
    setEditingField(null);
    setEditValue("");
  };

  const handleSaveEdit = async () => {
    if (!editingField) return;
    setIsSaving(true);
    try {
      onUpdateScene(scene.id, editingField, editValue);
    } finally {
      setIsSaving(false);
      closeEdit();
    }
  };

  const handleCopyPrompt = (field: EditField, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  // Auto-resize textarea khi nội dung thay đổi
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [editValue]);

  // ── Render editable prompt cell ──
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
      {labelEl}
      {editingField === field ? (
        /* ── Chế độ chỉnh sửa ── */
        <div className="mt-1">
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
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors disabled:opacity-50"
            >
              <RiCloseLine className="text-sm" />
              {t("Đóng")}
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer border-0 transition-colors disabled:opacity-60 shadow-sm"
            >
              {isSaving ? (
                <RiLoader4Line className="text-sm animate-spin" />
              ) : (
                <RiSaveLine className="text-sm" />
              )}
              {isSaving ? `${t("Đang lưu")}...` : t("Lưu")}
            </button>
          </div>
        </div>
      ) : (
        /* ── Chế độ hiển thị ── */
        <div className="relative">
          <p className={`text-xs ${textColor} leading-relaxed pr-14`}>
            {isExpanded ? text : truncateText(text)}
          </p>
          {/* Nút copy & edit – hiện khi hover vào ô */}
          <div
            className="absolute top-0 right-0 flex items-center gap-0.5"
            style={{
              opacity: hoveredField === field ? 1 : 0,
              pointerEvents: hoveredField === field ? "auto" : "none",
            }}
          >
            {/* Copy prompt */}
            <button
              onClick={() => handleCopyPrompt(field, text)}
              title={t("Sao chép prompt")}
              className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-all cursor-pointer border-0 bg-transparent"
            >
              {copiedField === field ? (
                <span className="text-green-500 text-xs font-bold">✓</span>
              ) : (
                <RiFileCopyLine className="text-sm" />
              )}
            </button>
            {/* Chỉnh sửa prompt */}
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

  // ── Scene number + toggle overlay (hiện khi hover vào ảnh) ──
  const renderSceneOverlay = () => (
    <div
      className={`absolute top-1 left-1 z-10 flex flex-col items-center gap-1 transition-opacity duration-200 ${
        isImageHovered ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Số thứ tự cảnh */}
      <span className="text-[10px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">
        #{scene.sceneNumber}
      </span>
      {/* Nút ẩn/hiện cảnh */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleDisable(scene.id);
        }}
        title={isDisabled ? t("Hiện cảnh") : t("Ẩn cảnh")}
        className={`w-5 h-5 rounded flex items-center justify-center border-0 cursor-pointer transition-all ${
          isDisabled
            ? "text-white bg-blue-500/70 hover:bg-blue-600/80"
            : "text-white bg-black/40 hover:bg-red-500/70"
        }`}
      >
        {isDisabled ? <RiEyeLine className="text-xs" /> : <RiEyeOffLine className="text-xs" />}
      </button>
    </div>
  );

  // ── Scene number badge (luôn hiện -- không hover) cho khi chưa có ảnh ──
  const renderSceneBadge = () => (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-xs font-bold text-gray-600">#{scene.sceneNumber}</span>
    </div>
  );

  // ── Nút toggle ẩn/hiện cảnh – hiện bên phải row khi hover ──
  const renderRowToggleButton = () => (
    <div
      className={`flex items-center justify-center relative transition-all duration-200 ${
        isRowHovered ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <button
        onClick={() => onToggleDisable(scene.id)}
        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 z-10 ${
          isDisabled
            ? "bg-blue-500 hover:bg-blue-600 border-blue-300 text-white"
            : "bg-gray-400 hover:bg-red-500 border-gray-300 hover:border-red-300 text-white"
        }`}
      >
        {isDisabled ? <RiEyeLine className="text-xs" /> : <RiEyeOffLine className="text-xs" />}
      </button>
      {/* Tooltip */}
      {isRowHovered && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-20 shadow-lg pointer-events-none">
          {isDisabled ? t("Hiện cảnh") : t("Ẩn cảnh")}
        </div>
      )}
    </div>
  );

  return (
    <tr
      className={`border-t border-gray-200 border-dashed bg-white transition-all duration-200 align-top ${
        isDisabled ? "opacity-40" : "hover:bg-gray-50"
      }`}
      style={
        isGroupHovered && !isDisabled
          ? { outline: "1px dashed #a855f7", outlineOffset: "-1px" }
          : undefined
      }
      onMouseEnter={() => {
        setIsRowHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => {
        setIsRowHovered(false);
        onMouseLeave?.();
      }}
    >
      {/* ── Cột: Image Prompt ── */}
      <td className="py-3 px-3">
        {renderEditablePrompt(
          "imageGenPrompt",
          scene.imageGenPrompt,
          "text-gray-600",
          <div className="text-xs font-bold text-orange mb-1 uppercase tracking-wide">
            {t("PROMPT HÌNH ẢNH")}
          </div>
        )}
        {editingField !== "imageGenPrompt" && scene.imageGenPrompt.length > PROMPT_MAX_CHARS && (
          <button
            onClick={() => setIsExpanded((p) => !p)}
            className="text-xs text-blue-500 hover:text-blue-700 mt-1 cursor-pointer border-0 bg-transparent font-medium"
          >
            {isExpanded ? `▲ ${t("Thu gọn")}` : `▼ ${t("Xem thêm")}`}
          </button>
        )}
      </td>

      {/* ── Cột: Motion + Audio + Dialogue ── */}
      <td className="py-3 px-3">
        {renderEditablePrompt(
          "motionPrompt",
          scene.motionPrompt,
          "text-teal-700",
          <div className="text-xs font-bold text-teal mb-1 uppercase tracking-wide">
            [{t("CHUYỂN ĐỘNG")}]:
          </div>
        )}
        {renderEditablePrompt(
          "audio",
          scene.audio ?? "",
          "text-purple-700",
          <div className="text-xs font-bold text-green-600 mt-2 mb-1 uppercase tracking-wide">
            [{t("ÂM THANH")}]:
          </div>
        )}
        {renderEditablePrompt(
          "dialogue",
          scene.dialogue ?? "",
          "text-green-700 italic",
          <div className="text-xs font-bold text-green-600 mt-2 mb-1 uppercase tracking-wide">
            [{t("LỜI THOẠI")}]:
          </div>
        )}
        {editingField !== "motionPrompt" && editingField !== "dialogue" && needsExpandButton && (
          <button
            onClick={() => setIsExpanded((p) => !p)}
            className="text-xs text-blue-500 hover:text-blue-700 mt-1 cursor-pointer border-0 bg-transparent font-medium"
          >
            {isExpanded ? `▲ ${t("Thu gọn")}` : `▼ ${t("Xem thêm")}`}
          </button>
        )}
      </td>

      {/* ── Cột: Ảnh đã tạo (Generated Image) + overlay scene number ── */}
      <td className="py-3 px-3 w-24">
        <div
          className="flex justify-center"
          onMouseEnter={() => setIsImageHovered(true)}
          onMouseLeave={() => setIsImageHovered(false)}
        >
          {generatedImage ? (
            /* ── Thumbnail ảnh đã tạo ── */
            <div className="relative w-32 h-full group">
              {/* Overlay: scene number + toggle trên ảnh khi hover */}
              {renderSceneOverlay()}

              <Img
                showImageOnClick
                src={`data:${generatedImage.mimeType};base64,${generatedImage.imageBytes}`}
                alt={`${t("Cảnh")} ${scene.sceneNumber}`}
                className="rounded-md object-cover   shadow-sm"
                ratio916
              />

              {/* Nút tải & tạo lại ảnh */}
              <div className="flex gap-2 mt-2 w-full items-center justify-center">
                <Button
                  onClick={handleDownloadImage}
                  className="w-8 rounded-md h-8 bg-success-light text-success"
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
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              </div>
            </div>
          ) : generatingImage ? (
            /* ── Loading spinner ── */
            <div className="w-16 h-16 rounded-xl border-2 border-pink-300 bg-pink-50 flex flex-col items-center justify-center">
              <RiLoader4Line className="text-pink-500 text-xl animate-spin" />
              <span className="text-pink-600 text-[10px] font-bold mt-0.5">{imageProgress}%</span>
            </div>
          ) : (
            /* ── Nút tạo ảnh mặc định ── */
            <div className="relative">
              {/* Scene badge luôn hiện khi chưa có ảnh */}
              {renderSceneBadge()}
              <button
                onClick={handleGenerateImage}
                className="w-32 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 bg-gray-50 hover:bg-pink-50 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-xl mb-0.5" />
                <span className="text-gray-400 group-hover:text-pink-500 text-xs font-medium">
                  {t("Tạo ảnh")}
                </span>
              </button>
            </div>
          )}
        </div>
      </td>

      {/* ── Cột: Video đã tạo (Generated Video) ── */}
      <td className="py-3 px-3 w-24">
        <div className="flex justify-center">
          {generatedVideo ? (
            /* ── Thumbnail video đã tạo ── */
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
                        onClick={() => setIsVideoModalOpen(true)}
                      />
                      {/* Play icon overlay */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-black/20 opacity-100 group-hover:opacity-0 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                          <BiPlayCircle className="text-white w-12 h-12" />
                        </div>
                      </div>
                    </div>
                    {/* Modal xem video toàn màn hình */}
                    <VideoDialog
                      videoUrl={videoSrc}
                      isOpen={isVideoModalOpen}
                      onClose={() => setIsVideoModalOpen(false)}
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
              {/* Nút tải & tạo lại video */}
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
                  className="w-8 rounded-lg h-8 bg-orange-light text-orange"
                  iconClassName="text-xl font-bold"
                  tooltip={t("Tạo lại")}
                />
              </div>
            </div>
          ) : generatingVideo ? (
            /* ── Loading spinner video ── */
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
            /* ── Nút tạo video mặc định ── */
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

      {/* ── Cột: Toggle ẩn/hiện cảnh (hover) ── */}
      <td className="py-3 px-1 w-8 align-middle">{renderRowToggleButton()}</td>
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
}

export function SceneRowGroup({
  scene,
  index,
  isDisabled,
  characters,
  onInsert,
  onUpdateScene,
  onToggleDisable,
}: SceneRowGroupProps) {
  const [isHovered, setIsHovered] = useState(false);
  const handleEnter = () => setIsHovered(true);
  const handleLeave = () => setIsHovered(false);

  /** Class chung cho nút thêm scene – absolute positioned */
  const addButtonClass = `absolute left-0 right-0 flex justify-center z-20 transition-all duration-200 ${
    isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
  }`;

  return (
    <React.Fragment>
      {/* Nút thêm scene phía TRÊN – chỉ hiện cho scene đầu tiên */}
      {index === 0 && (
        <tr onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <td
            colSpan={5}
            className="p-0 relative overflow-visible"
            style={{ height: 0, lineHeight: 0, border: "none" }}
          >
            <div className={addButtonClass} style={{ top: "50%", transform: "translateY(-50%)" }}>
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

      {/* Scene data row – viền tím khi hover */}
      <SceneBatchRow
        scene={scene}
        index={index}
        isDisabled={isDisabled}
        isGroupHovered={isHovered}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onUpdateScene={onUpdateScene}
        onToggleDisable={onToggleDisable}
      />

      {/* Nút thêm scene phía DƯỚI – absolute positioned giữa các row */}
      <tr onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        <td
          colSpan={5}
          className="p-0 relative overflow-visible"
          style={{ height: 0, lineHeight: 0, border: "none" }}
        >
          <div className={addButtonClass} style={{ top: "50%", transform: "translateY(-50%)" }}>
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
