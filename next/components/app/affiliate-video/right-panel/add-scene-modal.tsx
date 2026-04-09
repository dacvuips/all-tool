/**
 * add-scene-modal.tsx
 * Modal thêm cảnh mới + nút "+" chèn scene giữa các cảnh
 * Extracted from batch-list.tsx – className only, Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiAddLine,
  RiCloseLine,
  RiImageAddFill,
  RiImageFill,
  RiLoader4Line,
  RiMagicFill,
  RiVideoFill,
} from "react-icons/ri";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import { CAMERA_ANGLES, CharacterItem, SceneScript } from "../constants";

// ── Types ──────────────────────────────────────────────────────────────────
export type InsertPosition = "above" | "below";

export interface NewSceneData {
  description: string;
  voiceover: string;
  cameraAngle: string;
  selectedCharacters: string[];
  audio: string;
}

// ── AddSceneModal ──────────────────────────────────────────────────────────
interface AddSceneModalProps {
  targetScene: SceneScript;
  position: InsertPosition;
  characters: CharacterItem[];
  onClose: () => void;
  onConfirm: (data: NewSceneData) => Promise<void> | void;
}

export function AddSceneModal({
  targetScene,
  position,
  characters,
  onClose,
  onConfirm,
}: AddSceneModalProps) {
  const { t } = useTranslation();

  // ── Form state ──
  const [sceneDescription, setSceneDescription] = useState("");
  const [sceneVoiceover, setSceneVoiceover] = useState("");
  const [selectedCameraAngle, setSelectedCameraAngle] = useState("");
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [sceneAudio, setSceneAudio] = useState("");

  /** Toggle nhân vật được chọn */
  const toggleCharacter = (characterId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(characterId) ? prev.filter((c) => c !== characterId) : [...prev, characterId]
    );
  };

  /** Xử lý chèn scene mới */
  const handleInsertScene = async () => {
    setIsCreating(true);
    try {
      await onConfirm({
        description: sceneDescription,
        voiceover: sceneVoiceover,
        cameraAngle: selectedCameraAngle,
        selectedCharacters: selectedCharacterIds,
        audio: sceneAudio,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Label vị trí chèn
  const insertPositionLabel =
    position === "above"
      ? `↑ ${t("Chèn phía trên Scene")} #${targetScene.sceneNumber}`
      : `↓ ${t("Chèn phía dưới Scene")} #${targetScene.sceneNumber}`;

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
              <div className="text-gray-500 text-xs mt-0.5">{insertPositionLabel}</div>
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
          {/* Mô tả nội dung cảnh */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              🎭 {t("Mô tả nội dung cảnh mới")}:
            </div>
            {/* Danh sách nhân vật */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => toggleCharacter(char.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                    selectedCharacterIds.includes(char.id)
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  <RiAddLine className="text-xs" />
                  {char.name}
                </button>
              ))}
            </div>
            {/* Textarea mô tả + nút AI */}
            <div className="relative">
              <textarea
                value={sceneDescription}
                onChange={(e) => setSceneDescription(e.target.value)}
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

          {/* Lời thoại / Voiceover */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <MdRecordVoiceOver className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                Voiceover / {t("Lời thoại")}{" "}
                <span className="text-gray-400 font-normal">({t("tùy chọn")})</span>
              </span>
            </div>
            <textarea
              value={sceneVoiceover}
              onChange={(e) => setSceneVoiceover(e.target.value)}
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
                  onClick={() => setSelectedCameraAngle(angle === selectedCameraAngle ? "" : angle)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer transition-all ${
                    selectedCameraAngle === angle
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
          <Button onClick={handleInsertScene} disabled={isCreating} primary>
            {isCreating ? (
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

// ── AddSceneButton ─────────────────────────────────────────────────────────
// Nút "+" chèn scene giữa các hàng, hiện modal khi click

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

export function AddSceneButton({ scene, position, characters, onInsert }: AddSceneButtonProps) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Tooltip text
  const tooltipText = position === "above" ? t("Thêm cảnh phía trên") : t("Thêm cảnh phía dưới");

  return (
    <>
      {isModalOpen && (
        <AddSceneModal
          targetScene={scene}
          position={position}
          characters={characters}
          onClose={() => setIsModalOpen(false)}
          onConfirm={async (data) => {
            await onInsert(scene, position, data);
            setIsModalOpen(false);
          }}
        />
      )}
      <div
        className="flex items-center justify-center py-1 relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-6 h-6 rounded-full bg-purple-500 hover:bg-purple-600 border-2 border-purple-300 text-white flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 z-10"
        >
          <RiAddLine className="text-xs" />
        </button>
        {/* Tooltip */}
        {isHovered && (
          <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap z-20 shadow-lg pointer-events-none">
            {tooltipText}
          </div>
        )}
      </div>
    </>
  );
}
