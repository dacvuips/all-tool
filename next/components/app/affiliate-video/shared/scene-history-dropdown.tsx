/**
 * shared/scene-history-dropdown.tsx
 * Dropdown chọn lịch sử kịch bản – UI thuần, không đọc IndexedDB.
 * Parent (provider) load history từ IndexedDB và truyền props xuống.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBin6Line, RiDeleteBinLine, RiHistoryLine } from "react-icons/ri";

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
  /** Xóa phiên đang chọn (tuỳ chọn — hiện nút riêng). */
  onDeleteSelected?: () => void | Promise<void>;
  /** Tuỳ biến text trong &lt;option&gt; (mặc định: label + số scene) */
  formatOptionLabel?: (item: BaseHistoryItem<TData>) => string;
  /** Tooltip nút xóa phiên đang chọn */
  deleteSelectedTitle?: string;
  /** Nhãn xác nhận xóa phiên đang chọn */
  deleteSelectedConfirmLabel?: string;
  /** Tooltip nút xóa tất cả */
  clearTitle?: string;
  /** Nhãn nút xác nhận xóa tất cả */
  clearConfirmLabel?: string;
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

function HistoryConfirmButtons({
  confirmLabel,
  onConfirm,
  onCancel,
  confirmClassName = "text-white bg-red-500 hover:bg-red-600",
}: {
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  confirmClassName?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 items-center">
      <button
        type="button"
        onClick={() => void onConfirm()}
        className={`text-[10px] font-semibold px-2 py-1 rounded-md cursor-pointer border-0 transition-colors ${confirmClassName}`}
      >
        {confirmLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors"
      >
        {t("Hủy")}
      </button>
    </div>
  );
}

export function SceneHistoryDropdown<TData = unknown>({
  items,
  selectedId,
  onSelect,
  onClear,
  onDeleteSelected,
  formatOptionLabel = defaultFormatOptionLabel,
  deleteSelectedTitle,
  deleteSelectedConfirmLabel,
  clearTitle,
  clearConfirmLabel,
  className = "",
}: SceneHistoryDropdownProps<TData>) {
  const { t } = useTranslation();
  const [confirmDeleteSelected, setConfirmDeleteSelected] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!items.length) return null;

  const cancelConfirm = () => {
    setConfirmDeleteSelected(false);
    setConfirmClearAll(false);
  };

  const renderActions = () => (
    <>
      <span className="text-[10px] text-gray-400 whitespace-nowrap mr-1">
        {items.length} {t("bản")}
      </span>
      {onDeleteSelected ? (
        confirmDeleteSelected ? (
          <HistoryConfirmButtons
            confirmLabel={deleteSelectedConfirmLabel || t("Xóa phiên")}
            confirmClassName="text-white bg-red-500 hover:bg-red-600"
            onConfirm={async () => {
              await onDeleteSelected();
              setConfirmDeleteSelected(false);
            }}
            onCancel={cancelConfirm}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmClearAll(false);
              setConfirmDeleteSelected(true);
            }}
            disabled={!selectedId}
            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
            title={deleteSelectedTitle || t("Xóa phiên đang chọn + video IndexedDB")}
          >
            <RiDeleteBinLine className="text-sm" />
          </button>
        )
      ) : null}
      {confirmClearAll ? (
        <HistoryConfirmButtons
          confirmLabel={clearConfirmLabel || t("Xóa hết")}
          onConfirm={async () => {
            await onClear();
            setConfirmClearAll(false);
          }}
          onCancel={cancelConfirm}
        />
      ) : (
        <button
          type="button"
          id="batch-history-clear"
          onClick={() => {
            setConfirmDeleteSelected(false);
            setConfirmClearAll(true);
          }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={clearTitle || t("Xóa tất cả lịch sử")}
        >
          <RiDeleteBin6Line className="text-sm" />
        </button>
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
