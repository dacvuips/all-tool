/**
 * UI gắn nhân vật / vật phẩm / bối cảnh (multi chip + thumb + zoom).
 * Tổng 3 nhóm ≤ FILM_SCENE_ATTACH_IMAGE_LIMIT (dùng maxSlots + usedSlots).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiExternalLink, HiOutlinePhotograph, HiTrash } from "react-icons/hi";
import { RiMagicFill } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import {
  FILM_SCENE_ATTACH_IMAGE_LIMIT,
  filmAttachEntityHasImage,
  listFilmSceneAttachIssues,
  type FilmAttachIssueKind,
  type FilmSceneAttachIssue,
} from "./film-attachment-validate";
import type {
  FilmCharacterRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
} from "./film-types";
import FilmMediaZoom from "./film-media-zoom";

export type FilmAttachOption = {
  id: string;
  name: string;
  imageBlob?: Blob | null;
  imageUrl?: string;
  imageUrls?: string[];
};

function Thumb({
  src,
  name,
  sizeClass = "w-8 h-8",
  missing,
  onZoom,
}: {
  src: string;
  name: string;
  sizeClass?: string;
  missing?: boolean;
  /** Click ảnh → zoom (nếu có src) */
  onZoom?: (src: string) => void;
}) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onClick={
          onZoom
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                onZoom(src);
              }
            : undefined
        }
        className={`${sizeClass} rounded-md object-cover flex-shrink-0 border border-gray-200 bg-gray-50 ${
          onZoom ? "cursor-zoom-in hover:opacity-90" : ""
        }`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} rounded-md flex-shrink-0 flex items-center justify-center text-10 font-bold border ${
        missing
          ? "bg-amber-50 border-amber-200 text-amber-600"
          : "bg-gray-100 border-gray-200 text-gray-400"
      }`}
      title={missing ? "Chưa có ảnh" : name}
    >
      {initial}
    </span>
  );
}

export function FilmAttachChip({
  name,
  src,
  missing,
  onOpen,
  onRemove,
  openTitle,
  onZoom,
}: {
  name: string;
  src?: string;
  missing?: boolean;
  onOpen?: () => void;
  onRemove?: () => void;
  openTitle?: string;
  onZoom?: (src: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg text-xs font-medium ${
        missing
          ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
          : "bg-blue-50 text-blue-700"
      }`}
      title={
        missing
          ? t("Chưa có ảnh gen — bắt buộc trước khi tạo ảnh/video nếu vẫn gắn")
          : name
      }
    >
      <Thumb src={src || ""} name={name} missing={missing} onZoom={onZoom} />
      {onOpen ? (
        <button
          type="button"
          title={openTitle || t("Tạo ảnh")}
          className="max-w-[8rem] truncate border-0 bg-transparent p-0 text-current cursor-pointer hover:underline text-left"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen();
          }}
        >
          {name}
        </button>
      ) : (
        <span className="max-w-[8rem] truncate">{name}</span>
      )}
      {onRemove ? (
        <button
          type="button"
          className="border-0 bg-transparent text-current opacity-60 hover:opacity-100 cursor-pointer p-0 leading-none text-sm"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

/** Multi-select gắn entity (Nhân vật / Vật phẩm / Bối cảnh) với ảnh thumb */
export function FilmEntityAttachField({
  values,
  options,
  onChange,
  emptyLabel,
  /** Tổng slot đã dùng (cả 3 nhóm) — chặn thêm nếu ≥ maxSlots */
  usedSlots,
  maxSlots = FILM_SCENE_ATTACH_IMAGE_LIMIT,
  /**
   * Giới hạn số item trong field này (vd. Gắn Cảnh = 1).
   * Khi đủ max: chọn mới → thay item đầu (single) hoặc chặn + toast.
   */
  maxItems,
  /** true = chọn mới khi đã maxItems sẽ thay thế (mặc định true nếu maxItems === 1) */
  replaceWhenFull,
  /** Bắt buộc ≥1 gắn (Gắn Cảnh) */
  required,
  /** Hiện counter x/max (parent có thể hiện 1 lần) */
  showCounter = false,
  /** Icon → mở tab production và focus thẻ ảnh entity */
  onOpenOption,
  openOptionTitle,
}: {
  values: string[];
  options: FilmAttachOption[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  usedSlots?: number;
  maxSlots?: number;
  maxItems?: number;
  replaceWhenFull?: boolean;
  required?: boolean;
  showCounter?: boolean;
  onOpenOption?: (option: FilmAttachOption) => void;
  openOptionTitle?: string;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);

  const totalUsed =
    typeof usedSlots === "number" ? usedSlots : values.length;
  const atGlobalLimit = totalUsed >= maxSlots;
  const canReplace =
    replaceWhenFull ?? (typeof maxItems === "number" && maxItems === 1);
  /** Chặn pick khi vượt tổng — trừ Gắn Cảnh max=1 (được đổi/thay) */
  const pickBlocked =
    typeof maxItems === "number" && maxItems === 1 && canReplace
      ? values.length === 0 && atGlobalLimit
      : atGlobalLimit ||
        (typeof maxItems === "number" && values.length >= maxItems);

  const byName = useMemo(() => {
    const m = new Map<string, FilmAttachOption>();
    for (const o of options) {
      const k = o.name.trim().toLowerCase();
      if (k) m.set(k, o);
    }
    return m;
  }, [options]);

  const remaining = options.filter(
    (o) => !values.some((v) => v.trim().toLowerCase() === o.name.trim().toLowerCase())
  );

  const warnGlobalLimit = () => {
    toast.error(
      t("Tổng gắn Nhân vật + Vật phẩm + Cảnh tối đa {{n}} ảnh.", {
        n: maxSlots,
      })
    );
  };

  const warnFieldLimit = () => {
    toast.error(t("Gắn Cảnh chỉ được 1 bối cảnh."));
  };

  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (values.some((v) => v.trim().toLowerCase() === n.toLowerCase())) return;
    const opt = byName.get(n.toLowerCase());
    const resolved = opt?.name || n;

    // Field maxItems (Gắn Cảnh = 1)
    if (typeof maxItems === "number" && values.length >= maxItems) {
      if (canReplace && maxItems === 1) {
        onChange([resolved]);
        setDraft("");
        return;
      }
      warnFieldLimit();
      return;
    }

    if (atGlobalLimit) {
      warnGlobalLimit();
      return;
    }

    onChange([...values, resolved]);
    setDraft("");
  };

  return (
    <div
      className={`rounded-xl border p-2.5 bg-white ${
        required && values.length === 0
          ? "border-amber-300 ring-1 ring-amber-100"
          : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v) => {
          const opt = byName.get(v.trim().toLowerCase());
          const src = opt ? getFilmEntityImageSrc(opt) : "";
          const missing = !opt || !filmAttachEntityHasImage(opt);
          return (
            <FilmAttachChip
              key={v}
              name={v}
              src={src}
              missing={missing}
              onZoom={setZoomSrc}
              openTitle={openOptionTitle || t("Mở ảnh")}
              onOpen={
                opt && onOpenOption
                  ? () => onOpenOption(opt)
                  : undefined
              }
              onRemove={() =>
                onChange(
                  values.filter(
                    (x) => x.trim().toLowerCase() !== v.trim().toLowerCase()
                  )
                )
              }
            />
          );
        })}
        {values.length === 0 && (
          <span
            className={`text-xs ${
              required ? "text-amber-600 font-medium" : "text-gray-400"
            }`}
          >
            {emptyLabel ||
              (required ? t("Bắt buộc gắn ít nhất 1 cảnh") : t("Chưa gắn"))}
          </span>
        )}
      </div>
      <div className="flex gap-2 items-center">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder={
            pickBlocked
              ? typeof maxItems === "number" && maxItems === 1
                ? t("Đã gắn 1 cảnh")
                : t("Đã đủ {{n}} ảnh", { n: maxSlots })
              : t("Thêm...")
          }
          disabled={pickBlocked}
          className="flex-1 text-xs border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400 disabled:opacity-50"
        />
        {showCounter && typeof usedSlots === "number" ? (
          <span
            className={`text-10 font-semibold tabular-nums flex-shrink-0 ${
              atGlobalLimit ? "text-red-600" : "text-gray-400"
            }`}
            title={t("Tổng gắn 3 nhóm / tối đa {{n}}", { n: maxSlots })}
          >
            {totalUsed}/{maxSlots}
          </span>
        ) : null}
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-50">
          {remaining.slice(0, 12).map((o) => {
            const src = getFilmEntityImageSrc(o);
            const missing = !filmAttachEntityHasImage(o);
            const addDisabled =
              typeof maxItems === "number" && maxItems === 1 && canReplace
                ? false
                : pickBlocked;
            return (
              <span
                key={o.id}
                className={`inline-flex items-center gap-1 pl-1 pr-1.5 py-1 rounded-md text-10 ${
                  missing
                    ? "text-amber-700 bg-amber-50"
                    : "text-gray-600 bg-gray-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => add(o.name)}
                  disabled={addDisabled}
                  title={
                    typeof maxItems === "number" &&
                    maxItems === 1 &&
                    values.length >= 1
                      ? t("Chọn để thay bối cảnh hiện tại")
                      : pickBlocked
                        ? t("Tối đa {{n}} ảnh gắn", { n: maxSlots })
                        : missing
                          ? t("Chưa có ảnh — click để gắn")
                          : t("Gắn {{name}}", { name: o.name })
                  }
                  className="inline-flex items-center gap-1 border-0 bg-transparent p-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  <Thumb
                    src={src}
                    name={o.name}
                    sizeClass="w-6 h-6"
                    missing={missing}
                    onZoom={setZoomSrc}
                  />
                  <span className="max-w-[7rem] truncate">+ {o.name}</span>
                </button>
                {onOpenOption ? (
                  <button
                    type="button"
                    title={openOptionTitle || t("Mở ảnh")}
                    className="border-0 bg-transparent text-current opacity-60 hover:opacity-100 cursor-pointer p-0 leading-none flex items-center"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onOpenOption(o);
                    }}
                  >
                    <HiExternalLink className="text-sm" />
                  </button>
                ) : null}
              </span>
            );
          })}
        </div>
      )}
      <FilmMediaZoom
        media={zoomSrc ? { src: zoomSrc, type: "image" } : null}
        onClose={() => setZoomSrc(null)}
      />
    </div>
  );
}

