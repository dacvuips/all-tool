import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  RiArrowDownSLine,
  RiArrowUpSLine,
  RiLayoutGridLine,
  RiMenuLine,
  RiRefreshLine,
  RiSearchLine,
} from "react-icons/ri";
import { voiceCategoryColor } from "./voice-catalog-card";
import { getVoiceTool } from "./voice-tools-config";

export type VoiceFilterValue = {
  capability: string;
  language: string;
  gender: string;
  accent: string;
  engine: string;
  query: string;
  sort: string;
  category: string;
};

export type VoiceCatalogView = "grid" | "list";

const ACCENT = getVoiceTool("voices").color;
const EMPTY_FILTERS: VoiceFilterValue = {
  capability: "",
  language: "",
  gender: "",
  accent: "",
  engine: "",
  query: "",
  sort: "popular",
  category: "",
};

type Option = { value: string; label: string; color?: string };

function FilterSelect({
  value,
  options,
  placeholder,
  onChange,
  menuMinWidth = 0,
}: {
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (value: string) => void;
  menuMinWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 0 });
  const current = options.find((o) => o.value === value);
  const label = value ? current?.label || placeholder : placeholder;
  const labelColor = current?.color || "#1e3a5f";

  const placeMenu = () => {
    const el = btnRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuBox({
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, menuMinWidth),
    });
  };

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const onWin = () => placeMenu();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, menuMinWidth]);

  return (
    <div ref={rootRef} className="relative flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex gap-1.5 items-center px-3 h-9 text-sm font-medium whitespace-nowrap bg-white rounded-lg border ${
          open || value ? "border-gray-300" : "border-gray-200"
        }`}
        style={{ color: labelColor }}
      >
        <span>{label}</span>
        {open ? (
          <RiArrowUpSLine className="text-base" />
        ) : (
          <RiArrowDownSLine className="text-base" />
        )}
      </button>
      {open && (
        <div
          ref={menuRef}
          className="overflow-y-auto fixed z-50 p-2 max-h-72 bg-white rounded-2xl border border-gray-200 shadow-xl"
          style={{
            top: menuBox.top,
            left: menuBox.left,
            width: menuBox.width,
          }}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            const optColor = opt.color || "#111827";
            return (
              <button
                key={opt.value || "all"}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="block px-3 py-2 w-full text-sm font-medium text-left rounded-lg"
                style={{
                  color: optColor,
                  background: selected ? (opt.color ? `${optColor}18` : `${ACCENT}22`) : undefined,
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function VoiceCatalogFilters({
  value,
  view,
  total,
  loading,
  onChange,
  onViewChange,
  heading,
  extra,
}: {
  value: VoiceFilterValue;
  view: VoiceCatalogView;
  total: number | null;
  loading?: boolean;
  onChange: (next: VoiceFilterValue) => void;
  onViewChange: (view: VoiceCatalogView) => void;
  heading?: string;
  extra?: ReactNode;
}) {
  const { t } = useTranslation();
  const [queryDraft, setQueryDraft] = useState(value.query);

  useEffect(() => {
    setQueryDraft(value.query);
  }, [value.query]);

  const genderOptions = useMemo<Option[]>(
    () => [
      { value: "", label: t("Tất cả") },
      { value: "female", label: t("Nữ") },
      { value: "male", label: t("Nam") },
    ],
    [t]
  );
  const categoryOptions = useMemo<Option[]>(
    () => [
      { value: "", label: t("Tất cả") },
      { value: "advertise", label: t("Quảng cáo"), color: voiceCategoryColor("advertise") },
      { value: "sales", label: t("Bán hàng"), color: voiceCategoryColor("sales") },
      { value: "news", label: t("Tin tức"), color: voiceCategoryColor("news") },
      { value: "education", label: t("Giáo dục"), color: voiceCategoryColor("education") },
      { value: "storyteller", label: t("Kể chuyện"), color: voiceCategoryColor("storyteller") },
      { value: "review", label: t("Đánh giá"), color: voiceCategoryColor("review") },
      { value: "audiobook", label: t("Sách nói"), color: voiceCategoryColor("audiobook") },
      { value: "children", label: t("Thiếu nhi"), color: voiceCategoryColor("children") },
      { value: "conversational", label: t("Hội thoại"), color: voiceCategoryColor("conversational") },
      { value: "uncategorized", label: t("Chưa phân loại"), color: voiceCategoryColor("uncategorized") },
    ],
    [t]
  );
  const regionOptions = useMemo<Option[]>(
    () => [
      { value: "", label: t("Tất cả") },
      { value: "south", label: t("Miền Nam") },
      { value: "north", label: t("Miền Bắc") },
    ],
    [t]
  );

  const setField = (patch: Partial<VoiceFilterValue>) => onChange({ ...value, ...patch });
  const applyQuery = () => setField({ query: queryDraft.trim() });

  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap gap-2 items-center py-1 px-2 border bg-gray-50 rounded-xl"
        
      >
        <div className="flex flex-1 gap-2 items-center min-w-0">
          <RiSearchLine className="flex-shrink-0 text-lg" style={{ color: "#1e3a5f" }} />
          <input
            className="w-full text-sm  bg-transparent border-0 outline-none"
            style={{ color: "#1e3a5f" }}
            placeholder={t("Tìm kiếm giọng đọc")}
            value={queryDraft}
            onChange={(e) => setQueryDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyQuery();
            }}
            onBlur={applyQuery}
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <FilterSelect
            value={value.gender}
            options={genderOptions}
            placeholder={t("Giới tính")}
            onChange={(gender) => setField({ gender })}
            menuMinWidth={140}
          />
          <FilterSelect
            value={value.category}
            options={categoryOptions}
            placeholder={t("Phân loại")}
            onChange={(category) => setField({ category })}
            menuMinWidth={180}
          />
          <FilterSelect
            value={value.accent}
            options={regionOptions}
            placeholder={t("Vùng miền")}
            onChange={(accent) => setField({ accent })}
            menuMinWidth={140}
          />
          <button
            type="button"
            onClick={() => {
              setQueryDraft("");
              onChange({ ...EMPTY_FILTERS, capability: value.capability });
            }}
            className="flex flex-shrink-0 justify-center items-center w-9 h-9 bg-white rounded-lg border border-gray-200"
            style={{ color: "#1e3a5f" }}
            title={t("Đặt lại bộ lọc")}
            aria-label={t("Đặt lại bộ lọc")}
          >
            <RiRefreshLine className="text-lg" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-between items-center">
        <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase">
          {heading || t("Dùng nhiều nhất")}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 whitespace-nowrap">
            {loading
              ? t("Đang tải giọng...")
              : t("{{n}} giọng", { n: total != null ? total : "—" })}
          </span>
          {extra}
          <div className="flex overflow-hidden flex-shrink-0 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => onViewChange("grid")}
              className="flex justify-center items-center w-9 h-9"
              style={
                view === "grid"
                  ? { color: ACCENT, background: `${ACCENT}14` }
                  : { color: "#6b7280", background: "#fff" }
              }
              aria-label={t("Lưới")}
            >
              <RiLayoutGridLine />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              className="flex justify-center items-center w-9 h-9 border-l border-gray-200"
              style={
                view === "list"
                  ? { color: ACCENT, background: `${ACCENT}14` }
                  : { color: "#6b7280", background: "#fff" }
              }
              aria-label={t("Danh sách")}
            >
              <RiMenuLine />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
