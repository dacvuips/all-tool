import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiPencil,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import FilmCharacterCard from "./film-character-card";
import { FilmCharacterRecord, FilmCharacterRole, filmCharacterRoleLabel } from "./film-types";
import { Dialog } from "../shared/utilities/dialog/dialog";

export type FilmProductionTab =
  | "extract_characters"
  | "character_images"
  | "props"
  | "scene_images";

type Props = {
  characters: FilmCharacterRecord[];
  onCharactersChange: (next: FilmCharacterRecord[]) => void;
  onSaveCharacter: (c: FilmCharacterRecord) => Promise<void>;
  onExtractCharacters: () => Promise<void>;
  onBulkCreate: () => Promise<void>;
  onTabNavigate?: (tab: FilmProductionTab) => void;
};

const TABS: { id: FilmProductionTab; label: string }[] = [
  { id: "extract_characters", label: "Trích xuất Nhân vật Cảnh" },
  { id: "character_images", label: "Hình ảnh Nhân vật" },
  { id: "props", label: "Vật phẩm" },
  { id: "scene_images", label: "Ảnh Cảnh" },
];

const ROLE_OPTIONS: { value: FilmCharacterRole; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "extra", label: "Extra" },
];

export default function FilmCharacterImagesPanel({
  characters,
  onCharactersChange,
  onSaveCharacter,
  onExtractCharacters,
  onBulkCreate,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmProductionTab>("character_images");
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<FilmCharacterRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("supporting");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditRole(editTarget.role || "supporting");
    setEditDesc(editTarget.description || "");
  }, [editTarget]);

  const pendingCount = characters.filter(
    (c) => c.status !== "created" && !(c.imageUrls?.length || c.imageUrl)
  ).length;
  const allDone = characters.length > 0 && pendingCount === 0;

  const handleTab = (id: FilmProductionTab) => {
    setTab(id);
    if (id === "props" || id === "scene_images") {
      onTabNavigate?.(id);
    }
  };

  const simulateCreate = async (c: FilmCharacterRecord) => {
    const updated: FilmCharacterRecord = {
      ...c,
      status: "created",
      updatedAt: new Date().toISOString(),
    };
    onCharactersChange(characters.map((x) => (x.id === updated.id ? updated : x)));
    await onSaveCharacter(updated);
  };

  const handleBulk = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onBulkCreate();
    } finally {
      setBusy(false);
    }
  };

  const handleExtract = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onExtractCharacters();
      setTab("character_images");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const updated: FilmCharacterRecord = {
      ...editTarget,
      name: editName.trim() || editTarget.name,
      role: editRole,
      description: editDesc,
      updatedAt: new Date().toISOString(),
    };
    onCharactersChange(characters.map((x) => (x.id === updated.id ? updated : x)));
    await onSaveCharacter(updated);
    setEditTarget(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 relative">
      {/* Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleTab(item.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                active
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
              {t(item.label)}
            </button>
          );
        })}
      </div>

      {tab === "extract_characters" ? (
        <div className="flex-1 min-h-sm bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center px-6 gap-4">
          <p className="text-base font-semibold text-gray-800 m-0">
            {t("Trích xuất nhân vật từ storyboard / nội dung")}
          </p>
          <p className="text-sm text-gray-400 m-0 max-w-md">
            {t("Hệ thống sẽ quét tên nhân vật từ các cảnh quay và nội dung gốc để tạo danh sách tạo hình.")}
          </p>
          <Button
            primary
            text={t("Trích xuất ngay")}
            icon={<HiSparkles />}
            className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
            onClick={handleExtract}
            isLoading={busy}
          />
        </div>
      ) : tab === "character_images" ? (
        <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="px-4 sm:px-5 py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <HiVideoCamera className="text-lg text-gray-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 m-0">{t("Bảng sản xuất")}</h2>
                <p className="text-xs text-gray-400 m-0 mt-0.5">
                  {characters.length} {t("Nhân vật cần Tạo hình")}
                  {" · "}
                  {allDone ? t("Đã cấu hình") : t("Chưa cấu hình")}
                </p>
              </div>
            </div>
            <Button
              primary
              small
              text={t("Tạo hàng loạt")}
              className="!rounded-lg !bg-blue-600 hover:!bg-blue-700 flex-shrink-0"
              onClick={handleBulk}
              isLoading={busy}
              disabled={!characters.length}
            />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {characters.length === 0 ? (
              <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-gray-500 m-0">
                  {t("Chưa có nhân vật. Hãy trích xuất từ storyboard.")}
                </p>
                <Button
                  outline
                  text={t("Trích xuất Nhân vật")}
                  icon={<HiSparkles />}
                  className="!rounded-lg"
                  onClick={handleExtract}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {characters.map((c) => (
                  <FilmCharacterCard
                    key={c.id}
                    character={c}
                    onEdit={setEditTarget}
                    onCreate={simulateCreate}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer toolbar */}
          <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end gap-0.5">
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiThumbUp />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiThumbDown />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiAnnotation />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiShare />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiSparkles />
            </button>
            <button
              type="button"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 border-0 bg-transparent cursor-pointer"
            >
              <HiDotsVertical />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-sm bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center text-sm text-gray-400">
          {t("Tính năng đang phát triển")}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        width={440}
        maxWidth="94vw"
        slideFromBottom="none"
        dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-xl"
        bodyClass="relative bg-white"
        hasCloseIcon={false}
      >
        <Dialog.Body>
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <HiPencil className="text-blue-600" />
              <h3 className="text-base font-bold text-gray-900 m-0">{t("Sửa nhân vật")}</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("Tên")}
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("Vai trò")}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {filmCharacterRoleLabel(o.value)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("Mô tả")}
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button outline text={t("Hủy")} className="!rounded-xl" onClick={() => setEditTarget(null)} />
              <Button
                primary
                text={t("Lưu")}
                className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
                onClick={saveEdit}
              />
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
