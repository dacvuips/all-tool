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
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import { FilmProductionTab } from "./film-character-images-panel";
import FilmEditDialogShell, {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_FOOTER_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
  FILM_EDIT_PROMPT_TEXTAREA_CLASS,
  FILM_EDIT_PROMPT_TEXTAREA_STYLE,
} from "./film-edit-dialog-shell";
import { useFilmEntityCardFocus } from "./film-entity-card-focus";
import { FILM_MEDIA_CARD_GRID_CLASS, FILM_MEDIA_CARD_GRID_PAD_CLASS } from "./film-media-card-grid";
import FilmPropCard from "./film-prop-card";
import { FilmCatalogPickDialog, type FilmCatalogKind, type FilmCatalogPickItem } from "./film-catalog-pick-dialog";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import { buildFilmPropImagePrompt } from "./film-prop-image-prompt";
import {
  FilmAspectRatio,
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmPropCategory,
  FilmPropRecord,
  FilmSceneImageRecord,
  filmPropCategoryLabel,
} from "./film-types";

type Props = {
  props: FilmPropRecord[];
  allPropsForLink?: FilmPropRecord[];
  episodes?: FilmEpisodeRecord[];
  aspectRatio?: FilmAspectRatio;
  /** Prompt mẫu Setting dự án */
  promptTemplate?: string | null;
  onPropsChange: (next: FilmPropRecord[]) => void;
  onSaveProp: (p: FilmPropRecord) => Promise<void>;
  onExtractProps: () => Promise<void>;
  onBulkCreate: () => Promise<void>;
  onAddProp: (name?: string) => Promise<void | FilmPropRecord | undefined>;
  onDeleteProp: (p: FilmPropRecord) => Promise<void>;
  onCloneProp?: (p: FilmPropRecord) => Promise<void | FilmPropRecord | undefined>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onCreatePropWithCompanionRefs?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onStopPropImage?: (p: FilmPropRecord) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onSetPropImage?: (p: FilmPropRecord, image: GeneratedImageData) => Promise<void>;
  onSuggestPropCompanions?: (p: FilmPropRecord) => Promise<void>;
  onAddPropCompanion?: (input: {
    prop: FilmPropRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  characters?: FilmCharacterRecord[];
  sceneImages?: FilmSceneImageRecord[];
  onLinkCatalogItems?: (
    prop: FilmPropRecord,
    items: FilmCatalogPickItem[]
  ) => Promise<void>;
  onMoveLinkedProp?: (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => void;
  onUnlinkLinkedProp?: (input: {
    kind: FilmCatalogKind;
    ownerId: string;
    propName: string;
  }) => void;
  onTabNavigate?: (tab: FilmProductionTab) => void;
  focusEntityId?: string | null;
  onFocusEntityConsumed?: () => void;
};

const TABS: { id: FilmProductionTab; label: string }[] = [
  { id: "extract_characters", label: "Trích xuất Nhân vật Cảnh" },
  { id: "character_images", label: "Nhân vật" },
  { id: "props", label: "Vật phẩm" },
  { id: "scene_images", label: "Bối cảnh" },
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
  allPropsForLink,
  episodes = [],
  aspectRatio = "16:9",
  promptTemplate,
  onPropsChange,
  onSaveProp,
  onExtractProps,
  onBulkCreate,
  onAddProp,
  onDeleteProp,
  onCloneProp,
  onCreatePropImage,
  onCreatePropWithCompanionRefs,
  onStopPropImage,
  stopPendingIds,
  onSetPropImage,
  onSuggestPropCompanions,
  onAddPropCompanion,
  characters = [],
  sceneImages = [],
  onLinkCatalogItems,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onTabNavigate,
  focusEntityId = null,
  onFocusEntityConsumed,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmProductionTab>("props");
  const [busy, setBusy] = useState(false);

  useFilmEntityCardFocus(focusEntityId, onFocusEntityConsumed);

  useEffect(() => {
    if (focusEntityId) setTab("props");
  }, [focusEntityId]);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<FilmPropRecord | null>(null);
  const [catalogOwner, setCatalogOwner] = useState<FilmPropRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string>("prop");
  const [editDesc, setEditDesc] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editEpisodeIds, setEditEpisodeIds] = useState<string[]>([]);

  const pool = allPropsForLink || props;

  const resolveLinkedProps = (p: FilmPropRecord): FilmPropRecord[] => {
    const names = (p.propNames || []).map((n) => n.trim()).filter(Boolean);
    if (!names.length) return [];
    const byKey = new Map(pool.map((x) => [x.name.trim().toLowerCase(), x]));
    const out: FilmPropRecord[] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k) || k === p.name.trim().toLowerCase()) continue;
      seen.add(k);
      const hit = byKey.get(k);
      if (hit) out.push(hit);
    }
    return out;
  };

  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditCategory(editTarget.category || "prop");
    setEditDesc(editTarget.description || "");
    setEditEpisodeIds([...(editTarget.episodeIds || [])]);
    setEditPrompt(
      editTarget.imagePrompt?.trim() || buildFilmPropImagePrompt(editTarget, promptTemplate)
    );
  }, [editTarget, promptTemplate]);

  const pendingCount = props.filter(
    (p) => p.status !== "created" && p.status !== "creating" && !(p.imageUrls?.length || p.imageUrl)
  ).length;
  const allDone = props.length > 0 && pendingCount === 0;

  const handleTab = (id: FilmProductionTab) => {
    setTab(id);
    if (id !== "props") onTabNavigate?.(id);
  };

  /** Tạo ngay — không mở modal */
  const handleCreate = async (p: FilmPropRecord) => {
    if (busy || p.status === "creating") return;
    const latest = props.find((x) => x.id === p.id) || p;
    if (latest.status === "creating") return;
    const prompt = latest.imagePrompt?.trim() || buildFilmPropImagePrompt(latest, promptTemplate);
    setBusy(true);
    try {
      if (onCreatePropImage) {
        await onCreatePropImage({ prop: latest, prompt });
        return;
      }
      const updated: FilmPropRecord = {
        ...latest,
        imagePrompt: prompt,
        status: "created",
        updatedAt: new Date().toISOString(),
      };
      onPropsChange(props.map((x) => (x.id === updated.id ? updated : x)));
      await onSaveProp(updated);
    } finally {
      setBusy(false);
    }
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

  const handleDelete = async (p: FilmPropRecord) => {
    if (busy || p.status === "creating") return;
    setBusy(true);
    try {
      await onDeleteProp(p);
      if (editTarget?.id === p.id) setEditTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (p: FilmPropRecord) => {
    if (busy || !onCloneProp) return;
    setBusy(true);
    try {
      await onCloneProp(p);
    } finally {
      setBusy(false);
    }
  };

  const handleSuggest = async (p: FilmPropRecord) => {
    if (!onSuggestPropCompanions || suggestingId) return;
    setSuggestingId(p.id);
    try {
      await onSuggestPropCompanions(p);
    } finally {
      setSuggestingId(null);
    }
  };

  const handleToggleEpisode = async (p: FilmPropRecord, episodeId: string) => {
    const ids = new Set(p.episodeIds || []);
    if (ids.has(episodeId)) ids.delete(episodeId);
    else ids.add(episodeId);
    const next: FilmPropRecord = {
      ...p,
      episodeIds: Array.from(ids),
      updatedAt: new Date().toISOString(),
    };
    onPropsChange(props.map((x) => (x.id === next.id ? next : x)));
    await onSaveProp(next);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const draft: FilmPropRecord = {
      ...editTarget,
      name: editName.trim() || editTarget.name,
      category: editCategory,
      description: editDesc.trim(),
      episodeIds: [...editEpisodeIds],
      imagePrompt:
        editPrompt.trim() ||
        buildFilmPropImagePrompt(
          {
            name: editName.trim() || editTarget.name,
            description: editDesc.trim(),
          },
          promptTemplate
        ),
      updatedAt: new Date().toISOString(),
    };
    onPropsChange(props.map((x) => (x.id === draft.id ? draft : x)));
    await onSaveProp(draft);
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
        <div className="px-4 sm:px-5 py-1 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl  flex items-center justify-center flex-shrink-0">
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

        <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
          {props.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-3">
              <p className="text-sm text-gray-500 m-0">
                {t("Chưa có vật phẩm. Trích xuất từ Chuỗi Cảnh quay hoặc thêm thủ công.")}
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
            <div className={FILM_MEDIA_CARD_GRID_CLASS}>
              {props.map((p) => (
                <FilmPropCard
                  key={p.id}
                  prop={p}
                  linkedProps={resolveLinkedProps(p)}
                  episodes={episodes}
                  suggestingProps={suggestingId === p.id}
                  onEdit={setEditTarget}
                  onDelete={handleDelete}
                  onClone={onCloneProp ? handleClone : undefined}
                  onCreate={handleCreate}
                  onStopGeneration={
                    onStopPropImage
                      ? () => {
                          void onStopPropImage(p);
                        }
                      : undefined
                  }
                  generationActionPending={!!stopPendingIds?.[p.id]}
                  onSuggestProps={onSuggestPropCompanions ? handleSuggest : undefined}
                  onCreatePropImage={onCreatePropImage}
                  onCreatePropWithCompanionRefs={onCreatePropWithCompanionRefs}
                  onAddLinkedProp={onAddPropCompanion}
                  onOpenCatalog={
                    onLinkCatalogItems ? (pr) => setCatalogOwner(pr) : undefined
                  }
                  onMoveLinkedProp={onMoveLinkedProp}
                  onUnlinkLinkedProp={
                    onUnlinkLinkedProp
                      ? (linked) =>
                          onUnlinkLinkedProp({
                            kind: "prop",
                            ownerId: p.id,
                            propName: linked.name,
                          })
                      : undefined
                  }
                  onToggleEpisode={handleToggleEpisode}
                  onSetImage={
                    onSetPropImage
                      ? (pr, image) => {
                          void onSetPropImage(pr, image);
                        }
                      : undefined
                  }
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
        title={t("Sửa vật phẩm")}
        width={560}
        maxWidth="95vw"
        slideFromBottom="none"
        wrapperClass={FILM_EDIT_DIALOG_WRAPPER_CLASS}
        dialogClass={FILM_EDIT_DIALOG_CLASS}
        headerClass={FILM_EDIT_DIALOG_HEADER_CLASS}
        bodyClass={FILM_EDIT_DIALOG_BODY_CLASS}
        footerClass={FILM_EDIT_DIALOG_FOOTER_CLASS}
      >
        <Dialog.Body>
          <FilmEditDialogShell>
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Mô tả")}</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder={t("Physical characteristics / visual description…")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                style={{ maxHeight: 120 }}
              />
            </div>
            {episodes.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {t("Hiển thị ở tập")}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {episodes.map((ep) => {
                    const on = editEpisodeIds.includes(ep.id);
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() =>
                          setEditEpisodeIds((prev) =>
                            on ? prev.filter((id) => id !== ep.id) : [...prev, ep.id]
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border cursor-pointer ${
                          on
                            ? "bg-blue-50 border-blue-200 text-blue-700"
                            : "bg-white border-gray-200 text-gray-500"
                        }`}
                      >
                        {ep.title || t("Tập {{n}}", { n: ep.index })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Prompt instruction")}
              </label>
              <textarea
                value={editPrompt}
                onChange={(e) => setEditPrompt(e.target.value)}
                rows={5}
                className={FILM_EDIT_PROMPT_TEXTAREA_CLASS}
                style={FILM_EDIT_PROMPT_TEXTAREA_STYLE}
              />
              <button
                type="button"
                className="mt-1.5 text-xs text-blue-600 bg-transparent border-0 cursor-pointer p-0 hover:underline"
                onClick={() =>
                  setEditPrompt(
                    buildFilmPropImagePrompt(
                      {
                        name: editName.trim() || editTarget?.name || "",
                        description: editDesc.trim(),
                      },
                      promptTemplate
                    )
                  )
                }
              >
                {t("Đặt lại prompt mặc định")}
              </button>
            </div>
          </FilmEditDialogShell>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            outline
            text={t("Hủy")}
            className="!rounded-xl"
            onClick={() => setEditTarget(null)}
          />
          <Button
            primary
            text={t("Lưu")}
            className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
            onClick={saveEdit}
          />
        </Dialog.Footer>
      </Dialog>

      <FilmCatalogPickDialog
        isOpen={!!catalogOwner}
        onClose={() => setCatalogOwner(null)}
        title={t("Thêm vật phẩm cho {{name}}", {
          name: catalogOwner?.name || "",
        })}
        characters={characters}
        propsList={pool}
        sceneImages={sceneImages}
        excludeNames={catalogOwner?.propNames || []}
        excludeIds={catalogOwner ? [catalogOwner.id] : []}
        onConfirm={async (items) => {
          if (catalogOwner && onLinkCatalogItems) {
            await onLinkCatalogItems(catalogOwner, items);
          }
        }}
      />
    </div>
  );
}
