/**
 * Dialog chọn item từ catalog (Nhân vật / Vật phẩm / Bối cảnh) — ảnh + multi-select.
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiOutlinePhotograph } from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import { getFilmEntityImageSrc } from "./api/generate-film-media";
import {
  FILM_EDIT_DIALOG_BODY_CLASS,
  FILM_EDIT_DIALOG_CLASS,
  FILM_EDIT_DIALOG_FOOTER_CLASS,
  FILM_EDIT_DIALOG_HEADER_CLASS,
  FILM_EDIT_DIALOG_WRAPPER_CLASS,
} from "./film-edit-dialog-shell";
import type {
  FilmCharacterRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
} from "./film-types";

export type FilmCatalogKind = "character" | "prop" | "location";

export type FilmCatalogPickItem = {
  kind: FilmCatalogKind;
  id: string;
  name: string;
};

export const FILM_LINKED_PROP_DND = "application/x-film-linked-prop";

export type FilmLinkedPropDndPayload = {
  propName: string;
  fromKind: FilmCatalogKind;
  fromId: string;
};

export function writeFilmLinkedPropDnd(
  e: { dataTransfer: DataTransfer },
  payload: FilmLinkedPropDndPayload
) {
  const json = JSON.stringify(payload);
  e.dataTransfer.setData(FILM_LINKED_PROP_DND, json);
  e.dataTransfer.setData("text/plain", json);
  e.dataTransfer.effectAllowed = "move";
}

export function readFilmLinkedPropDnd(
  e: { dataTransfer: DataTransfer }
): FilmLinkedPropDndPayload | null {
  try {
    const raw =
      e.dataTransfer.getData(FILM_LINKED_PROP_DND) ||
      e.dataTransfer.getData("text/plain");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FilmLinkedPropDndPayload;
    if (!parsed?.propName || !parsed?.fromKind || !parsed?.fromId) return null;
    return parsed;
  } catch {
    return null;
  }
}

type TabId = "all" | FilmCatalogKind;

type CatalogRow = FilmCatalogPickItem & { src: string };

type Props = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  characters?: FilmCharacterRecord[];
  propsList?: FilmPropRecord[];
  sceneImages?: FilmSceneImageRecord[];
  /** Tên đã gắn — ẩn / disable */
  excludeNames?: string[];
  /** Không cho chọn chính owner */
  excludeIds?: string[];
  onConfirm: (items: FilmCatalogPickItem[]) => void | Promise<void>;
};

export function FilmCatalogPickDialog({
  isOpen,
  onClose,
  title,
  characters = [],
  propsList = [],
  sceneImages = [],
  excludeNames = [],
  excludeIds = [],
  onConfirm,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab("all");
    setQuery("");
    setSelected(new Set());
  }, [isOpen]);

  const excludeNameSet = useMemo(
    () => new Set(excludeNames.map((n) => n.trim().toLowerCase()).filter(Boolean)),
    [excludeNames]
  );
  const excludeIdSet = useMemo(() => new Set(excludeIds.filter(Boolean)), [excludeIds]);

  const rows = useMemo((): CatalogRow[] => {
    const out: CatalogRow[] = [];
    const push = (kind: FilmCatalogKind, id: string, name: string, entity: { imageBlob?: Blob | null; imageUrl?: string; imageUrls?: string[] }) => {
      const n = name.trim();
      if (!n || excludeIdSet.has(id)) return;
      if (excludeNameSet.has(n.toLowerCase())) return;
      out.push({ kind, id, name: n, src: getFilmEntityImageSrc(entity) });
    };
    for (const c of characters) push("character", c.id, c.name, c);
    for (const p of propsList) push("prop", p.id, p.name, p);
    for (const loc of sceneImages) push("location", loc.id, loc.name, loc);
    return out;
  }, [characters, propsList, sceneImages, excludeIdSet, excludeNameSet]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.kind !== tab) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, tab, query]);

  const grouped = useMemo(() => {
    const order: FilmCatalogKind[] = ["character", "prop", "location"];
    return order
      .map((kind) => ({
        kind,
        items: filtered.filter((r) => r.kind === kind),
      }))
      .filter((g) => g.items.length);
  }, [filtered]);

  const keyOf = (r: FilmCatalogPickItem) => `${r.kind}:${r.id}`;

  const toggle = (r: CatalogRow) => {
    const k = keyOf(r);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const handleConfirm = async () => {
    const items = rows.filter((r) => selected.has(keyOf(r)));
    if (!items.length) return;
    setSaving(true);
    try {
      await onConfirm(items.map(({ kind, id, name }) => ({ kind, id, name })));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = (id: TabId, label: string) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTab(id)}
        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
          active
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
        }`}
      >
        {label}
      </button>
    );
  };

  const kindLabel = (kind: FilmCatalogKind) => {
    if (kind === "character") return t("Nhân vật");
    if (kind === "prop") return t("Vật phẩm");
    return t("Bối cảnh");
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || t("Chọn từ danh sách")}
      width="720px"
      maxWidth="95vw"
      wrapperClass={FILM_EDIT_DIALOG_WRAPPER_CLASS}
      dialogClass={FILM_EDIT_DIALOG_CLASS}
      extraHeaderClass={FILM_EDIT_DIALOG_HEADER_CLASS}
      extraBodyClass={FILM_EDIT_DIALOG_BODY_CLASS}
      extraFooterClass={FILM_EDIT_DIALOG_FOOTER_CLASS}
    >
      <div className="flex flex-col min-h-0 px-5 py-3 gap-3" style={{ maxHeight: "calc(100vh - 14rem)" }}>
        <div className="flex flex-wrap gap-1.5 flex-shrink-0">
          {tabBtn("all", t("Tất cả"))}
          {tabBtn("character", t("Nhân vật"))}
          {tabBtn("prop", t("Vật phẩm"))}
          {tabBtn("location", t("Bối cảnh"))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Tìm theo tên...")}
          className="flex-shrink-0 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 space-y-4">
          {grouped.length === 0 ? (
            <p className="m-0 py-8 text-sm text-center text-gray-400">
              {t("Không có item phù hợp")}
            </p>
          ) : (
            grouped.map((g) => (
              <div key={g.kind}>
                <div className="mb-1.5 text-10 font-bold tracking-wider text-gray-400 uppercase">
                  {kindLabel(g.kind)} · {g.items.length}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {g.items.map((item) => {
                    const k = keyOf(item);
                    const on = selected.has(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => toggle(item)}
                        className={`relative flex flex-col overflow-hidden text-left bg-white rounded-xl border-2 cursor-pointer transition-all ${
                          on
                            ? "border-primary shadow-sm"
                            : "border-transparent hover:border-primary"
                        }`}
                      >
                        <div className="relative aspect-square bg-gray-50">
                          {item.src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.src}
                              alt={item.name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex justify-center items-center w-full h-full">
                              <HiOutlinePhotograph className="text-2xl text-gray-300" />
                            </div>
                          )}
                          {on ? (
                            <span className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white">
                              <HiCheck className="text-xs" />
                            </span>
                          ) : null}
                        </div>
                        <span className="px-1.5 py-1 text-10 font-medium text-gray-700 truncate">
                          {item.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <Dialog.Footer>
        <Button
          outline
          text={t("Hủy")}
          className="!rounded-xl"
          onClick={onClose}
          disabled={saving}
        />
        <Button
          primary
          text={t("Gắn ({{n}})", { n: selected.size })}
          className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
          disabled={!selected.size || saving}
          isLoading={saving}
          onClick={() => void handleConfirm()}
        />
      </Dialog.Footer>
    </Dialog>
  );
}
