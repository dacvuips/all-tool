import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiPlus,
  HiShare,
  HiSparkles,
  HiTemplate,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import FilmPropCard from "./film-prop-card";
import {
  FilmPropCategory,
  FilmPropRecord,
  filmPropCategoryLabel,
} from "./film-types";
import { FilmProductionTab } from "./film-character-images-panel";

type Props = {
  props: FilmPropRecord[];
  onPropsChange: (next: FilmPropRecord[]) => void;
  onSaveProp: (p: FilmPropRecord) => Promise<void>;
  onExtractProps: () => Promise<void>;
  onBulkCreate: () => Promise<void>;
  onAddProp: () => Promise<void>;
  onTabNavigate?: (tab: FilmProductionTab) => void;
};

const TABS: { id: FilmProductionTab; label: string }[] = [
  { id: "extract_characters", label: "Trích xuất Nhân vật Cảnh" },
  { id: "character_images", label: "Hình ảnh Nhân vật" },
  { id: "props", label: "Vật phẩm" },
  { id: "scene_images", label: "Ảnh Cảnh" },
];

const CATEGORY_OPTIONS: { value: FilmPropCategory; label: string }[] = [
  { value: "weapon", label: "Weapon" },
  { value: "container", label: "Container" },
  { value: "prop", label: "prop" },
  { value: "clothing", label: "Clothing" },
  { value: "other", label: "Other" },
];

export default function FilmPropsPanel({
  props,
  onPropsChange,
  onSaveProp,
  onExtractProps,
  onBulkCreate,
  onAddProp,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmProductionTab>("props");
  const [busy, setBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<FilmPropRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string>("prop");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditCategory(editTarget.category || "prop");
    setEditDesc(editTarget.description || "");
  }, [editTarget]);

  const pendingCount = props.filter(
    (p) => p.status !== "created" && !(p.imageUrls?.length || p.imageUrl)
  ).length;
  const allDone = props.length > 0 && pendingCount === 0;

  const handleTab = (id: FilmProductionTab) => {
    setTab(id);
    if (id !== "props") onTabNavigate?.(id);
  };

  const simulateCreate = async (p: FilmPropRecord) => {
    const updated: FilmPropRecord = {
      ...p,
      status: "created",
      updatedAt: new Date().toISOString(),
    };
    onPropsChange(props.map((x) => (x.id === updated.id ? updated : x)));
    await onSaveProp(updated);
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

  const handleAdd = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAddProp();
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const updated: FilmPropRecord = {
      ...editTarget,
      name: editName.trim() || editTarget.name,
      category: editCategory,
      description: editDesc,
      updatedAt: new Date().toISOString(),
    };
    onPropsChange(props.map((x) => (x.id === updated.id ? updated : x)));
    await onSaveProp(updated);
    setEditTarget(null);
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3 relative">
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

      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <HiVideoCamera className="text-lg text-gray-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 m-0">{t("Bảng sản xuất")}</h2>
              <p className="text-xs text-gray-400 m-0 mt-0.5">
                {props.length} {t("Vật phẩm cần Tạo hình")}
                {" · "}
                <span className={allDone ? "text-green-600" : "text-blue-600"}>
                  {allDone ? t("Đã cấu hình") : t("Chưa cấu hình")}
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              outline
              small
              text={t("Tạo hàng loạt")}
              icon={<HiTemplate />}
              className="!rounded-lg"
              onClick={handleBulk}
              isLoading={busy}
              disabled={!props.length}
            />
            <Button
              primary
              small
              text={t("Thêm vật phẩm")}
              icon={<HiPlus />}
              className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
              onClick={handleAdd}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {props.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-3">
              <p className="text-sm text-gray-500 m-0">
                {t("Chưa có vật phẩm. Trích xuất từ storyboard hoặc thêm thủ công.")}
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button
                  outline
                  text={t("Trích xuất từ cảnh")}
                  icon={<HiSparkles />}
                  className="!rounded-lg"
                  onClick={onExtractProps}
                />
                <Button
                  primary
                  text={t("Thêm vật phẩm")}
                  icon={<HiPlus />}
                  className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
                  onClick={handleAdd}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {props.map((p) => (
                <FilmPropCard
                  key={p.id}
                  prop={p}
                  onEdit={setEditTarget}
                  onCreate={simulateCreate}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-gray-50 flex items-center justify-end gap-0.5">
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbUp />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiThumbDown />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiAnnotation />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiShare />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiSparkles />
          </button>
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer"
          >
            <HiDotsVertical />
          </button>
        </div>
      </div>

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
            <h3 className="text-base font-bold text-gray-900 m-0 mb-4">{t("Sửa vật phẩm")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Tên")}</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("Danh mục")}
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {filmPropCategoryLabel(o.value)}
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
