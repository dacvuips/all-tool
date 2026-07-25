import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlinePhotograph, HiOutlinePlus, HiOutlineX, HiUser } from "react-icons/hi";
import {
  RiDeleteBinLine,
  RiDownload2Line,
  RiLandscapeLine,
  RiRobotLine,
  RiSave3Line,
  RiUpload2Line,
  RiUserAddLine,
} from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import {
  CharacterPose,
  CharacterProfile,
  buildCharacterAutoPrompt,
  createEmptyCharacterProfile,
  createEmptyCharacterScene,
} from "../types";

interface CharacterProfileManagerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: CharacterProfile[];
  selectedId: string;
  onChange: (profiles: CharacterProfile[], selectedId: string) => void;
}

const POSE_LABELS: Record<CharacterPose, string> = {
  standing: "Đứng",
  sitting: "Ngồi",
  fashion: "Fashion",
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function CharacterProfileManagerDialog({
  isOpen,
  onClose,
  profiles,
  selectedId,
  onChange,
}: CharacterProfileManagerDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const importRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingPoseRef = useRef<CharacterPose>("fashion");

  const [list, setList] = useState<CharacterProfile[]>([]);
  const [activeId, setActiveId] = useState("");
  const [draft, setDraft] = useState<CharacterProfile | null>(null);
  const [tabIndex, setTabIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const nextList =
      profiles.length > 0
        ? profiles.map((p) => ({
            ...p,
            scenes: p.scenes?.length ? p.scenes : [createEmptyCharacterScene(1)],
          }))
        : [createEmptyCharacterProfile({ name: "Ao Dai" })];
    const id = nextList.some((p) => p.id === selectedId) ? selectedId : nextList[0].id;
    setList(nextList);
    setActiveId(id);
    setDraft({ ...nextList.find((p) => p.id === id)! });
    setTabIndex(0);
  }, [isOpen, profiles, selectedId]);

  const selectProfile = (id: string) => {
    const synced = draft ? list.map((p) => (p.id === draft.id ? { ...draft } : p)) : list;
    setList(synced);
    const current = synced.find((p) => p.id === id);
    if (!current) return;
    setActiveId(id);
    setDraft({ ...current });
    setTabIndex(0);
  };

  const patchDraft = (partial: Partial<CharacterProfile>) => {
    setDraft((d) => (d ? { ...d, ...partial } : d));
  };

  const handleCreate = () => {
    const created = createEmptyCharacterProfile({
      name: `Profile ${list.length + 1}`,
    });
    setList((prev) => {
      const synced = draft ? prev.map((p) => (p.id === draft.id ? { ...draft } : p)) : prev;
      return [...synced, created];
    });
    setActiveId(created.id);
    setDraft(created);
    setTabIndex(0);
  };

  const handleDeleteProfile = () => {
    if (!draft) return;
    if (list.length <= 1) {
      toast.warn(t("Cần giữ ít nhất 1 profile"));
      return;
    }
    if (!confirm(t("Xóa profile {{name}}?", { name: draft.name }))) return;
    const next = list.filter((p) => p.id !== draft.id);
    setList(next);
    setActiveId(next[0].id);
    setDraft({ ...next[0] });
    setTabIndex(0);
    toast.success(t("Đã xóa profile"));
  };

  const handleExport = () => {
    const synced = draft ? list.map((p) => (p.id === draft.id ? draft : p)) : list;
    const blob = new Blob([JSON.stringify(synced, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `character-profiles-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("Đã export profiles"));
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const imported = arr.map((item: any) =>
        createEmptyCharacterProfile({
          id: item.id || crypto.randomUUID(),
          name: item.name || "Imported",
          characterName: item.characterName || "",
          characterSummary: item.characterSummary || item.characterPrompt || item.content || "",
          appearanceDetails: item.appearanceDetails || "",
          audioVoice: item.audioVoice || "",
          backgroundSound:
            item.backgroundSound || "Natural ambient sound appropriate for the scene.",
          scenes: item.scenes?.length > 0 ? item.scenes : [createEmptyCharacterScene(1)],
          images: {
            standing: item.images?.standing || "",
            sitting: item.images?.sitting || "",
            fashion: item.images?.fashion || "",
          },
          previewPose: item.previewPose || "fashion",
        })
      );
      if (!imported.length) {
        toast.warn(t("File không có profile"));
        return;
      }
      setList(imported);
      setActiveId(imported[0].id);
      setDraft(imported[0]);
      setTabIndex(0);
      toast.success(t("Đã import {{count}} profile", { count: imported.length }));
    } catch {
      toast.error(t("File profile không hợp lệ"));
    }
  };

  const handleAddScene = () => {
    if (!draft) return;
    const scene = createEmptyCharacterScene(draft.scenes.length + 1);
    patchDraft({ scenes: [...draft.scenes, scene] });
    setTabIndex(draft.scenes.length + 1);
  };

  const handleDeleteScene = () => {
    if (!draft || tabIndex === 0) return;
    if (draft.scenes.length <= 1) {
      toast.warn(t("Cần giữ ít nhất 1 bối cảnh"));
      return;
    }
    const sceneIdx = tabIndex - 1;
    const nextScenes = draft.scenes.filter((_, i) => i !== sceneIdx);
    patchDraft({ scenes: nextScenes });
    setTabIndex(Math.max(0, tabIndex - 1));
    toast.success(t("Đã xóa bối cảnh"));
  };

  const updateSceneContent = (sceneIdx: number, content: string) => {
    if (!draft) return;
    const scenes = draft.scenes.map((s, i) => (i === sceneIdx ? { ...s, content } : s));
    patchDraft({ scenes });
  };

  const pickImage = (pose: CharacterPose) => {
    pendingPoseRef.current = pose;
    imageInputRef.current?.click();
  };

  const onImageSelected = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const pose = pendingPoseRef.current;
      if (!draft) return;
      patchDraft({
        images: { ...draft.images, [pose]: dataUrl },
        previewPose: pose,
      });
      toast.success(t("Đã chọn ảnh {{pose}}", { pose: POSE_LABELS[pose] }));
    } catch {
      toast.error(t("Không đọc được ảnh"));
    }
  };

  const handleAutoPrompt = () => {
    if (!draft) return;
    const prompt = buildCharacterAutoPrompt(draft);
    if (!prompt.trim()) {
      toast.warn(t("Chưa có nội dung để tạo prompt"));
      return;
    }
    patchDraft({ characterSummary: prompt });
    setTabIndex(0);
    toast.success(t("Đã tạo prompt tự động từ mô tả & bối cảnh"));
  };

  const handleSaveProfile = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.warn(t("Nhập tên profile"));
      return;
    }
    const next = list.map((p) => (p.id === draft.id ? { ...draft } : p));
    if (!next.some((p) => p.id === draft.id)) next.push({ ...draft });
    setList(next);
    onChange(next, draft.id);
    toast.success(t("Đã lưu profile"));
  };

  const handleSaveAndClose = () => {
    if (!draft) {
      onClose();
      return;
    }
    const next = list.map((p) => (p.id === draft.id ? { ...draft } : p));
    if (!next.some((p) => p.id === draft.id)) next.push({ ...draft });
    onChange(next, draft.id);
    onClose();
  };

  const previewUrl = useMemo(() => {
    if (!draft) return "";
    return draft.images[draft.previewPose] || "";
  }, [draft]);

  const imageCount = draft
    ? (["standing", "sitting", "fashion"] as CharacterPose[]).filter((p) => draft.images[p]).length
    : 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleSaveAndClose}
      hasCloseIcon={false}
      width="1120px"
      maxWidth="96vw"
      slideFromBottom="none"
      wrapperClass="fixed w-full h-screen top-0 left-0 z-100 flex items-center justify-center overflow-hidden p-4"
      dialogClass="relative bg-white shadow-xl rounded-2xl m-auto overflow-hidden"
      headerClass="relative flex items-center px-5 py-3.5 bg-white border-b border-gray-100 z-10"
      bodyClass="relative p-0 bg-gray-50"
    >
      <Dialog.Header>
        <div className="flex flex-1 items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ background: "linear-gradient(135deg, #F2890D, #C26E0B)" }}
          >
            <HiUser className="text-xl" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-gray-900">
              {t("Quản lý Nhân Vật")}
            </div>
            <div className="mt-0.5 text-10 text-gray-500">
              {t("{{count}} profile · {{images}} ảnh đã gắn", {
                count: list.length,
                images: imageCount,
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSaveAndClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <HiOutlineX className="text-lg" />
        </button>
      </Dialog.Header>

      <Dialog.Body>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImport(f);
            e.target.value = "";
          }}
        />
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImageSelected(f);
            e.target.value = "";
          }}
        />

        <div className="flex" style={{ height: "min(78vh, 700px)" }}>
          {/* Sidebar */}
          <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                {t("Profiles Đã Lưu")}
              </span>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-10 font-bold text-primary-dark">
                {list.length}
              </span>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {list.map((p) => {
                const isActive = p.id === activeId;
                const thumb = p.images.fashion || p.images.standing || p.images.sitting || "";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectProfile(p.id)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-all ${
                      isActive
                        ? "bg-primary text-white shadow-md"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg ${
                        isActive ? "bg-white bg-opacity-20" : "bg-gray-100"
                      }`}
                    >
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <HiUser
                          className={`text-base ${isActive ? "text-white" : "text-gray-400"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">
                        {p.name || t("Chưa đặt tên")}
                      </div>
                      <div
                        className={`truncate text-10 ${
                          isActive ? "text-white text-opacity-80" : "text-gray-400"
                        }`}
                      >
                        {p.scenes?.length || 0} {t("bối cảnh")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2 border-t border-gray-100 p-2.5">
              <button
                type="button"
                onClick={handleCreate}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-2 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary-dark"
              >
                <RiUserAddLine />
                {t("Tạo Mới")}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <RiUpload2Line />
                  {t("Import")}
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <RiDownload2Line />
                  {t("Export")}
                </button>
              </div>
              <button
                type="button"
                onClick={handleDeleteProfile}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-rose-50 px-2 py-2 text-xs font-bold text-rose-600 hover:bg-rose-100"
              >
                <RiDeleteBinLine />
                {t("Xóa Profile")}
              </button>
            </div>
          </aside>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            {draft && (
              <>
                <div className="border-b border-gray-100 bg-white px-5 py-3">
                  <label className="mb-1.5 block text-xs font-semibold text-gray-500">
                    {t("Tên Profile")}{" "}
                    <span className="font-normal text-gray-400">({t("Tên folder & file")})</span>
                  </label>
                  <input
                    value={draft.name}
                    onChange={(e) => patchDraft({ name: e.target.value })}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 text-sm font-medium text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                    placeholder={t("Nhập tên profile...")}
                  />
                </div>

                <div className="flex min-h-0 flex-1">
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white px-5 pt-2">
                    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                      <button
                        type="button"
                        onClick={handleAddScene}
                        className="absolute right-0 top-1.5 z-20 inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-primary border-opacity-40 bg-primary-light px-2.5 py-1.5 text-xs font-semibold text-primary-dark hover:bg-primary hover:bg-opacity-10"
                      >
                        <HiOutlinePlus />
                        {t("Thêm")}
                      </button>
                      <TabGroup
                        index={tabIndex}
                        onChange={setTabIndex}
                        name="character-profile-tabs"
                        flex={false}
                        tabClassName="px-3 py-2.5"
                        titleClassName="text-xs font-semibold whitespace-nowrap"
                        bodyClassName="pt-4 pb-3 pr-1 overflow-y-auto overscroll-contain"
                        bodyStyle={{ maxHeight: "calc(min(78vh, 700px) - 360px)" }}
                        className="min-w-0 pr-20"
                      >
                        <TabGroup.Tab
                          label={
                            <span className="inline-flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-violet-100 text-violet-600">
                                <HiUser className="text-xs" />
                              </span>
                              {t("Nhân Vật")}
                            </span>
                          }
                        >
                          <div className="space-y-3">
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">
                                {t("Character Name")}
                              </label>
                              <input
                                value={draft.characterName}
                                onChange={(e) => patchDraft({ characterName: e.target.value })}
                                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder={t("Tên nhân vật...")}
                                autoFocus
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">
                                {t("Character Summary")}
                              </label>
                              <textarea
                                value={draft.characterSummary}
                                onChange={(e) => patchDraft({ characterSummary: e.target.value })}
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder={t("Mô tả nhân vật...")}
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">
                                {t("Appearance Details")}
                              </label>
                              <textarea
                                value={draft.appearanceDetails}
                                onChange={(e) => patchDraft({ appearanceDetails: e.target.value })}
                                rows={5}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder={t("Chi tiết ngoại hình...")}
                              />
                            </div>

                            <div>
                              <div className="mb-1 text-xs font-bold text-gray-800 underline">
                                {t("Audio & Voice")}
                              </div>
                              <div className="mb-1.5 text-10 text-gray-400">
                                ({t("Mỗi dòng là 1 mô tả giọng nói/âm thanh")})
                              </div>
                              <textarea
                                value={draft.audioVoice}
                                onChange={(e) => patchDraft({ audioVoice: e.target.value })}
                                rows={4}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder={t("Mô tả giọng nói / âm thanh...")}
                              />
                            </div>

                            <div>
                              <label className="mb-1 block text-xs font-semibold text-gray-700">
                                {t("Background Sound")}
                              </label>
                              <input
                                value={draft.backgroundSound}
                                onChange={(e) => patchDraft({ backgroundSound: e.target.value })}
                                className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder="Natural ambient sound appropriate for the scene."
                              />
                            </div>
                          </div>
                        </TabGroup.Tab>

                        {draft.scenes.map((scene, idx) => (
                          <TabGroup.Tab
                            key={scene.id}
                            label={
                              <span className="inline-flex items-center gap-1.5">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                                  <RiLandscapeLine className="text-xs" />
                                </span>
                                {scene.name || `${t("Bối Cảnh")} ${idx + 1}`}
                              </span>
                            }
                          >
                            <div className="space-y-2.5">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-bold text-gray-800">
                                    {t("Environment & Atmosphere")}
                                  </div>
                                  <div className="text-10 text-gray-400">
                                    ({t("Mỗi dòng là 1 mô tả bối cảnh")})
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={handleDeleteScene}
                                  disabled={draft.scenes.length <= 1}
                                  className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  title={t("Xóa Bối Cảnh")}
                                >
                                  <RiDeleteBinLine />
                                  {t("Xóa Bối Cảnh")}
                                </button>
                              </div>
                              <textarea
                                value={scene.content}
                                onChange={(e) => updateSceneContent(idx, e.target.value)}
                                rows={11}
                                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm leading-relaxed text-gray-800 outline-none transition-colors focus:border-primary focus:bg-white"
                                placeholder={t("Mô tả bối cảnh...")}
                              />
                            </div>
                          </TabGroup.Tab>
                        ))}
                      </TabGroup>
                    </div>

                    <div className="shrink-0 border-t border-gray-100 py-3">
                      <div className="mb-2 text-10 font-bold uppercase tracking-wide text-gray-400">
                        {t("Ảnh Model")}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(["standing", "sitting", "fashion"] as CharacterPose[]).map((pose) => {
                          const has = !!draft.images[pose];
                          return (
                            <button
                              key={pose}
                              type="button"
                              onClick={() => pickImage(pose)}
                              className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center transition-all ${
                                has
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-gray-200 bg-gray-50 text-gray-600 hover:border-primary hover:bg-primary-light"
                              }`}
                            >
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
                                {has ? (
                                  <img
                                    src={draft.images[pose]}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <HiOutlinePhotograph className="text-lg text-gray-300" />
                                )}
                              </div>
                              <span className="text-10 font-semibold leading-tight">
                                {has
                                  ? t("{{pose}} · Sửa", { pose: POSE_LABELS[pose] })
                                  : t("Model {{pose}}", { pose: POSE_LABELS[pose] })}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Preview */}
                  <aside className="flex w-60 shrink-0 flex-col border-l border-gray-200 bg-gray-50 p-3">
                    <div className="mb-2.5 inline-flex rounded-xl bg-white p-1 shadow-sm border border-gray-100">
                      {(["standing", "sitting", "fashion"] as CharacterPose[]).map((pose) => (
                        <button
                          key={pose}
                          type="button"
                          onClick={() => patchDraft({ previewPose: pose })}
                          className={`flex-1 rounded-lg px-2 py-1.5 text-10 font-bold transition-all ${
                            draft.previewPose === pose
                              ? "bg-primary text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-700"
                          }`}
                        >
                          {POSE_LABELS[pose]}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-inner">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={draft.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-6 text-center">
                          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                            <HiOutlinePhotograph className="text-2xl text-gray-300" />
                          </div>
                          <div className="text-xs font-medium text-gray-400">
                            {t("Chưa có ảnh preview")}
                          </div>
                          <button
                            type="button"
                            onClick={() => pickImage(draft.previewPose)}
                            className="text-10 font-semibold text-primary hover:underline"
                          >
                            {t("Chọn ảnh ngay")}
                          </button>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-5 py-3">
                  <button
                    type="button"
                    onClick={handleAutoPrompt}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-sm hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #0EA5E9, #0284C7)" }}
                  >
                    <RiRobotLine />
                    {t("Tạo Prompt Tự Động")}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    <RiSave3Line />
                    {t("Lưu Profile")}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={handleSaveAndClose}
                    className="inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary-dark"
                  >
                    {t("Xong")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