export function FilmSceneMissingAttachChips({
  scene,
  characters,
  props,
  sceneImages,
  onOpen,
  onRemove,
}: {
  scene: FilmSceneRecord;
  characters: FilmCharacterRecord[];
  props: FilmPropRecord[];
  sceneImages: FilmSceneImageRecord[];
  onOpen?: (kind: FilmAttachIssueKind, issue: FilmSceneAttachIssue) => void;
  onRemove?: (kind: FilmAttachIssueKind, name: string) => void;
}) {
  const { t } = useTranslation();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const issues = listFilmSceneAttachIssues(scene, characters, props, sceneImages);
  if (!issues.length) return null;

  const openTitle = (kind: FilmAttachIssueKind) => {
    if (kind === "character") return t("Tạo ảnh nhân vật");
    if (kind === "prop") return t("Tạo ảnh vật phẩm");
    return t("Tạo ảnh bối cảnh");
  };

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-0">
      <p className="m-0 text-10 font-semibold text-amber-700">
        {t("Item đã gắn chưa có ảnh — bấm tên để tạo ảnh")}
      </p>
      <ul
        className="m-0 p-0 list-none flex flex-col gap-1 min-h-0 max-h-48 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {issues.map((issue) => {
          const thumb = getFilmEntityImageSrc(issue);
          const hovered = hoveredKey === `${issue.kind}:${issue.name}`;
          const kindLabel =
            issue.kind === "character"
              ? t("Nhân vật")
              : issue.kind === "prop"
              ? t("Vật phẩm")
              : t("Bối cảnh");
          return (
            <li
              key={`${issue.kind}:${issue.name}`}
              onMouseEnter={() => setHoveredKey(`${issue.kind}:${issue.name}`)}
              onMouseLeave={() =>
                setHoveredKey((k) =>
                  k === `${issue.kind}:${issue.name}` ? null : k
                )
              }
              className="relative rounded-lg border min-w-0 flex-shrink-0 bg-blue-50 border-blue-200"
            >
              <div className="flex items-center gap-1.5 p-1 min-w-0">
                <div className="overflow-hidden relative flex-shrink-0 w-9 h-9 bg-white rounded-md border border-blue-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt={issue.name}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex justify-center items-center w-full h-full">
                      <HiOutlinePhotograph className="text-base text-gray-300" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  title={openTitle(issue.kind)}
                  onClick={() => onOpen?.(issue.kind, issue)}
                  disabled={!onOpen}
                  className="flex-1 p-0 min-w-0 text-left bg-transparent border-0 cursor-pointer disabled:cursor-default"
                >
                  <div className="font-semibold leading-tight truncate text-10 text-blue-800">
                    {issue.name}
                  </div>
                  <div className="text-10 text-blue-500/80 truncate leading-tight">
                    {kindLabel}
                    {issue.reason === "missing_entity"
                      ? ` · ${t("Chưa có trong project")}`
                      : ` · ${t("Chưa có ảnh")}`}
                  </div>
                </button>
                {hovered ? (
                  <div className="flex flex-shrink-0 gap-0.5 items-center">
                    {onOpen ? (
                      <button
                        type="button"
                        title={openTitle(issue.kind)}
                        onClick={() => onOpen(issue.kind, issue)}
                        className="flex flex-shrink-0 justify-center items-center w-6 h-6 text-gray-600 bg-white rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50"
                      >
                        <RiMagicFill className="text-sm" />
                      </button>
                    ) : null}
                    {onRemove ? (
                      <button
                        type="button"
                        title={t("Xóa")}
                        onClick={() => onRemove(issue.kind, issue.name)}
                        className="flex flex-shrink-0 justify-center items-center w-6 h-6 text-red-500 bg-white rounded-md border border-red-100 cursor-pointer hover:bg-red-50 hover:text-red-600"
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
    </div>
  );
}
