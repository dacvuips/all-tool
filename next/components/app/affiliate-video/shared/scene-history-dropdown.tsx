/**
 * shared/scene-history-dropdown.tsx
 * Dropdown chọn lịch sử kịch bản – UI thuần, không đọc IndexedDB.
 * Parent (provider) load history từ IndexedDB và truyền props xuống.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBinLine, RiHistoryLine } from "react-icons/ri";

/** Shape chung của mọi entry lưu trong IndexedDB (scene / copy-video / element / trending) */
export interface BaseHistoryItem<TData = unknown> {
  id: string;
  createdAt: number;
  label: string;
  data: TData;
}

export interface SceneHistoryDropdownProps<TData = unknown> {
  items: BaseHistoryItem<TData>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void | Promise<void>;
  /** Tuỳ biến text trong &lt;option&gt; (mặc định: label + số scene) */
  formatOptionLabel?: (item: BaseHistoryItem<TData>) => string;
  className?: string;
}

const SELECT_ARROW_STYLE: React.CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
  paddingRight: "24px",
};

function defaultFormatOptionLabel<TData>(item: BaseHistoryItem<TData>): string {
  const data = item.data as { topicTitle?: string; scenes?: unknown[] } | undefined;
  const topic = data?.topicTitle ? ` – ${data.topicTitle.slice(0, 40)}` : "";
  const count = data?.scenes?.length ?? 0;
  return `${item.label}${topic} (${count} scenes)`;
}

export function SceneHistoryDropdown<TData = unknown>({
  items,
  selectedId,
  onSelect,
  onClear,
  formatOptionLabel = defaultFormatOptionLabel,
  className = "",
}: SceneHistoryDropdownProps<TData>) {
  const { t } = useTranslation();
  const [confirmClear, setConfirmClear] = useState(false);

  if (!items.length) return null;

  const renderActions = () => (
    <>
      <span className="text-[10px] text-gray-400 whitespace-nowrap mr-1">
        {items.length} {t("bản")}
      </span>
      {!confirmClear ? (
        <button
          type="button"
          id="batch-history-clear"
          onClick={() => setConfirmClear(true)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={t("Xóa lịch sử")}
        >
          <RiDeleteBinLine className="text-sm" />
        </button>
      ) : (
        <div className="flex gap-1 items-center">
          <button
            type="button"
            onClick={async () => {
              await onClear();
              setConfirmClear(false);
            }}
            className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md cursor-pointer border-0 transition-colors"
          >
            {t("Xóa hết")}
          </button>
          <button
            type="button"
            onClick={() => setConfirmClear(false)}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors"
          >
            {t("Hủy")}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div
      className={`flex flex-col gap-2 mb-2 sm:flex-row sm:items-center bg-gray-50/50 ${className}`}
    >
      <div className="flex justify-between items-center w-full sm:w-auto">
        <div className="flex items-center gap-1.5 text-indigo-500">
          <RiHistoryLine className="text-sm" />
          <span className="text-xs font-semibold whitespace-nowrap">{t("Lịch sử")}</span>
        </div>
        <div className="flex gap-1 items-center sm:hidden">{renderActions()}</div>
      </div>

      <select
        id="batch-history-select"
        value={selectedId || items[0]?.id || ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full sm:flex-1 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 sm:py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all cursor-pointer hover:border-gray-300 appearance-none shadow-sm sm:shadow-none"
        style={SELECT_ARROW_STYLE}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {formatOptionLabel(item)}
          </option>
        ))}
      </select>

      <div className="hidden gap-1 items-center sm:flex">{renderActions()}</div>
    </div>
  );
}
