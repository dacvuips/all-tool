/**
 * batch-list.tsx
 * Batch List Panel – danh sách scene dạng bảng
 * className only – Tailwind CSS, no inline styles
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import {
  RiAddLine,
  RiCloseLine,
  RiImageAddFill,
  RiImageFill,
  RiLoader4Line,
  RiMagicFill,
  RiText,
  RiVideoFill,
} from "react-icons/ri";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Button } from "../../../../shared/utilities/form";
import { CACHE_KEY, CharacterItem, CopyVideoScene, DB_NAME, STORE_NAME } from "../../constants";

import { NoTextIcon } from "../../../../../public/assets/svg/no-text-icon";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { useCopyVideoApi } from "../hook/useCopyVideoApi";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { BatchActionBar } from "./batch-action-bar";
import { EditField, SceneRowGroup } from "./scene-batch-row";

type InsertPosition = "above" | "below";

interface NewSceneData {
  description: string;
  voiceover: string;
  cameraAngle: string;
  selectedCharacters: string[];
  audio: string;
}

interface AddSceneModalProps {
  targetScene: CopyVideoScene;
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
  const { CAMERA_ANGLES } = useOptionsTranslation();
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
      ? `↑ Chèn phía trên Scene #${targetScene.id}`
      : `↓ Chèn phía dưới Scene #${targetScene.id}`;

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
  scene: CopyVideoScene;
  position: InsertPosition;
  characters: CharacterItem[];
  onInsert: (
    scene: CopyVideoScene,
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

interface BatchListPanelProps {
  scenes: CopyVideoScene[];
  characters: CharacterItem[];
}

export function BatchListPanel({ scenes, characters }: BatchListPanelProps) {
  const { t } = useTranslation();
  const [sceneList, setSceneList] = useState<CopyVideoScene[]>(scenes);
  const { scriptData, updateScriptData, selectedHistoryId } = useCopyVideoContext();
  // Sync local sceneList when parent scenes prop changes (e.g. switching history items)
  useEffect(() => {
    setSceneList(scenes);
  }, [scenes]);

  const db = useIndexedDB<any>(STORE_NAME.copyVideo, DB_NAME.copyVideo);
  const { insertScene } = useCopyVideoApi();

  /** Toggle disabled state on a scene and persist to IndexedDB */
  const handleToggleDisable = async (sceneId: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, disabled: !s.disabled } : s));
    // 1. Update UI immediately – do NOT call setScriptData to avoid
    //    triggering a parent re-render that would overwrite local state
    setSceneList(updated);
    // 2. Persist to IndexedDB by reading current record then merging
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updated as any,
      });
    } catch (err) {
      console.error("[handleToggleDisable] Failed to persist to IndexedDB:", err);
    }
  };

  /** Toggle voiceDisable state on a single scene and persist to IndexedDB */
  const handleToggleVoiceDisable = async (sceneId: string) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, voiceDisable: !s.voiceDisable } : s
    );
    setSceneList(updated);
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updated as any,
      });
    } catch (err) {
      console.error("[handleToggleVoiceDisable] Failed to persist to IndexedDB:", err);
    }
  };

  /** Toggle voiceDisable for ALL scenes at once */
  const handleToggleAllVoiceDisable = async () => {
    const allDisabled = sceneList.every((s) => s.voiceDisable);
    const updated = sceneList.map((s) => ({ ...s, voiceDisable: !allDisabled }));
    setSceneList(updated);
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updated as any,
      });
    } catch (err) {
      console.error("[handleToggleAllVoiceDisable] Failed to persist to IndexedDB:", err);
    }
  };

  /** Toggle noText state on a single scene and persist to IndexedDB */
  const handleToggleNoText = async (sceneId: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, noText: !s.noText } : s));
    setSceneList(updated);
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updated as any,
      });
    } catch (err) {
      console.error("[handleToggleNoText] Failed to persist to IndexedDB:", err);
    }
  };

  /** Toggle noText for ALL scenes at once */
  const handleToggleAllNoText = async () => {
    const allDisabled = sceneList.every((s) => s.noText);
    const updated = sceneList.map((s) => ({ ...s, noText: !allDisabled }));
    setSceneList(updated);
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updated as any,
      });
    } catch (err) {
      console.error("[handleToggleAllNoText] Failed to persist to IndexedDB:", err);
    }
  };

  const handleInsert = async (
    targetScene: CopyVideoScene,
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
              cast: scriptData.characters?.map((c, idx) => ({
                name: c.name,
                tag: idx === 0 ? "main" : "supporting",
                description: c.description || "",
              })),
            }
          : undefined,
      });

      // Build CopyVideoScene from API result
      const newScene = {
        id: crypto.randomUUID(),
        timestamp: "00:00",
        scene_type: "CHARACTER" as const,
        visual_prompt: result?.visualPrompt || data.description || "(AI generated)",
        motion_description: result?.motionPrompt || data.description || "(AI generated)",
        original_content: result?.dialogue || data.voiceover || "",
        audio_description: result?.audio || data.audio || "",
      };

      // Insert into list and re-number
      const updated = [...sceneList.slice(0, insertAt), newScene, ...sceneList.slice(insertAt)].map(
        (s, i) => ({ ...s, sceneNumber: i + 1 })
      );

      setSceneList(updated as CopyVideoScene[]);

      // Persist to IndexedDB
      try {
        const current = await db.get(CACHE_KEY.lastCopyVideoScript);
        const merged = { ...(current ?? scriptData), scenes: updated as any };
        await db.set(CACHE_KEY.lastCopyVideoScript, merged);
        updateScriptData?.(merged as any);
      } catch (err) {
        console.error("[handleInsert] Failed to persist to IndexedDB:", err);
      }
    } catch (err) {
      console.error("[handleInsert] API error:", err);
      // Fallback: insert scene với dữ liệu từ modal (không có AI)
      const fallbackScene = {
        id: crypto.randomUUID(),
        timestamp: "00:00",
        scene_type: "CHARACTER" as const,
        visual_prompt: data.description || "(AI generated)",
        motion_description: data.description || "(AI generated)",
        original_content: data.voiceover || "",
        audio_description: data.audio || "",
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
      await db.set(CACHE_KEY.lastCopyVideoScript, { ...scriptData, scenes: updated as any });
      updateScriptData?.({ ...scriptData, scenes: updated as any });
    } catch (err) {
      console.error("[handleUpdateScene] Failed to persist to IndexedDB:", err);
    }
  };

  /** Update selectedProductImages for a single scene and persist to IndexedDB */
  const handleUpdateSelectedProductImages = async (sceneId: string, images: string[]) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, selectedProductImages: images } : s
    );
    setSceneList(updated);

    try {
      // 1. Persist to lastCopyVideoScript
      const mergedScript = { ...(scriptData ?? {}), scenes: updated as any };
      await db.set(CACHE_KEY.lastCopyVideoScript, mergedScript);

      // 2. Also update the selected history item in copyVideoHistory
      if (selectedHistoryId) {
        const history: any[] = (await db.get(CACHE_KEY.copyVideoHistory)) || [];
        const updatedHistory = history.map((item: any) =>
          item.id === selectedHistoryId
            ? { ...item, data: { ...item.data, scenes: updated as any } }
            : item
        );
        await db.set(CACHE_KEY.copyVideoHistory, updatedHistory);
      }
    } catch (err) {
      console.error("[handleUpdateSelectedProductImages] Failed to persist to IndexedDB:", err);
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
          <thead className="bg-gray-50 sticky top-0 z-20 shadow-sm">
            <tr>
              <th className="text-left py-2.5 px-3 text-xs font-bold text-teal uppercase tracking-wide border-b border-gray-200 w-32">
                <div className="flex items-center gap-1">
                  <RiVideoFill className="text-xs" />
                  {t("PROMPT")}
                </div>
              </th>
              {
                <th className="text-center py-2.5 px-3 text-xs font-bold text-purple-600 uppercase tracking-wide border-b border-gray-200">
                  {t("HÌNH ẢNH")}
                </th>
              }
              <th className="text-center py-2.5 px-3 text-xs font-bold text-indigo-600 uppercase tracking-wide border-b border-gray-200">
                {t("VIDEO")}
              </th>
              <th className="border-b border-gray-200 w-0 p-0">
                <div className="flex flex-col gap-1 items-center justify-center">
                  <Button
                    onClick={handleToggleAllNoText}
                    className={`w-6 h-6 rounded-md shadow-sm ${
                      sceneList.every((s) => s.noText)
                        ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
                        : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
                    }`}
                    iconClassName="text-sm"
                    icon={sceneList.every((s) => s.noText) ? <RiText /> : <NoTextIcon />}
                    tooltip={
                      sceneList.every((s) => s.noText)
                        ? t("Đang cho phép hiển thị 'text' trong tất cả")
                        : t("Không cho phép hiển thị 'text' trong tất cả")
                    }
                    placement="bottom"
                  />
                  <Button
                    onClick={handleToggleAllVoiceDisable}
                    className={`w-6 h-6 rounded-md shadow-sm ${
                      sceneList.every((s) => s.voiceDisable)
                        ? "text-red-500 bg-red-50 hover:bg-red-100"
                        : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
                    }`}
                    iconClassName="text-sm"
                    icon={
                      sceneList.every((s) => s.voiceDisable) ? (
                        <MdVoiceOverOff />
                      ) : (
                        <MdRecordVoiceOver />
                      )
                    }
                    tooltip={
                      sceneList.every((s) => s.voiceDisable)
                        ? t("Bật thoại tất cả")
                        : t("Tắt thoại tất cả")
                    }
                    placement="bottom"
                  />
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sceneList.map((scene, index) => (
              <SceneRowGroup
                key={`${selectedHistoryId || "default"}-${scene.id}`}
                scene={scene}
                index={index}
                nextSceneId={index < sceneList.length - 1 ? sceneList[index + 1].id : undefined}
                isDisabled={!!scene.disabled}
                characters={characters}
                onInsert={handleInsert}
                onUpdateScene={handleUpdateScene}
                onToggleDisable={handleToggleDisable}
                onToggleVoiceDisable={handleToggleVoiceDisable}
                onToggleNoText={handleToggleNoText}
                onUpdateSelectedProductImages={handleUpdateSelectedProductImages}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
