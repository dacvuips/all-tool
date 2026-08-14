/**
 * UI block: list vật phẩm kèm + chọn max 10 + gợi ý AI + gen / gen lại parent + ref.
 * Dùng cho Nhân vật / Vật phẩm / Bối cảnh.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineReload } from "react-icons/ai";
import {
  HiOutlinePhotograph,
  HiPlus,
  HiSparkles,
  HiTrash,
} from "react-icons/hi";
import { MdOutlineDragIndicator } from "react-icons/md";
import { RiMagicFill } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import {
  readFilmLinkedPropDnd,
  writeFilmLinkedPropDnd,
  type FilmCatalogKind,
} from "./film-catalog-pick-dialog";
import FilmMediaZoom from "./film-media-zoom";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import { FilmPropRecord } from "./film-types";

export const FILM_ENTITY_PROP_REF_LIMIT = 10;

function propHasImage(p: FilmPropRecord): boolean {
  return !!(p.imageBlob || p.imageUrl?.trim() || (p.imageUrls && p.imageUrls.length > 0));
}

type Props = {
  linkedProps: FilmPropRecord[];
  /** Nút gợi ý AI */
  suggestLabel: string;
  /** Gen lại entity cha + ref vật phẩm */
  regenWithRefsLabel: string;
  emptyHint: string;
  suggesting?: boolean;
  parentBusy?: boolean;
  onSuggest?: () => void | Promise<void>;
  onAddLinkedProp?: (input: {
    name: string;
    description: string;
  }) => Promise<void>;
  onOpenCatalog?: () => void;
  ownerKind?: FilmCatalogKind;
  ownerId?: string;
  onMoveLinkedProp?: (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => void;
  onUnlinkLinkedProp?: (prop: FilmPropRecord) => void;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onRegenWithPropRefs?: (input: {
    propIds: string[];
    propNamesInPrompt: string[];
  }) => Promise<void>;
};

