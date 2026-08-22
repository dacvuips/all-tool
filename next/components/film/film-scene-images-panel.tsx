import { useEffect, useMemo, useState } from "react";
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
import type { FilmLocationImageGenerateInput } from "./film-location-image-dialog";
import { buildFilmLocationImagePrompt } from "./film-location-image-prompt";
import { FILM_MEDIA_CARD_GRID_CLASS, FILM_MEDIA_CARD_GRID_PAD_CLASS } from "./film-media-card-grid";
import { FilmProductionSearchInput } from "./film-production-search-input";
import { matchesFilmNameSearch } from "./film-production-search";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import FilmSceneImageCard from "./film-scene-image-card";
import { FilmCatalogPickDialog, type FilmCatalogKind, type FilmCatalogPickItem } from "./film-catalog-pick-dialog";
import {
  FilmAspectRatio,
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
} from "./film-types";

type Props = {
  items: FilmSceneImageRecord[];
  propsList?: FilmPropRecord[];
  episodes?: FilmEpisodeRecord[];
  aspectRatio?: FilmAspectRatio;
  /** Prompt mẫu Setting dự án */
  promptTemplate?: string | null;
  onItemsChange: (next: FilmSceneImageRecord[]) => void;
  onSaveItem: (item: FilmSceneImageRecord) => Promise<void>;
  onExtract: () => Promise<void>;
  onBulkCreate: () => Promise<void>;
  onAddItem: (name?: string) => Promise<void | FilmSceneImageRecord | undefined>;
  onDeleteItem: (item: FilmSceneImageRecord) => Promise<void>;
  onCloneItem?: (item: FilmSceneImageRecord) => Promise<void | FilmSceneImageRecord | undefined>;
  /** Tạo từ dialog (kèm prompt đã build) */
  onCreateItem: (input: FilmLocationImageGenerateInput) => Promise<void>;
  onCreateLocationWithPropRefs?: (input: FilmLocationImageGenerateInput) => Promise<void>;
  onSetItemImage?: (item: FilmSceneImageRecord, image: GeneratedImageData) => Promise<void>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onStopItemImage?: (item: FilmSceneImageRecord) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onSuggestLocationProps?: (item: FilmSceneImageRecord) => Promise<void>;
  onAddLocationProp?: (input: {
    item: FilmSceneImageRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  characters?: FilmCharacterRecord[];
  onLinkCatalogItems?: (
    item: FilmSceneImageRecord,
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

const TIME_OF_DAY_PRESETS = [
  "Golden Hour",
  "Harsh Noon",
  "Rainy Night",
  "Blue Hour",
  "Overcast Morning",
  "Moonlit Night",
  "Daylight",
  "Sunset",
] as const;

export default function FilmSceneImagesPanel({
  items,
  propsList = [],
  episodes = [],
  aspectRatio = "16:9",
  promptTemplate,
  onItemsChange,
  onSaveItem,
  onExtract,
  onBulkCreate,
  onAddItem,
  onDeleteItem,
  onCloneItem,
  onCreateItem,
  onCreateLocationWithPropRefs,
  onSetItemImage,
  onCreatePropImage,
  onStopItemImage,
  stopPendingIds,
  onSuggestLocationProps,
  onAddLocationProp,
  characters = [],
  onLinkCatalogItems,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onTabNavigate,
  focusEntityId = null,
  onFocusEntityConsumed,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmProductionTab>("scene_images");
  const [busy, setBusy] = useState(false);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);

  useFilmEntityCardFocus(focusEntityId, onFocusEntityConsumed);

  useEffect(() => {
    if (focusEntityId) setTab("scene_images");
  }, [focusEntityId]);
  const [editTarget, setEditTarget] = useState<FilmSceneImageRecord | null>(null);
  const [catalogOwner, setCatalogOwner] = useState<FilmSceneImageRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editContext, setEditContext] = useState("");
  const [editTimeOfDay, setEditTimeOfDay] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editEpisodeIds, setEditEpisodeIds] = useState<string[]>([]);

  const resolveLinkedProps = (item: FilmSceneImageRecord): FilmPropRecord[] => {
    const names = (item.propNames || []).map((n) => n.trim()).filter(Boolean);
    if (!names.length) return [];
    const byKey = new Map(propsList.map((x) => [x.name.trim().toLowerCase(), x]));
    const out: FilmPropRecord[] = [];
    const seen = new Set<string>();
    for (const n of names) {
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const hit = byKey.get(k);
      if (hit) out.push(hit);
    }
    return out;
  };

  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditContext(editTarget.context || "");
    setEditTimeOfDay(editTarget.timeOfDay || "");
    setEditDesc(editTarget.description || "");
    setEditEpisodeIds([...(editTarget.episodeIds || [])]);
    setEditPrompt(
      editTarget.imagePrompt?.trim() ||
        buildFilmLocationImagePrompt(editTarget, aspectRatio, promptTemplate)
    );
  }, [editTarget, aspectRatio, promptTemplate]);

  const pendingCount = items.filter(
    (p) => p.status !== "created" && p.status !== "creating" && !(p.imageUrls?.length || p.imageUrl)
  ).length;
  const allDone = items.length > 0 && pendingCount === 0;
  const visibleItems = useMemo(
    () => items.filter((item) => matchesFilmNameSearch([item.name], searchQuery)),
    [items, searchQuery]
  );

  const handleTab = (id: FilmProductionTab) => {
    setTab(id);
    if (id !== "scene_images") onTabNavigate?.(id);
  };

  /** Tạo ngay — không mở modal */
  const handleCreate = async (item: FilmSceneImageRecord) => {
    if (busy || item.status === "creating") return;
    const latest = items.find((x) => x.id === item.id) || item;
    if (latest.status === "creating") return;
    const prompt =
      latest.imagePrompt?.trim() ||
      buildFilmLocationImagePrompt(latest, aspectRatio, promptTemplate);
    setBusy(true);
    try {
      await onCreateItem({ item: latest, prompt });
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
      await onAddItem();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (item: FilmSceneImageRecord) => {
    if (busy || item.status === "creating") return;
    setBusy(true);
    try {
      await onDeleteItem(item);
      if (editTarget?.id === item.id) setEditTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleClone = async (item: FilmSceneImageRecord) => {
    if (busy || !onCloneItem) return;
    setBusy(true);
    try {
      await onCloneItem(item);
    } finally {
      setBusy(false);
    }
  };

  const handleSuggest = async (item: FilmSceneImageRecord) => {
    if (!onSuggestLocationProps || suggestingId) return;
    setSuggestingId(item.id);
    try {
      await onSuggestLocationProps(item);
    } finally {
      setSuggestingId(null);
    }
  };

  const handleToggleEpisode = async (item: FilmSceneImageRecord, episodeId: string) => {
    const ids = new Set(item.episodeIds || []);
    if (ids.has(episodeId)) ids.delete(episodeId);
    else ids.add(episodeId);
    const next: FilmSceneImageRecord = {
      ...item,
      episodeIds: Array.from(ids),
      updatedAt: new Date().toISOString(),
    };
    onItemsChange(items.map((x) => (x.id === next.id ? next : x)));
    await onSaveItem(next);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const draft: FilmSceneImageRecord = {
      ...editTarget,
      name: editName.trim() || editTarget.name,
      context: editContext.trim() || "Ngày",
      timeOfDay: editTimeOfDay.trim() || "Daylight",
      description: editDesc.trim(),
      episodeIds: [...editEpisodeIds],
      imagePrompt:
        editPrompt.trim() ||
        buildFilmLocationImagePrompt(
          {
            name: editName.trim() || editTarget.name,
            description: editDesc.trim(),
            timeOfDay: editTimeOfDay.trim() || "Daylight",
            context: editContext.trim() || "Ngày",
          },
          aspectRatio,
          promptTemplate
        ),
      updatedAt: new Date().toISOString(),
    };
    onItemsChange(items.map((x) => (x.id === draft.id ? draft : x)));
    await onSaveItem(draft);
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
                {items.length} {t("Bối cảnh")}
                {" · "}
                <span className="font-medium text-gray-600">{aspectRatio}</span>
                {" · "}
                <span className={allDone ? "text-green-600" : "text-blue-600"}>
                  {allDone ? t("Đã cấu hình") : t("Chưa cấu hình")}
                </span>
              </p>
            </div>
          </div>
          <FilmProductionSearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder={t("Tìm bối cảnh...")}
            className="w-full sm:flex-1 sm:max-w-xs order-last sm:order-none"
          />
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button
              outline
              small
              text={t("Tạo hàng loạt")}
              icon={<HiTemplate />}
              className="!rounded-lg"
              onClick={handleBulk}
              isLoading={busy}
              disabled={!items.length}
            />
            <Button
              primary
              small
              text={t("Thêm bối cảnh")}
              icon={<HiPlus />}
              className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
              onClick={handleAdd}
              disabled={busy}
            />
          </div>
        </div>

        <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
          {items.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-3">
              <p className="text-sm text-gray-500 m-0">
                {t("Chưa có bối cảnh. Trích xuất địa điểm từ Chuỗi Cảnh quay hoặc thêm thủ công.")}
              </p>
              <div className="flex gap-2 flex-wrap justify-center">
                <Button
                  outline
                  text={t("Trích xuất từ cảnh")}
                  icon={<HiSparkles />}
                  className="!rounded-lg"
                  onClick={onExtract}
                />
                <Button
                  primary
                  text={t("Thêm bối cảnh")}
                  icon={<HiPlus />}
                  className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
                  onClick={handleAdd}
                />
              </div>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-2">
              <p className="text-sm text-gray-400 m-0">{t("Không có bối cảnh khớp tìm kiếm.")}</p>
            </div>
          ) : (
            <div className={FILM_MEDIA_CARD_GRID_CLASS}>
              {visibleItems.map((item) => (
                <FilmSceneImageCard
                  key={item.id}
                  item={item}
                  linkedProps={resolveLinkedProps(item)}
                  episodes={episodes}
                  aspectRatio={aspectRatio}
                  suggestingProps={suggestingId === item.id}
                  onEdit={setEditTarget}
                  onDelete={handleDelete}
                  onClone={onCloneItem ? handleClone : undefined}
                  onCreate={handleCreate}
                  onStopGeneration={
                    onStopItemImage
                      ? () => {
                          void onStopItemImage(item);
                        }
                      : undefined
                  }
                  generationActionPending={!!stopPendingIds?.[item.id]}
                  onSuggestProps={onSuggestLocationProps ? handleSuggest : undefined}
                  onCreatePropImage={onCreatePropImage}
                  onCreateLocationWithPropRefs={onCreateLocationWithPropRefs}
                  onAddLinkedProp={onAddLocationProp}
                  onOpenCatalog={
                    onLinkCatalogItems ? (it) => setCatalogOwner(it) : undefined
                  }
                  onMoveLinkedProp={onMoveLinkedProp}
                  onUnlinkLinkedProp={
                    onUnlinkLinkedProp
                      ? (prop) =>
                          onUnlinkLinkedProp({
                            kind: "location",
                            ownerId: item.id,
                            propName: prop.name,
                          })
                      : undefined
                  }
                  onToggleEpisode={handleToggleEpisode}
                  onSetImage={
                    onSetItemImage
                      ? (it, image) => {
                          void onSetItemImage(it, image);
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
        title={t("Sửa bối cảnh")}
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Tên địa điểm")}
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Ngữ cảnh")}
              </label>
              <input
                value={editContext}
                onChange={(e) => setEditContext(e.target.value)}
                placeholder={t("vd. sau mưa, sau trận chiến…")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("Time of Day")}
              </label>
              <p className="text-10 text-gray-400 m-0 mb-1.5">
                {t("Ánh sáng điện ảnh — ví dụ Golden Hour, Harsh Noon, Rainy Night")}
              </p>
              <input
                value={editTimeOfDay}
                onChange={(e) => setEditTimeOfDay(e.target.value)}
                placeholder={t("vd. Golden Hour")}
                className="w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TIME_OF_DAY_PRESETS.map((preset) => {
                  const active = editTimeOfDay.trim() === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditTimeOfDay(preset)}
                      className={`px-2 py-0.5 rounded-md text-10 font-medium border-0 cursor-pointer ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Mô tả")}</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder={t("Mô tả bối cảnh / không gian…")}
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
                    buildFilmLocationImagePrompt(
                      {
                        name: editName.trim() || editTarget?.name || "",
                        description: editDesc.trim(),
                        timeOfDay: editTimeOfDay.trim() || "Daylight",
                        context: editContext.trim() || "Ngày",
                      },
                      aspectRatio,
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
        propsList={propsList}
        sceneImages={items}
        excludeNames={catalogOwner?.propNames || []}
        excludeIds={catalogOwner ? [catalogOwner.id] : []}
        onConfirm={async (itemsPicked) => {
          if (catalogOwner && onLinkCatalogItems) {
            await onLinkCatalogItems(catalogOwner, itemsPicked);
          }
        }}
      />
    </div>
  );
}
