/**
 * batch-list.tsx
 * Batch List Panel – danh sách scene dạng bảng
 * className only – Tailwind CSS, no inline styles
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiAddLine,
  RiCloseLine,
  RiDownloadLine,
  RiFileCopyLine,
  RiImageAddFill,
  RiImageFill,
  RiLoader4Line,
  RiMagicFill,
  RiRefreshLine,
  RiVideoFill,
} from "react-icons/ri";
import { CharacterItem, SceneItem } from "../constants";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type InsertPosition = "above" | "below";

interface NewSceneData {
  description: string;
  voiceover: string;
  cameraAngle: string;
  selectedCharacters: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Camera Angles
// ─────────────────────────────────────────────────────────────────────────────

const CAMERA_ANGLES = [
  "Cận cảnh",
  "Trung cận",
  "Trung cảnh",
  "Toàn cảnh",
  "Viền cảnh",
  "Góc thấp",
  "Góc cao",
  "Qua vai",
  "Góc nghiêng",
  "Theo dõi",
  "POV",
];

// ─────────────────────────────────────────────────────────────────────────────
// AddSceneModal
// ─────────────────────────────────────────────────────────────────────────────

interface AddSceneModalProps {
  targetScene: SceneItem;
  position: InsertPosition;
  characters: CharacterItem[];
  onClose: () => void;
  onConfirm: (data: NewSceneData) => void;
}

function AddSceneModal({
  targetScene,
  position,
  characters,
  onClose,
  onConfirm,
}: AddSceneModalProps) {
  const [description, setDescription] = useState("");
  const [voiceover, setVoiceover] = useState("");
  const [cameraAngle, setCameraAngle] = useState("");
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const toggleChar = (id: string) => {
    setSelectedChars((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  };

  const handleCreate = async () => {
    setCreating(true);
    await new Promise((r) => setTimeout(r, 800));
    onConfirm({ description, voiceover, cameraAngle, selectedCharacters: selectedChars });
    setCreating(false);
  };

  const posLabel =
    position === "above"
      ? `↑ Chèn phía trên Scene #${targetScene.number}`
      : `↓ Chèn phía dưới Scene #${targetScene.number}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-500 to-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-base">✨ Thêm Scene Mới</div>
              <div className="text-purple-200 text-xs mt-0.5">{posLabel}</div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 flex items-center justify-center text-white cursor-pointer border-0 transition-colors"
            >
              <RiCloseLine className="text-sm" />
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
          {/* Mô tả nội dung */}
          <div>
            <div className="text-sm font-semibold text-gray-700 mb-2">
              🎭 Mô tả nội dung scene mới:
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
                placeholder="VD: Bà Lan tức giận ném khay bạc xuống đất, Chị Hoa sợ hãi lùi lại..."
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 px-3 py-2.5 pb-8 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors placeholder-gray-400"
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-1">
                <button
                  className="w-6 h-6 rounded-full bg-green-100 hover:bg-green-200 text-green-600 flex items-center justify-center cursor-pointer border-0 transition-colors"
                  title="Dịch"
                >
                  <span className="text-xs font-bold">G</span>
                </button>
                <button
                  className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center cursor-pointer border-0 transition-colors"
                  title="AI viết lại"
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
                Voiceover / Lời thoại <span className="text-gray-400 font-normal">(tùy chọn)</span>
              </span>
            </div>
            <textarea
              value={voiceover}
              onChange={(e) => setVoiceover(e.target.value)}
              placeholder="Có thể để trống, AI sẽ tự sinh lời thoại..."
              rows={2}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 px-3 py-2.5 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 resize-none transition-colors placeholder-gray-400"
            />
          </div>

          {/* Ảnh sản phẩm */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <RiImageFill className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                Ảnh sản phẩm <span className="text-gray-400 font-normal">(tùy chọn — [2])</span>
              </span>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold cursor-pointer transition-colors">
              <RiImageAddFill className="text-sm" />
              Tải ảnh sản phẩm
            </button>
            <p className="text-xs text-gray-400 mt-1">
              * AI sẽ dùng [2] đã chọn sẵn để chèn ảnh vào scene
            </p>
          </div>

          {/* Góc máy */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <RiVideoFill className="text-gray-500 text-sm" />
              <span className="text-sm font-semibold text-gray-700">
                Góc máy <span className="text-gray-400 font-normal">(tùy chọn)</span>
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

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-100 cursor-pointer border-0 bg-transparent transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-60 cursor-pointer border-0 transition-all shadow-md"
          >
            {creating ? (
              <>
                <RiLoader4Line className="text-sm animate-spin" />
                Đang tạo...
              </>
            ) : (
              <>
                <RiMagicFill className="text-sm" />
                Tạo Scene
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddSceneButton – nút "+" giữa các scene
// ─────────────────────────────────────────────────────────────────────────────

interface AddSceneButtonProps {
  scene: SceneItem;
  position: InsertPosition;
  characters: CharacterItem[];
  onInsert: (scene: SceneItem, position: InsertPosition, data: NewSceneData) => void;
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
          onConfirm={(data) => {
            onInsert(scene, position, data);
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

function SceneBatchRow({
  scene,
  onMouseEnter,
  onMouseLeave,
}: {
  scene: SceneItem;
  index: number;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const MAX_CHARS = 160;

  const truncate = (text: string) =>
    text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "..." : text;

  const needsExpand =
    scene.imageGenPrompt.length > MAX_CHARS ||
    scene.motionPrompt.length > MAX_CHARS ||
    (scene.dialogue?.length || 0) > MAX_CHARS;

  return (
    <tr
      className="border-t border-gray-200 bg-white hover:bg-gray-50 transition-colors align-top"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Scene number */}
      <td className="py-3 px-3 w-5">
        <span className="text-xs font-bold text-gray-600">#{scene.number}</span>
      </td>

      {/* Image Prompt */}
      <td className="py-3 px-3">
        <div className="text-xs font-bold text-orange mb-1 uppercase tracking-wide">
          IMAGE PROMPT
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {expanded ? scene.imageGenPrompt : truncate(scene.imageGenPrompt)}
        </p>
        {scene.imageGenPrompt.length > MAX_CHARS && (
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
        <div className="text-xs font-bold text-teal mb-1 uppercase tracking-wide">[MOTION]:</div>
        <p className="text-xs text-teal-700 leading-relaxed">
          {expanded ? scene.motionPrompt : truncate(scene.motionPrompt)}
        </p>
        {scene.dialogue && (
          <>
            <div className="text-xs font-bold text-green-600 mt-2 mb-1 uppercase tracking-wide">
              [AUDIO]:
            </div>
            <p className="text-xs text-green-700 leading-relaxed italic">
              {expanded ? scene.dialogue : truncate(scene.dialogue)}
            </p>
          </>
        )}
        {needsExpand && (
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
          <button className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 bg-gray-50 hover:bg-pink-50 flex flex-col items-center justify-center cursor-pointer transition-all group">
            <RiImageFill className="text-gray-300 group-hover:text-pink-400 text-xl mb-0.5" />
            <span className="text-gray-400 group-hover:text-pink-500 text-xs font-medium">
              Create
            </span>
          </button>
        </div>
      </td>

      {/* Generated Video */}
      <td className="py-3 px-3 w-24">
        <div className="flex justify-center">
          <button className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 hover:border-purple-300 bg-gray-50 hover:bg-purple-50 flex flex-col items-center justify-center cursor-pointer transition-all group">
            <RiVideoFill className="text-gray-300 group-hover:text-purple-400 text-xl mb-0.5" />
            <span className="text-gray-400 group-hover:text-purple-500 text-xs font-medium">
              Create
            </span>
          </button>
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
  scene: SceneItem;
  index: number;
  characters: CharacterItem[];
  onInsert: (scene: SceneItem, position: InsertPosition, data: NewSceneData) => void;
}

function SceneRowGroup({ scene, index, characters, onInsert }: SceneRowGroupProps) {
  const [hovered, setHovered] = useState(false);
  const enter = () => setHovered(true);
  const leave = () => setHovered(false);

  const addBtnClass = `transition-all duration-200 overflow-hidden ${
    hovered ? "max-h-10 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
  }`;

  return (
    <React.Fragment>
      {/* Add ABOVE button – chỉ hiện trước scene đầu tiên */}
      {index === 0 && (
        <tr onMouseEnter={enter} onMouseLeave={leave}>
          <td colSpan={5} className="p-0">
            <div className={addBtnClass}>
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

      {/* Scene data row */}
      <SceneBatchRow scene={scene} index={index} onMouseEnter={enter} onMouseLeave={leave} />

      {/* Add BELOW button – sau mỗi scene */}
      <tr onMouseEnter={enter} onMouseLeave={leave}>
        <td colSpan={5} className="p-0">
          <div className={addBtnClass}>
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
// BatchActionBar – thanh action buttons trên cùng
// ─────────────────────────────────────────────────────────────────────────────

function BatchActionBar({ sceneCount }: { sceneCount: number }) {
  const actions = [
    {
      id: "batch-create-img",
      icon: <RiImageFill />,
      label: "Tạo Ảnh",
      color: "bg-pink-500 hover:bg-pink-600",
    },
    {
      id: "batch-download-img",
      icon: <RiDownloadLine />,
      label: "Tải Ảnh",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      id: "batch-create-video",
      icon: <RiVideoFill />,
      label: `Tạo Video (x${sceneCount})`,
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      id: "batch-download-video",
      icon: <RiDownloadLine />,
      label: "Tải Video (0)",
      color: "bg-indigo-500 hover:bg-indigo-600",
    },
    {
      id: "batch-retry-video",
      icon: <RiRefreshLine />,
      label: "Tạo Lại Video Lỗi",
      color: "bg-orange-500 hover:bg-orange-600",
    },
    {
      id: "batch-export-prompt",
      icon: <RiFileCopyLine />,
      label: "Xuất Prompt",
      color: "bg-green-500 hover:bg-green-600",
    },
  ];

  return (
    <div className="flex items-center gap-2 p-3 border-b border-gray-100 flex-wrap bg-white flex-shrink-0">
      {actions.map((action) => (
        <button
          key={action.id}
          id={action.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold cursor-pointer border-0 transition-colors ${action.color}`}
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BatchListPanel – main export
// ─────────────────────────────────────────────────────────────────────────────

interface BatchListPanelProps {
  scenes: SceneItem[];
  characters: CharacterItem[];
}

export function BatchListPanel({ scenes, characters }: BatchListPanelProps) {
  const { t } = useTranslation();
  const [sceneList, setSceneList] = useState<SceneItem[]>(scenes);

  const handleInsert = (targetScene: SceneItem, position: InsertPosition, data: NewSceneData) => {
    const newScene: SceneItem = {
      id: `s-${Date.now()}`,
      number: 0,
      cameraShot: (data.cameraAngle as any) || "WIDE SHOT",
      imageGenPrompt: data.description || "(AI generated)",
      motionPrompt: data.description || "(AI generated)",
      dialogue: data.voiceover || "",
      visualPrompt: "",
    };

    setSceneList((prev) => {
      const idx = prev.findIndex((s) => s.id === targetScene.id);
      const insertAt = position === "above" ? idx : idx + 1;
      const updated = [...prev.slice(0, insertAt), newScene, ...prev.slice(insertAt)];
      return updated.map((s, i) => ({ ...s, number: i + 1 }));
    });
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
      <BatchActionBar sceneCount={sceneList.length} />

      {/* Scrollable table */}
      <div className="flex-1 overflow-auto v-scrollbar">
        <table className="w-full border-collapse text-sm">
          {/* Sticky header */}
          <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200 w-5 ">
                {t("Cảnh")}
              </th>
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
            </tr>
          </thead>

          <tbody>
            {sceneList.map((scene, index) => (
              <SceneRowGroup
                key={scene.id}
                scene={scene}
                index={index}
                characters={characters}
                onInsert={handleInsert}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
