import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiAnnotation,
  HiDotsVertical,
  HiPlus,
  HiShare,
  HiSparkles,
  HiThumbDown,
  HiThumbUp,
  HiVideoCamera,
} from "react-icons/hi";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import FilmCharacterCard from "./film-character-card";
import { FilmCatalogPickDialog, type FilmCatalogKind, type FilmCatalogPickItem } from "./film-catalog-pick-dialog";
import type { FilmCharacterImageGenerateInput } from "./film-character-image-dialog";
import { buildFilmCharacterImagePrompt } from "./film-character-image-prompt";
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
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import {
  FilmAspectRatio,
  FilmCharacterRecord,
  FilmCharacterRole,
  FilmEpisodeRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  filmCharacterRoleLabel,
} from "./film-types";

export type FilmProductionTab =
  | "extract_characters"
  | "character_images"
  | "props"
  | "scene_images";

type Props = {
  characters: FilmCharacterRecord[];
  /** List props project — map vào chip dưới card theo character.propNames */
  propsList?: FilmPropRecord[];
  /** Tập phim — gán thẻ episodeIds trên nhân vật */
  episodes?: FilmEpisodeRecord[];
  aspectRatio?: FilmAspectRatio;
  /** Prompt mẫu Setting dự án */
  promptTemplate?: string | null;
  onCharactersChange: (next: FilmCharacterRecord[]) => void;
  onSaveCharacter: (c: FilmCharacterRecord) => Promise<void>;
  onExtractCharacters: () => Promise<void>;
  onBulkCreate: () => Promise<void>;
  onAddCharacter: (name?: string) => Promise<void | FilmCharacterRecord | undefined>;
  onCloneCharacter?: (c: FilmCharacterRecord) => Promise<void | FilmCharacterRecord | undefined>;
  onDeleteCharacter: (c: FilmCharacterRecord) => Promise<void>;
  onCreateCharacterImage?: (input: FilmCharacterImageGenerateInput) => Promise<void>;
  onCreateCharacterWithPropRefs?: (input: FilmCharacterImageGenerateInput) => Promise<void>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onStopCharacterImage?: (c: FilmCharacterRecord) => void | Promise<void>;
  stopPendingIds?: Record<string, true>;
  onSetCharacterImage?: (c: FilmCharacterRecord, image: GeneratedImageData) => Promise<void>;
  onSuggestCharacterProps?: (c: FilmCharacterRecord) => Promise<void>;
  onAddCharacterProp?: (input: {
    character: FilmCharacterRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  sceneImages?: FilmSceneImageRecord[];
  onLinkCatalogItems?: (
    character: FilmCharacterRecord,
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
  /** Scroll tới card ảnh khi mở từ Gắn storyboard */
  focusEntityId?: string | null;
  onFocusEntityConsumed?: () => void;
};

const TABS: { id: FilmProductionTab; label: string }[] = [
  { id: "extract_characters", label: "Trích xuất Nhân vật Cảnh" },
  { id: "character_images", label: "Nhân vật" },
  { id: "props", label: "Vật phẩm" },
  { id: "scene_images", label: "Bối cảnh" },
];

const ROLE_OPTIONS: { value: FilmCharacterRole; label: string }[] = [
  { value: "main", label: "Main" },
  { value: "antagonist", label: "Antagonist" },
  { value: "supporting", label: "Supporting" },
  { value: "extra", label: "Extra" },
];

export default function FilmCharacterImagesPanel({
  characters,
  propsList = [],
  episodes = [],
  aspectRatio = "16:9",
  promptTemplate,
  onCharactersChange,
  onSaveCharacter,
  onExtractCharacters,
  onBulkCreate,
  onAddCharacter,
  onCloneCharacter,
  onDeleteCharacter,
  onCreateCharacterImage,
  onCreateCharacterWithPropRefs,
  onCreatePropImage,
  onStopCharacterImage,
  stopPendingIds,
  onSetCharacterImage,
  onSuggestCharacterProps,
  onAddCharacterProp,
  sceneImages = [],
  onLinkCatalogItems,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onTabNavigate,
  focusEntityId = null,
  onFocusEntityConsumed,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmProductionTab>("character_images");
  const [busy, setBusy] = useState(false);
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<FilmCharacterRecord | null>(null);
  const [catalogOwner, setCatalogOwner] = useState<FilmCharacterRecord | null>(null);

  useFilmEntityCardFocus(focusEntityId, onFocusEntityConsumed);

  // Mở đúng tab Nhân vật khi focus entity từ storyboard
  useEffect(() => {
    if (focusEntityId) setTab("character_images");
  }, [focusEntityId]);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<string>("supporting");
  const [editDesc, setEditDesc] = useState("");
  const [editClothing, setEditClothing] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editEpisodeIds, setEditEpisodeIds] = useState<string[]>([]);

  useEffect(() => {
    if (!editTarget) return;
    setEditName(editTarget.name);
    setEditRole(editTarget.role || "supporting");
    setEditDesc(editTarget.description || "");
    setEditClothing(editTarget.clothingAccessories || "");
    setEditEpisodeIds([...(editTarget.episodeIds || [])]);
    setEditPrompt(
      editTarget.imagePrompt?.trim() || buildFilmCharacterImagePrompt(editTarget, promptTemplate)
    );
  }, [editTarget, promptTemplate]);

  const pendingCount = characters.filter(
    (c) => c.status !== "created" && c.status !== "creating" && !(c.imageUrls?.length || c.imageUrl)
  ).length;
  const allDone = characters.length > 0 && pendingCount === 0;

  const handleTab = (id: FilmProductionTab) => {
    setTab(id);
    if (id === "props" || id === "scene_images") {
      onTabNavigate?.(id);
    }
  };

  /** Tạo ngay — không mở modal */
  const handleCreate = async (c: FilmCharacterRecord) => {
    if (busy || c.status === "creating") return;
    const latest = characters.find((x) => x.id === c.id) || c;
    if (latest.status === "creating") return;
    const prompt =
      latest.imagePrompt?.trim() || buildFilmCharacterImagePrompt(latest, promptTemplate);
    setBusy(true);
    try {
      if (onCreateCharacterImage) {
        await onCreateCharacterImage({ character: latest, prompt });
        return;
      }
      const updated: FilmCharacterRecord = {
        ...latest,
        imagePrompt: prompt,
        status: "created",
        updatedAt: new Date().toISOString(),
      };
      onCharactersChange(characters.map((x) => (x.id === updated.id ? updated : x)));
      await onSaveCharacter(updated);
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
      await onAddCharacter();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (c: FilmCharacterRecord) => {
    if (busy || c.status === "creating") return;
    setBusy(true);
    try {
      await onDeleteCharacter(c);
      if (editTarget?.id === c.id) setEditTarget(null);
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

  const resolveLinkedProps = (c: FilmCharacterRecord): FilmPropRecord[] => {
    const names = (c.propNames || []).map((n) => n.trim().toLowerCase()).filter(Boolean);
    if (!names.length) return [];
    const set = new Set(names);
    return propsList.filter((p) => set.has(p.name.trim().toLowerCase()));
  };

  const handleSuggestProps = async (c: FilmCharacterRecord) => {
    if (!onSuggestCharacterProps || busy || suggestingId) return;
    setSuggestingId(c.id);
    try {
      await onSuggestCharacterProps(c);
    } finally {
      setSuggestingId(null);
    }
  };

  const handleClone = async (c: FilmCharacterRecord) => {
    if (!onCloneCharacter || busy || c.status === "creating") return;
    setBusy(true);
    try {
      await onCloneCharacter(c);
    } finally {
      setBusy(false);
    }
  };

  const toggleEditEpisode = (episodeId: string) => {
    setEditEpisodeIds((prev) =>
      prev.includes(episodeId) ? prev.filter((id) => id !== episodeId) : [...prev, episodeId]
    );
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    const draft: FilmCharacterRecord = {
      ...editTarget,
      name: editName.trim() || editTarget.name,
      role: editRole,
      description: editDesc.trim(),
      clothingAccessories: editClothing.trim(),
      episodeIds: [...editEpisodeIds],
      imagePrompt:
        editPrompt.trim() ||
        buildFilmCharacterImagePrompt(
          {
            name: editName.trim() || editTarget.name,
            description: editDesc.trim(),
            clothingAccessories: editClothing.trim(),
          },
          promptTemplate
        ),
      updatedAt: new Date().toISOString(),
    };
    onCharactersChange(characters.map((x) => (x.id === draft.id ? draft : x)));
    await onSaveCharacter(draft);
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

      {tab === "extract_characters" ? (
        <div className="flex-1 min-h-sm bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center px-6 gap-4">
          <p className="text-base font-semibold text-gray-800 m-0">
            {t("Trích xuất nhân vật từ Chuỗi Cảnh quay / nội dung")}
          </p>
          <p className="text-sm text-gray-400 m-0 max-w-md">
            {t(
              "Hệ thống sẽ quét tên nhân vật từ các cảnh quay và nội dung gốc để tạo danh sách tạo hình."
            )}
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
          <div className="px-4 sm:px-5 py-1 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl  flex items-center justify-center flex-shrink-0">
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
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              <Button
                outline
                small
                text={t("Tạo hàng loạt")}
                className="!rounded-lg"
                onClick={handleBulk}
                isLoading={busy}
                disabled={!characters.length}
              />
              <Button
                primary
                small
                text={t("Thêm nhân vật")}
                icon={<HiPlus />}
                className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
                onClick={handleAdd}
                disabled={busy}
              />
            </div>
          </div>

          <div className={FILM_MEDIA_CARD_GRID_PAD_CLASS}>
            {characters.length === 0 ? (
              <div className="h-full min-h-2xs flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-gray-500 m-0">
                  {t("Chưa có nhân vật. Trích xuất từ Chuỗi Cảnh quay hoặc thêm thủ công.")}
                </p>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button
                    outline
                    text={t("Trích xuất Nhân vật")}
                    icon={<HiSparkles />}
                    className="!rounded-lg"
                    onClick={handleExtract}
                  />
                  <Button
                    primary
                    text={t("Thêm nhân vật")}
                    icon={<HiPlus />}
                    className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
                    onClick={handleAdd}
                  />
                </div>
              </div>
            ) : (
              <div className={FILM_MEDIA_CARD_GRID_CLASS}>
                {characters.map((c) => (
                  <FilmCharacterCard
                    key={c.id}
                    character={c}
                    linkedProps={resolveLinkedProps(c)}
                    episodes={episodes}
                    aspectRatio={aspectRatio}
                    suggestingProps={suggestingId === c.id}
                    onEdit={setEditTarget}
                    onDelete={handleDelete}
                    onClone={onCloneCharacter ? handleClone : undefined}
                    onCreate={handleCreate}
                    onStopGeneration={
                      onStopCharacterImage
                        ? () => {
                            void onStopCharacterImage(c);
                          }
                        : undefined
                    }
                    generationActionPending={!!stopPendingIds?.[c.id]}
                    onSuggestProps={onSuggestCharacterProps ? handleSuggestProps : undefined}
                    onCreatePropImage={onCreatePropImage}
                    onCreateCharacterWithPropRefs={onCreateCharacterWithPropRefs}
                    onAddCharacterProp={onAddCharacterProp}
                    onOpenCatalog={
                      onLinkCatalogItems ? (ch) => setCatalogOwner(ch) : undefined
                    }
                    onMoveLinkedProp={onMoveLinkedProp}
                    onUnlinkLinkedProp={
                      onUnlinkLinkedProp
                        ? (prop) =>
                            onUnlinkLinkedProp({
                              kind: "character",
                              ownerId: c.id,
                              propName: prop.name,
                            })
                        : undefined
                    }
                    onSetImage={
                      onSetCharacterImage
                        ? (ch, image) => {
                            void onSetCharacterImage(ch, image);
                          }
                        : undefined
                    }
                    onToggleEpisode={
                      episodes.length
                        ? (ch, episodeId) => {
                            void (async () => {
                              const ids = new Set(ch.episodeIds || []);
                              if (ids.has(episodeId)) ids.delete(episodeId);
                              else ids.add(episodeId);
                              const next: FilmCharacterRecord = {
                                ...ch,
                                episodeIds: Array.from(ids),
                                updatedAt: new Date().toISOString(),
                              };
                              onCharactersChange(
                                characters.map((x) => (x.id === next.id ? next : x))
                              );
                              await onSaveCharacter(next);
                            })();
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

      <Dialog
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={t("Sửa nhân vật")}
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
              <label className="block text-xs font-medium text-gray-500 mb-1.5">{t("Mô tả")}</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder={t("Ngoại hình, tính cách (không gồm trang phục)…")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                style={{ maxHeight: 120 }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                {t("Clothing & Accessories")}
              </label>
              <p className="text-10 text-gray-400 m-0 mb-1.5">
                {t("Trang phục, giày dép, trang sức, phụ kiện — dùng cho image prompt")}
              </p>
              <textarea
                value={editClothing}
                onChange={(e) => setEditClothing(e.target.value)}
                rows={3}
                placeholder={t("vd. Áo sơ mi trắng, đồng hồ da nâu, balo canvas…")}
                className="w-full rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y"
                style={{ maxHeight: 120 }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Gắn tập phim")}
              </label>
              <p className="text-10 text-gray-400 m-0 mb-1.5">
                {t("Ảnh nhân vật chỉ hiện trong Gắn Nhân vật của các tập đã chọn.")}
              </p>
              {episodes.length === 0 ? (
                <p className="text-xs text-gray-400 m-0">{t("Chưa có tập phim.")}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {episodes.map((ep) => {
                    const on = editEpisodeIds.includes(ep.id);
                    const label = ep.title || t("Tập {{n}}", { n: ep.index });
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => toggleEditEpisode(ep.id)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                          on
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
                    buildFilmCharacterImagePrompt(
                      {
                        name: editName.trim() || editTarget?.name || "",
                        description: editDesc.trim(),
                        clothingAccessories: editClothing.trim(),
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
        propsList={propsList}
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