export default function FilmLinkedPropsBlock({
  linkedProps,
  suggestLabel,
  regenWithRefsLabel,
  emptyHint,
  suggesting = false,
  parentBusy = false,
  onSuggest,
  onAddLinkedProp,
  onOpenCatalog,
  ownerKind,
  ownerId,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onCreatePropImage,
  onRegenWithPropRefs,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [localBusy, setLocalBusy] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const busy = parentBusy || suggesting || localBusy;

  useEffect(() => {
    const ids = linkedProps.map((p) => p.id);
    setSelectedIds((prev) => {
      if (!ids.length) return new Set();
      const valid = new Set(ids);
      const kept = ids.filter((id) => prev.has(id));
      if (!kept.length) {
        return new Set(ids.slice(0, FILM_ENTITY_PROP_REF_LIMIT));
      }
      const next = new Set(kept.filter((id) => valid.has(id)));
      if (!next.size) {
        return new Set(ids.slice(0, FILM_ENTITY_PROP_REF_LIMIT));
      }
      const ordered = ids.filter((id) => next.has(id)).slice(0, FILM_ENTITY_PROP_REF_LIMIT);
      return new Set(ordered);
    });
  }, [linkedProps.map((p) => p.id).join("|")]);

  const selectedProps = useMemo(
    () => linkedProps.filter((p) => selectedIds.has(p.id)),
    [linkedProps, selectedIds]
  );
  const atSelectLimit = selectedIds.size >= FILM_ENTITY_PROP_REF_LIMIT;
  const allSelected =
    linkedProps.length > 0 &&
    selectedIds.size >= Math.min(linkedProps.length, FILM_ENTITY_PROP_REF_LIMIT) &&
    linkedProps
      .slice(0, FILM_ENTITY_PROP_REF_LIMIT)
      .every((p) => selectedIds.has(p.id));
  const selectedWithImage = selectedProps.filter(propHasImage);
  const allWithImage = linkedProps.filter(propHasImage);

  const warnSelectLimit = () => {
    toast.error(
      t("Chỉ chọn tối đa {{n}} vật phẩm.", {
        n: FILM_ENTITY_PROP_REF_LIMIT,
      })
    );
  };

  const toggleOne = (id: string) => {
    if (selectedIds.has(id)) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (selectedIds.size >= FILM_ENTITY_PROP_REF_LIMIT) {
      warnSelectLimit();
      return;
    }
    setSelectedIds((prev) => {
      if (prev.size >= FILM_ENTITY_PROP_REF_LIMIT) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size > 0 && (allSelected || atSelectLimit)) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(
      new Set(linkedProps.slice(0, FILM_ENTITY_PROP_REF_LIMIT).map((p) => p.id))
    );
    if (linkedProps.length > FILM_ENTITY_PROP_REF_LIMIT) warnSelectLimit();
  };

  const handleGenOneProp = async (prop: FilmPropRecord) => {
    if (!onCreatePropImage || prop.status === "creating" || busy) return;
    setLocalBusy(true);
    try {
      await onCreatePropImage({
        prop,
        prompt: prop.imagePrompt?.trim() || "",
      });
    } finally {
      setLocalBusy(false);
    }
  };

  const handleGenSelectedProps = async () => {
    if (!onCreatePropImage || busy) return;
    const targets = (selectedProps.length ? selectedProps : linkedProps).filter(
      (p) => p.status !== "creating"
    );
    if (!targets.length) {
      toast.warn(t("Chọn vật phẩm cần tạo ảnh."));
      return;
    }
    setLocalBusy(true);
    try {
      for (const prop of targets) {
        await onCreatePropImage({
          prop,
          prompt: prop.imagePrompt?.trim() || "",
        });
      }
    } finally {
      setLocalBusy(false);
    }
  };

  const handleRegenWithRefs = async () => {
    if (!onRegenWithPropRefs || busy) return;
    const pool = selectedProps.length ? selectedProps : linkedProps;
    const withImg = pool.filter(propHasImage);
    if (!withImg.length) {
      toast.warn(
        t("Tạo ảnh vật phẩm trước — tối đa {{n}} ảnh tham chiếu.", {
          n: FILM_ENTITY_PROP_REF_LIMIT,
        })
      );
      return;
    }
    const refs = withImg.slice(0, FILM_ENTITY_PROP_REF_LIMIT);
    setLocalBusy(true);
    try {
      await onRegenWithPropRefs({
        propIds: refs.map((p) => p.id),
        propNamesInPrompt: refs.map((p) =>
          p.description?.trim() ? `${p.name}: ${p.description.trim()}` : p.name
        ),
      });
    } finally {
      setLocalBusy(false);
    }
  };

  const handleSubmitAdd = async () => {
    if (!onAddLinkedProp || busy) return;
    const name = addName.trim();
    if (!name) {
      toast.warn(t("Nhập tên vật phẩm."));
      return;
    }
    setLocalBusy(true);
    try {
      await onAddLinkedProp({ name, description: addDesc.trim() });
      setAddName("");
      setAddDesc("");
      setAddOpen(false);
    } finally {
      setLocalBusy(false);
    }
  };

  if (!onSuggest && !onAddLinkedProp && !onOpenCatalog && linkedProps.length === 0) {
    return null;
  }

  return (
    <div
      className={`flex flex-col gap-1.5 min-w-0 min-h-0 flex-1 rounded-lg ${
        dropActive ? "ring-2 ring-primary/30" : ""
      }`}
      onDragOver={
        onMoveLinkedProp && ownerKind && ownerId
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropActive(true);
            }
          : undefined
      }
      onDragLeave={
        onMoveLinkedProp
          ? (e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDropActive(false);
            }
          : undefined
      }
      onDrop={
        onMoveLinkedProp && ownerKind && ownerId
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setDropActive(false);
              const payload = readFilmLinkedPropDnd(e);
              if (!payload || payload.fromKind !== ownerKind) return;
              if (payload.fromId === ownerId) return;
              onMoveLinkedProp({
                ...payload,
                toKind: ownerKind,
                toId: ownerId,
              });
            }
          : undefined
      }
    >
      {onSuggest ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSuggest()}
          className={`flex-shrink-0 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-10 sm:text-xs font-semibold border cursor-pointer transition-colors ${
            suggesting
              ? "bg-violet-50 text-violet-600 border-violet-100 cursor-wait"
              : "bg-white text-violet-700 border-violet-200 hover:bg-violet-50 hover:border-violet-300 disabled:opacity-40 disabled:cursor-not-allowed"
          }`}
        >
          {suggesting ? (
            <>
              <span className="flex-shrink-0 w-3 h-3 rounded-full border-2 border-violet-400 animate-spin border-t-transparent" />
              {t("Đang gợi ý...")}
            </>
          ) : (
            <>
              <HiSparkles className="flex-shrink-0 text-sm" />
              {suggestLabel}
            </>
          )}
        </button>
      ) : null}

      <div className="flex flex-col gap-1.5 min-w-0 min-h-0 flex-1">
        <div className="flex flex-shrink-0 gap-1 justify-between items-center">
          <div className="font-semibold tracking-wide text-gray-400 uppercase truncate text-10">
            {linkedProps.length > 0 ? (
              <>
                {linkedProps.length}
                {selectedIds.size > 0 ? (
                  <span className="font-semibold text-gray-500 normal-case">
                    {" "}
                    · {selectedIds.size}/{FILM_ENTITY_PROP_REF_LIMIT}
                  </span>
                ) : null}
              </>
            ) : null}
          </div>
          <div className="flex flex-shrink-0 gap-1 items-center">
            {linkedProps.length > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={toggleAll}
                className="text-10 font-semibold text-gray-600 hover:text-gray-800 border-0 bg-transparent cursor-pointer px-1 py-0.5 disabled:opacity-40"
              >
                {selectedIds.size > 0 && (allSelected || atSelectLimit)
                  ? t("Bỏ chọn hết")
                  : t("Chọn hết")}
              </button>
            ) : null}
            {onOpenCatalog ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onOpenCatalog()}
                className="inline-flex items-center gap-0.5 text-10 font-semibold text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer px-1 py-0.5 disabled:opacity-40"
              >
                <HiPlus className="text-xs" />
                {t("Thêm")}
              </button>
            ) : onAddLinkedProp ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddOpen((v) => !v)}
                className="inline-flex items-center gap-0.5 text-10 font-semibold text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer px-1 py-0.5 disabled:opacity-40"
              >
                <HiPlus className="text-xs" />
                {t("Thêm")}
              </button>
            ) : null}
            {onOpenCatalog && onAddLinkedProp ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setAddOpen((v) => !v)}
                className="inline-flex items-center gap-0.5 text-10 font-semibold text-gray-500 hover:text-gray-700 border-0 bg-transparent cursor-pointer px-1 py-0.5 disabled:opacity-40"
              >
                <HiPlus className="text-xs" />
                {t("Tạo")}
              </button>
            ) : null}
          </div>
        </div>

        {addOpen ? (
          <div className="flex-shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-2 flex flex-col gap-1.5">
            <div>
              <label className="block text-10 font-medium text-gray-500 mb-0.5">
                {t("Tên")}
              </label>
              <input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder={t("Tên vật phẩm")}
                disabled={busy}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-50 bg-white disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSubmitAdd();
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-10 font-medium text-gray-500 mb-0.5">
                {t("Mô tả")}
              </label>
              <textarea
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                placeholder={t("Mô tả / đặc điểm nhìn thấy…")}
                rows={2}
                disabled={busy}
                className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-50 bg-white resize-y disabled:opacity-50"
              />
            </div>
            <div className="flex gap-1 justify-end items-center">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setAddOpen(false);
                  setAddName("");
                  setAddDesc("");
                }}
                className="px-2 py-1 font-semibold text-gray-600 bg-white rounded-md border border-gray-200 cursor-pointer text-10 hover:bg-gray-50 disabled:opacity-40"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                disabled={busy || !addName.trim()}
                onClick={() => void handleSubmitAdd()}
                className="px-2 py-1 font-semibold text-blue-700 bg-blue-50 rounded-md border border-blue-200 cursor-pointer text-10 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("Thêm")}
              </button>
            </div>
          </div>
        ) : null}

        {linkedProps.length > 0 ? (
          <>
            <ul
              className="m-0 p-0 list-none flex flex-col gap-1 min-h-0 max-h-48 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {linkedProps.map((p) => {
                const thumb = getFilmEntityImageSrc(p);
                const selected = selectedIds.has(p.id);
                const propCreating = p.status === "creating";
                const canDrag =
                  !!onMoveLinkedProp && !!ownerKind && !!ownerId && !busy;
                const showActions = hoveredId === p.id || propCreating;
                return (
                  <li
                    key={p.id}
                    draggable={canDrag && dragId === p.id}
                    onDragStart={(e) => {
                      if (!ownerKind || !ownerId) return;
                      writeFilmLinkedPropDnd(e, {
                        propName: p.name,
                        fromKind: ownerKind,
                        fromId: ownerId,
                      });
                    }}
                    onDragEnd={() => setDragId(null)}
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() =>
                      setHoveredId((id) => (id === p.id ? null : id))
                    }
                    className={`relative rounded-lg border min-w-0 flex-shrink-0 ${
                      selected
                        ? "bg-blue-50 border-blue-200"
                        : "bg-white border-gray-100"
                    }`}
                  >
                    <div className="flex items-center gap-1 p-1 min-w-0">
                      <span
                        title={t("Kéo thả")}
                        onMouseDown={() => {
                          if (canDrag) setDragId(p.id);
                        }}
                        className={`flex flex-shrink-0 justify-center items-center w-4 text-gray-400 ${
                          canDrag
                            ? "cursor-grab active:cursor-grabbing"
                            : "opacity-40"
                        }`}
                      >
                        <MdOutlineDragIndicator className="text-base" />
                      </span>
                      <div className="overflow-hidden relative flex-shrink-0 w-9 h-9 bg-gray-50 rounded-md border-2 border-transparent">
                        {thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt={p.name}
                            title={t("Click hoặc hover để xem")}
                            onClick={() => setZoomSrc(thumb)}
                            className="object-cover w-full h-full transition-transform duration-200 cursor-zoom-in hover:scale-125"
                          />
                        ) : (
                          <div className="flex justify-center items-center w-full h-full">
                            {propCreating ? (
                              <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                            ) : (
                              <HiOutlinePhotograph className="text-base text-gray-300" />
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleOne(p.id)}
                        disabled={busy}
                        className="flex-1 p-0 min-w-0 text-left bg-transparent border-0 cursor-pointer disabled:opacity-50"
                        title={selected ? t("Bỏ chọn") : t("Chọn")}
                      >
                        <div
                          className={`font-semibold leading-tight truncate text-10 ${
                            selected ? "text-blue-800" : "text-gray-800"
                          }`}
                        >
                          {p.name}
                        </div>
                      </button>
                      {showActions ? (
                        <div className="flex flex-shrink-0 gap-0.5 items-center">
                          {onCreatePropImage ? (
                            <button
                              type="button"
                              title={
                                propHasImage(p) ? t("Tạo lại") : t("Tạo ảnh")
                              }
                              disabled={busy || propCreating}
                              onClick={() => void handleGenOneProp(p)}
                              className="flex flex-shrink-0 justify-center items-center w-6 h-6 text-gray-600 bg-white rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {propCreating ? (
                                <span className="w-2.5 h-2.5 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
                              ) : propHasImage(p) ? (
                                <AiOutlineReload className="text-sm" />
                              ) : (
                                <RiMagicFill className="text-sm" />
                              )}
                            </button>
                          ) : null}
                          {onUnlinkLinkedProp ? (
                            <button
                              type="button"
                              title={t("Xóa")}
                              disabled={busy}
                              onClick={() => onUnlinkLinkedProp(p)}
                              className="flex flex-shrink-0 justify-center items-center w-6 h-6 text-red-500 bg-white rounded-md border border-red-100 cursor-pointer hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <HiTrash className="text-sm" />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col flex-shrink-0 gap-1">
              {onCreatePropImage ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGenSelectedProps()}
                  className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-10 sm:text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RiMagicFill className="text-sm" />
                  {selectedIds.size > 0
                    ? t("Tạo ảnh ({{n}} đã chọn)", { n: selectedIds.size })
                    : t("Tạo ảnh tất cả vật phẩm")}
                </button>
              ) : null}
              {onRegenWithPropRefs ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRegenWithRefs()}
                  className="w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-10 sm:text-xs font-semibold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title={t(
                    "Gen lại ảnh chính; gắn tối đa {{n}} ảnh vật phẩm đã chọn làm tham chiếu",
                    { n: FILM_ENTITY_PROP_REF_LIMIT }
                  )}
                >
                  <AiOutlineReload className="text-sm" />
                  {regenWithRefsLabel}
                  {(selectedWithImage.length || allWithImage.length) > 0
                    ? ` (${Math.min(
                        FILM_ENTITY_PROP_REF_LIMIT,
                        selectedWithImage.length || allWithImage.length
                      )})`
                    : ""}
                </button>
              ) : null}
            </div>
          </>
        ) : !addOpen ? (
          <p className="m-0 leading-snug text-center text-gray-400 text-10">
            {emptyHint}
          </p>
        ) : null}
      </div>

      <FilmMediaZoom
        media={zoomSrc ? { src: zoomSrc, type: "image" } : null}
        onClose={() => setZoomSrc(null)}
      />
    </div>
  );
}
