/**
 * batch-list.tsx
 * Batch List Panel – danh sách scene dạng bảng
 * className only – Tailwind CSS, no inline styles
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiPlayCircle } from "react-icons/bi";
import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiAddLine,
  RiCloseLine,
  RiEyeLine,
  RiEyeOffLine,
  RiFileCopyLine,
  RiImageAddFill,
  RiImageFill,
  RiLoader4Line,
  RiMagicFill,
  RiPencilLine,
  RiSaveLine,
  RiVideoFill,
} from "react-icons/ri";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { VideoDialog } from "../../../shared/common/video-dialog";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import {
  CACHE_KEY,
  CAMERA_ANGLES,
  CharacterItem,
  DB_NAME,
  SceneScript,
  ScriptData,
  STORE_NAME,
} from "../constants";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { useIndexedDB } from "../hook/useIndexedDB";
import { useSceneMedia } from "../hook/useSceneMedia";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchActionBar } from "./batch-action-bar";

type InsertPosition = "above" | "below";

interface NewSceneData {
  description: string;
  voiceover: string;
  cameraAngle: string;
  selectedCharacters: string[];
  audio: string;
}

interface AddSceneModalProps {
  targetScene: SceneScript;
  position: InsertPosition;
  characters: CharacterItem[];
  onClose: () => void;
  onConfirm: (data: NewSceneData) => Promise<void> | void;
}

function AddSceneModal({
  targetScene,
  position,
  characters,
  onClose,
  onConfirm,
}: AddSceneModalProps) {
  const { t } = useTranslation();
  const [description, setDescription] = useState("");
  const [voiceover, setVoiceover] = useState("");
  const [cameraAngle, setCameraAngle] = useState("");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [audio, setAudio] = useState("");
  const toggleChar = (id: string) => {
    setSelectedChars((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleInsertScene = async () => {
    setCreating(true);
    try {
      await onConfirm({
        description,
        voiceover,
        cameraAngle,
        selectedCharacters: selectedChars,
        audio,
      });
    } finally {
      setCreating(false);
    }
  };

  const posLabel =
    position === "above"
      ? `↑ Chèn phía trên Scene #${targetScene.sceneNumber}`
      : `↓ Chèn phía dưới Scene #${targetScene.sceneNumber}`;

  return (
    <Dialog
      isOpen
      onClose={onClose}
      width={480}
      slideFromBottom="none"
      hasCloseIcon={false}
      dialogClass="relative bg-white shadow-2xl rounded-2xl overflow-hidden"
      headerClass=""
      bodyClass=""
      footerClass=""
    >
      <Dialog.Header>
        {/* ── Modal Header ── */}
        <div className="px-5 pt-4 ">
          <div className="flex items-center justify-between">
            <div>
              <div className=" font-bold text-base">✨ {t("Thêm Cảnh Mới")}</div>
              <div className="text-gray-500 text-xs mt-0.5">{posLabel}</div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center text-gray-500 cursor-pointer border-0 transition-colors"
            >
              <RiCloseLine className="text-sm" />
            </button>
          </div>
        </div>
      </Dialog.Header>

      <Dialog.Body>
        {/* ── Modal Body ── */}
        <div className="px-4 py-2 space-y-2 max-h-96 overflow-y-auto v-scrollbar">
          {/* Mô tả nội dung */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              🎭 {t("Mô tả nội dung cảnh mới")}:
            </div>
            {/* Character tags */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => toggleChar(char.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                    selectedChars.includes(char.id)
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  <RiAddLine className="text-xs" />
                  {char.name}
                </button>
              ))}
            </div>
            {/* Textarea + AI buttons */}
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={`${t("VD")}: ${t(
                  "Bà Lan tức giận ném khay bạc xuống đất, Chị Hoa sợ hãi lùi lại..."
                )}`}
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 px-3 py-2.5 pb-8 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors placeholder-gray-400"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <button
                  className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center cursor-pointer border-0 transition-colors"
                  title={t("Dịch")}
                >
                  <span className="text-xs font-bold">G</span>
                </button>
                <button
                  className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center cursor-pointer border-0 transition-colors"
                  title={t("AI viết lại")}
                >
                  <RiMagicFill className="text-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Voiceover / Lời thoại */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MdRecordVoiceOver className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                Voiceover / {t("Lời thoại")}{" "}
                <span className="text-gray-400 font-normal">({t("tùy chọn")})</span>
              </span>
            </div>
            <textarea
              value={voiceover}
              onChange={(e) => setVoiceover(e.target.value)}
              placeholder={t("Có thể để trống, AI sẽ tự sinh lời thoại...")}
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors placeholder-gray-400"
            />
          </div>

          {/* Ảnh sản phẩm */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <RiImageFill className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                {t("Ảnh sản phẩm")}{" "}
                <span className="text-gray-400 font-normal">({t("tùy chọn")} — [2])</span>
              </span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold cursor-pointer transition-colors">
              <RiImageAddFill className="text-sm" />
              {t("Tải ảnh sản phẩm")}
            </button>
            <p className="text-xs text-gray-400 mt-1">
              * {t("AI sẽ dùng [2] đã chọn sẵn để chèn ảnh vào scene")}
            </p>
          </div>

          {/* Góc máy */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <RiVideoFill className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                {t("Góc máy")} <span className="text-gray-400 font-normal">({t("tùy chọn")})</span>
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CAMERA_ANGLES.map((angle) => (
                <button
                  key={angle}
                  onClick={() => setCameraAngle(angle === cameraAngle ? "" : angle)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                    cameraAngle === angle
                      ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {angle}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Dialog.Body>

      <Dialog.Footer>
        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-white rounded-b-2xl">
          <Button onClick={onClose} outline>
            {t("Hủy")}
          </Button>
          <Button onClick={handleInsertScene} disabled={creating} primary>
            {creating ? (
              <>
                <RiLoader4Line className="text-sm animate-spin" />
                {`${t("Đang tạo")}...`}
              </>
            ) : (
              <>
                <RiMagicFill className="text-sm" />
                {t("Tạo Scene")}
              </>
            )}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddSceneButton – nút "+" giữa các scene
// ─────────────────────────────────────────────────────────────────────────────

interface AddSceneButtonProps {
  scene: SceneScript;
  position: InsertPosition;
  characters: CharacterItem[];
  onInsert: (
    scene: SceneScript,
    position: InsertPosition,
    data: NewSceneData
  ) => Promise<void> | void;
}

function AddSceneButton({ scene, position, characters, onInsert }: AddSceneButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {showModal && (
        <AddSceneModal
          targetScene={scene}
          position={position}
          characters={characters}
          onClose={() => setShowModal(false)}
          onConfirm={async (data) => {
            await onInsert(scene, position, data);
            setShowModal(false);
          }}
        />
      )}
      <div
        className="flex items-center justify-center py-1 relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={() => setShowModal(true)}
          className="w-6 h-6 rounded-full bg-purple-500 hover:bg-purple-600 border-2 border-purple-300 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 z-10"
        >
          <RiAddLine className="text-xs" />
        </button>
        {/* Tooltip */}
        {hovered && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-20 shadow-lg pointer-events-none">
            {position === "above" ? "Thêm scene phía trên" : "Thêm scene phía dưới"}
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneBatchRow – mỗi hàng scene trong bảng
// ─────────────────────────────────────────────────────────────────────────────

type EditField = "imageGenPrompt" | "motionPrompt" | "dialogue" | "audio";

function SceneBatchRow({
  scene,
  isDisabled,
  isGroupHovered,
  onMouseEnter,
  onMouseLeave,
  onUpdateScene,
  onToggleDisable,
}: {
  scene: SceneScript;
  index: number;
  isDisabled: boolean;
  isGroupHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onUpdateScene: (sceneId: string, field: EditField, value: string) => void;
  onToggleDisable: (sceneId: string) => void;
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
      {labelEl}
      {editingField === field ? (
        /* ── Edit mode ── */
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
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 cursor-pointer border-0 transition-colors disabled:opacity-50"
            >
              <RiCloseLine className="text-sm" />
              Đóng
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
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      ) : (
        /* ── Display mode ── */
        <div className="relative">
          <p className={`text-xs ${textColor} leading-relaxed pr-14`}>
            {expanded ? text : truncate(text)}
          </p>
          {/* Action icons – visible when hovering this field's area */}
          <div
            className="absolute top-0 right-0 flex items-center gap-0.5"
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
              title="Chỉnh sửa"
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
          <div className="text-xs font-bold text-orange mb-1 uppercase tracking-wide">
            IMAGE PROMPT
          </div>
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
          <div className="text-xs font-bold text-teal mb-1 uppercase tracking-wide">[MOTION]:</div>
        )}
        {renderEditablePrompt(
          "audio",
          scene.audio ?? "",
          "text-purple-700",
          <div className="text-xs font-bold text-green-600 mt-2 mb-1 uppercase tracking-wide">
            [AUDIO]:
          </div>
        )}
        {renderEditablePrompt(
          "dialogue",
          scene.dialogue ?? "",
          "text-green-700 italic",
          <div className="text-xs font-bold text-green-600 mt-2 mb-1 uppercase tracking-wide">
            [DIALOGUE]:
          </div>
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

      {/* Right-side overlay: scene number badge + toggle disable – visible on hover */}
      <td className="p-0 w-0" style={{ position: "relative" }}>
        <div
          className={`absolute right-2 top-2 bottom-2 flex flex-col items-center justify-between z-10 transition-opacity duration-200 ${
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
          {/* Scene number badge – bottom right, large text */}
          <span className="text-lg font-extrabold text-gray-300">#{scene.sceneNumber}</span>
        </div>
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SceneRowGroup – nhóm row gồm: nút thêm trên + scene + nút thêm dưới
// Quản lý hover state chung, ẩn/hiện nút thêm khi hover
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

function SceneRowGroup({
  scene,
  index,
  isDisabled,
  characters,
  onInsert,
  onUpdateScene,
  onToggleDisable,
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

      {/* Scene data row – highlighted with colored border on hover */}
      <SceneBatchRow
        scene={scene}
        index={index}
        isDisabled={isDisabled}
        isGroupHovered={hovered}
        onMouseEnter={enter}
        onMouseLeave={leave}
        onUpdateScene={onUpdateScene}
        onToggleDisable={onToggleDisable}
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
// BatchListPanel – main export
// ─────────────────────────────────────────────────────────────────────────────

interface BatchListPanelProps {
  scenes: SceneScript[];
  characters: CharacterItem[];
}

export function BatchListPanel({ scenes, characters }: BatchListPanelProps) {
  const { t } = useTranslation();
  const [sceneList, setSceneList] = useState<SceneScript[]>(scenes);
  const { scriptData, setScriptData } = useAffiliateVideoContext();
  const db = useIndexedDB<ScriptData>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const { insertScene } = useAffiliateVideoApi();

  /** Toggle disabled state on a scene and persist to IndexedDB */
  const handleToggleDisable = async (sceneId: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, disabled: !s.disabled } : s));
    // 1. Update UI immediately – do NOT call setScriptData to avoid
    //    triggering a parent re-render that would overwrite local state
    setSceneList(updated);
    // 2. Persist to IndexedDB by reading current record then merging
    try {
      const current = await db.get(CACHE_KEY.lastScript);
      await db.set(CACHE_KEY.lastScript, { ...(current ?? scriptData), scenes: updated as any });
    } catch (err) {
      console.error("[handleToggleDisable] Failed to persist to IndexedDB:", err);
    }
  };

  const handleInsert = async (
    targetScene: SceneScript,
    position: InsertPosition,
    data: NewSceneData
  ) => {
    // Determine insert index and adjacent scenes for context
    const idx = sceneList.findIndex((s) => s.id === targetScene.id);
    const insertAt = position === "above" ? idx : idx + 1;
    const newSceneNumber = insertAt + 1;
    const prevScene = insertAt > 0 ? sceneList[insertAt - 1] : undefined;
    const nextScene = insertAt < sceneList.length ? sceneList[insertAt] : undefined;

    try {
      // Call AI API to generate proper prompts for the new scene
      const result = await insertScene({
        description: data.description,
        voiceover: data.voiceover,
        camera: data.cameraAngle,
        selectedCharacters: data.selectedCharacters,
        sceneNumber: newSceneNumber,
        prevScene,
        nextScene,
        scriptContext: scriptData
          ? {
              cast: scriptData.characterName
                ? [
                    {
                      name: scriptData.characterName,
                      tag: "main",
                      description: scriptData.characterBaseDescription || "",
                    },
                  ]
                : undefined,
              environment: scriptData.environment,
              artStyle: scriptData.artStyle,
              voiceGender: scriptData.voiceGender,
              voiceTone: scriptData.voiceTone,
            }
          : undefined,
      });

      // Build SceneScript from API result
      const newScene: SceneScript = {
        id: crypto.randomUUID(),
        sceneNumber: newSceneNumber,
        camera: result?.camera || data.cameraAngle || "WIDE SHOT",
        imageGenPrompt: result?.imagePrompt || data.description || "(AI generated)",
        motionPrompt: result?.motionPrompt || data.description || "(AI generated)",
        dialogue: result?.dialogue || data.voiceover || "",
        visualPrompt: result?.visualPrompt || "",
        audio: result?.audio || data.audio || "",
      };

      // Insert into list and re-number
      const updated = [...sceneList.slice(0, insertAt), newScene, ...sceneList.slice(insertAt)].map(
        (s, i) => ({ ...s, sceneNumber: i + 1 })
      );

      setSceneList(updated);

      // Persist to IndexedDB
      try {
        const current = await db.get(CACHE_KEY.lastScript);
        const merged = { ...(current ?? scriptData), scenes: updated as any };
        await db.set(CACHE_KEY.lastScript, merged);
        setScriptData(merged as any);
      } catch (err) {
        console.error("[handleInsert] Failed to persist to IndexedDB:", err);
      }
    } catch (err) {
      console.error("[handleInsert] API error:", err);
      // Fallback: insert scene với dữ liệu từ modal (không có AI)
      const fallbackScene: SceneScript = {
        id: crypto.randomUUID(),
        sceneNumber: newSceneNumber,
        camera: data.cameraAngle || "WIDE SHOT",
        imageGenPrompt: data.description || "(AI generated)",
        motionPrompt: data.description || "(AI generated)",
        dialogue: data.voiceover || "",
        visualPrompt: "",
        audio: data.audio || "",
      };

      const updated = [
        ...sceneList.slice(0, insertAt),
        fallbackScene,
        ...sceneList.slice(insertAt),
      ].map((s, i) => ({ ...s, sceneNumber: i + 1 }));

      setSceneList(updated);
    }
  };

  const handleUpdateScene = async (sceneId: string, field: EditField, value: string) => {
    // 1. Compute the new list synchronously
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s));

    // 2. Update React state
    setSceneList(updated);

    // 3. Persist to IndexedDB asynchronously
    try {
      await db.set(CACHE_KEY.lastScript, { ...scriptData, scenes: updated as any });
      setScriptData({ ...scriptData, scenes: updated as any });
    } catch (err) {
      console.error("[handleUpdateScene] Failed to persist to IndexedDB:", err);
    }
  };

  if (sceneList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <RiVideoFill className="text-5xl mb-3 opacity-30" />
        <div className="text-sm font-medium text-gray-500 mb-1">{t("Chưa có scene nào")}</div>
        <div className="text-xs text-gray-400">{t("Chuyển sang tab Kịch Bản để tạo nội dung")}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Action buttons bar */}
      <BatchActionBar scenes={sceneList} />

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto v-scrollbar">
        <table className="w-full border-collapse text-sm">
          {/* Sticky header */}
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-bold text-orange  uppercase tracking-wide border-b border-gray-200 w-32">
                <div className="flex items-center gap-1">
                  <RiImageFill className="text-xs" />
                  {t("PROMPT HÌNH ẢNH")}
                </div>
              </th>
              <th className="text-left py-2.5 px-3 text-xs font-bold text-teal uppercase tracking-wide border-b border-gray-200 w-32">
                <div className="flex items-center gap-1">
                  <RiVideoFill className="text-xs" />
                  {t("CHUYỂN ĐỘNG & ÂM THANH")}
                </div>
              </th>
              <th className="text-center py-2.5 px-3 text-xs font-bold text-purple-600 uppercase tracking-wide border-b border-gray-200">
                {t("HÌNH ẢNH")}
                <br />({t("ĐÃ TẠO")})
              </th>
              <th className="text-center py-2.5 px-3 text-xs font-bold text-indigo-600 uppercase tracking-wide border-b border-gray-200">
                {t("VIDEO")}
                <br />({t("ĐÃ TẠO")})
              </th>
              <th className="border-b border-gray-200 w-0 p-0"></th>
            </tr>
          </thead>

          <tbody>
            {sceneList.map((scene, index) => (
              <SceneRowGroup
                key={scene.id}
                scene={scene}
                index={index}
                isDisabled={!!scene.disabled}
                characters={characters}
                onInsert={handleInsert}
                onUpdateScene={handleUpdateScene}
                onToggleDisable={handleToggleDisable}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
