import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiClock,
  HiOutlinePause,
  HiOutlinePhotograph,
  HiOutlineTrash,
  HiPencil,
  HiPlay,
  HiRefresh,
} from "react-icons/hi";
import { RiFileExcel2Line, RiLinkM } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Button, Field, Input, Switch } from "../../shared/utilities/form";
import { exportAffiliatePlusCSV, parseAffiliatePlusCSV } from "../csv-parser";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  STATUS_COLORS,
  STATUS_LABELS,
  ThreadStatus,
  getTotalVideos,
} from "../types";

type EditField = "shopName" | "shopId" | "cookie" | "hostPort" | null;

interface ThreadManagementPanelProps {
  items: AffiliatePlusItem[];
  settings: AffiliatePlusSettings;
  isGlobalRunning: boolean;
  onUpdateItems: (items: AffiliatePlusItem[]) => void;
  onAddLog: (message: string, level?: AffiliatePlusLog["level"], threadId?: string) => void;
}

const COUNTRY_FLAGS: Record<string, string> = {
  VN: "🇻🇳",
  TH: "🇹🇭",
  ID: "🇮🇩",
  MY: "🇲🇾",
  PH: "🇵🇭",
  SG: "🇸🇬",
};

function truncate(str: string, len = 28) {
  if (!str) return "—";
  return str.length > len ? `${str.slice(0, len)}...` : str;
}

export function ThreadManagementPanel({
  items,
  settings,
  isGlobalRunning,
  onUpdateItems,
  onAddLog,
}: ThreadManagementPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editField, setEditField] = useState<EditField>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const stats = useMemo(() => {
    const total = items.length;
    const waiting = items.filter((i) => i.status === "waiting" || (i.status === "stopped" && i.pending > 0)).length;
    const uploading = items.filter((i) => i.status === "uploading" || i.status === "running").length;
    const success = items.filter((i) => i.status === "success").length;
    const error = items.filter((i) => i.status === "error").length;
    return { total, waiting, uploading, success, error };
  }, [items]);

  const selectedCount = items.filter((i) => i.selected).length;

  const updateItem = (id: string, patch: Partial<AffiliatePlusItem>) => {
    onUpdateItems(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const updateAll = (fn: (item: AffiliatePlusItem) => AffiliatePlusItem) => {
    onUpdateItems(items.map(fn));
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseAffiliatePlusCSV(e.target?.result as string);
        if (!parsed.length) {
          toast.warn(t("File CSV trống hoặc không hợp lệ"));
          return;
        }
        onUpdateItems([...items, ...parsed]);
        onAddLog(t("Đã import {{count}} luồng từ CSV", { count: parsed.length }), "success");
        toast.success(t("Đã import {{count}} luồng", { count: parsed.length }));
      } catch {
        toast.error(t("Không thể đọc file CSV"));
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleRetryErrors = () => {
    const errorItems = items.filter((i) => i.status === "error");
    if (!errorItems.length) {
      toast.warn(t("Không có luồng lỗi"));
      return;
    }
    onUpdateItems(
      items.map((i) =>
        i.status === "error"
          ? { ...i, status: "waiting" as ThreadStatus, error: "", countdown: 0 }
          : i
      )
    );
    onAddLog(t("Retry {{count}} luồng lỗi", { count: errorItems.length }), "warning");
    toast.success(t("Đã đưa {{count}} luồng vào hàng chờ", { count: errorItems.length }));
  };

  const handleDeleteErrorTasks = () => {
    const errorItems = items.filter((i) => i.status === "error");
    if (!errorItems.length) {
      toast.warn(t("Không có task lỗi"));
      return;
    }
    if (!confirm(t("Xóa {{count}} task lỗi?", { count: errorItems.length }))) return;
    onUpdateItems(items.filter((i) => i.status !== "error"));
    onAddLog(t("Đã xóa {{count}} task lỗi", { count: errorItems.length }), "warning");
  };

  const handleStart = (ids?: string[]) => {
    const targets = ids
      ? items.filter((i) => ids.includes(i.id))
      : items.filter((i) => i.selected || i.status === "waiting" || i.status === "stopped");
    if (!targets.length) {
      toast.warn(t("Không có luồng để chạy"));
      return;
    }
    onUpdateItems(
      items.map((i) => {
        const shouldStart = ids ? ids.includes(i.id) : i.selected || i.status === "waiting" || i.status === "stopped";
        if (!shouldStart || i.status === "success") return i;
        return {
          ...i,
          status: "running" as ThreadStatus,
          error: "",
          countdown: i.delayMin + Math.floor(Math.random() * (i.delayMax - i.delayMin)),
          selected: false,
        };
      })
    );
    onAddLog(t("Bắt đầu {{count}} luồng", { count: targets.length }), "info");
    toast.success(t("Đã bắt đầu {{count}} luồng", { count: targets.length }));
  };

  const handlePause = (ids?: string[]) => {
    onUpdateItems(
      items.map((i) => {
        const shouldPause = ids
          ? ids.includes(i.id)
          : i.selected || i.status === "running" || i.status === "uploading";
        if (!shouldPause) return i;
        return { ...i, status: "stopped" as ThreadStatus, selected: false };
      })
    );
    onAddLog(t("Tạm dừng luồng"), "warning");
    toast.success(t("Đã tạm dừng"));
  };

  const handleDeleteSelected = () => {
    const selected = items.filter((i) => i.selected);
    if (!selected.length) {
      toast.warn(t("Chưa chọn luồng nào"));
      return;
    }
    if (!confirm(t("Xóa {{count}} luồng đã chọn?", { count: selected.length }))) return;
    onUpdateItems(items.filter((i) => !i.selected));
    onAddLog(t("Xóa {{count}} luồng", { count: selected.length }), "warning");
  };

  const handleDelete = (id: string) => {
    onUpdateItems(items.filter((i) => i.id !== id));
    onAddLog(t("Xóa luồng"), "warning", id);
  };

  const openEdit = (item: AffiliatePlusItem, field: EditField) => {
    if (!field) return;
    setEditItemId(item.id);
    setEditField(field);
    setEditValue(item[field] || "");
  };

  const saveEdit = () => {
    if (!editItemId || !editField) return;
    updateItem(editItemId, { [editField]: editValue } as Partial<AffiliatePlusItem>);
    setEditItemId(null);
    setEditField(null);
    toast.success(t("Đã cập nhật"));
  };

  const changeProxy = (id: string) => {
    const ports = ["192.168.1.1:8080", "10.0.0.5:3128", "proxy.local:9050", "127.0.0.1:7890"];
    const next = ports[Math.floor(Math.random() * ports.length)];
    updateItem(id, { hostPort: next });
    onAddLog(t("Đổi proxy → {{proxy}}", { proxy: next }), "info", id);
    toast.success(t("Đã đổi proxy"));
  };

  const toggleSelectAll = (checked: boolean) => {
    updateAll((i) => ({ ...i, selected: checked }));
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: t("Tổng"), value: stats.total, color: "bg-sky-500" },
          { label: t("Chờ"), value: stats.waiting, color: "bg-amber-500" },
          { label: t("Đang upload"), value: stats.uploading, color: "bg-cyan-500" },
          { label: t("Thành công"), value: stats.success, color: "bg-emerald-500" },
          { label: t("Lỗi"), value: stats.error, color: "bg-rose-500" },
        ].map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm"
          >
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-xs text-gray-500">{s.label}</span>
            <span className="text-sm font-bold text-gray-800">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm hover:shadow-md transition-all"
            style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}
          >
            <RiFileExcel2Line className="text-lg mr-1.5" />
            {t("Nhập Excel & Tạo Luồng")}
          </button>
          <button
            type="button"
            onClick={handleRetryErrors}
            disabled={stats.error === 0}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:opacity-40 transition-colors"
          >
            <HiRefresh className="inline mr-1" />
            {t("Retry Lỗi")}
          </button>
          <button
            type="button"
            onClick={handleDeleteErrorTasks}
            disabled={stats.error === 0}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 disabled:opacity-40 transition-colors"
          >
            {t("Xóa Tasks")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-xs text-gray-600">
            <HiClock />
            {t("Chạy lại lúc")} {settings.scheduleTime} SA
          </span>
          <button
            type="button"
            onClick={() => {
              onAddLog(t("Check 24h hoàn tất"), "info");
              toast.success(t("Đã kiểm tra 24h"));
            }}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors"
          >
            Check 24h
          </button>
          <button
            type="button"
            onClick={() => handleStart()}
            disabled={isGlobalRunning && stats.uploading > 0}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-sm transition-colors"
          >
            {t("Bắt Đầu")}
          </button>
          <button
            type="button"
            onClick={() => handlePause()}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-sm transition-colors"
          >
            {t("Tạm Dừng")}
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedCount === 0}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-sm disabled:opacity-40 transition-colors"
          >
            {t("Xóa Chọn")} {selectedCount > 0 && `(${selectedCount})`}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400">
            {t("Chưa có luồng. Nhấn \"Nhập Excel & Tạo Luồng\" để bắt đầu.")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm">
              <thead>
                <tr className="bg-slate-800 text-white text-xs uppercase tracking-wide">
                  <th className="px-3 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every((i) => i.selected)}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-3 text-left w-10">#</th>
                  <th className="px-3 py-3 text-left">{t("Tên shop")}</th>
                  <th className="px-3 py-3 text-left">ID</th>
                  <th className="px-3 py-3 text-left">{t("Hoa hồng")}</th>
                  <th className="px-3 py-3 text-center">{t("Ảnh")}</th>
                  <th className="px-3 py-3 text-left">Video</th>
                  <th className="px-3 py-3 text-left">Uploaded</th>
                  <th className="px-3 py-3 text-center">Pending</th>
                  <th className="px-3 py-3 text-left">Delay</th>
                  <th className="px-3 py-3 text-left">Host Port</th>
                  <th className="px-3 py-3 text-left">{t("Lỗi")}</th>
                  <th className="px-3 py-3 text-center">{t("Trạng thái")}</th>
                  <th className="px-3 py-3 text-center w-32">{t("Thao tác")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => {
                  const total = getTotalVideos(item);
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-sky-50/30 transition-colors ${
                        item.selected ? "bg-sky-50/50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                      }`}
                    >
                      <td className="px-3 py-2.5">
                        <Switch
                          value={item.selected}
                          onChange={(val) => updateItem(item.id, { selected: val })}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800">{item.shopName || "—"}</span>
                          <button
                            type="button"
                            onClick={() => openEdit(item, "shopName")}
                            className="text-sky-500 hover:text-sky-700"
                          >
                            <HiPencil className="text-xs" />
                          </button>
                        </div>
                        {item.cookie && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-10 text-gray-400 font-mono">{truncate(item.cookie, 20)}</span>
                            <button type="button" onClick={() => openEdit(item, "cookie")} className="text-sky-400">
                              <HiPencil className="text-10" />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono text-gray-600">{item.shopId || "—"}</code>
                          <button type="button" onClick={() => openEdit(item, "shopId")} className="text-sky-500">
                            <HiPencil className="text-xs" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span>{COUNTRY_FLAGS[item.country] || "🌐"}</span>
                          <span className="text-10 text-gray-400">{item.country}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {item.commission ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {item.commission}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex justify-center">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-400">
                              <HiOutlinePhotograph />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-800 text-xs font-medium"
                          onClick={() => openEdit(item, "shopName")}
                        >
                          <RiLinkM />
                          {item.videoUrls.length || total} video
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-gray-800">
                          {item.uploaded}/{total}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200">
                            {item.pending}
                          </span>
                          {item.status === "running" && item.countdown > 0 ? (
                            <span className="text-10 text-amber-600 font-medium">{item.countdown}s</span>
                          ) : item.status === "waiting" ? (
                            <span className="text-10 text-emerald-600">{t("Sẵn sàng")}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">
                        {item.delayMin}-{item.delayMax}s
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono text-gray-600 max-w-[120px] truncate">
                            {item.hostPort || "—"}
                          </span>
                          <button type="button" onClick={() => openEdit(item, "hostPort")} className="text-sky-500">
                            <HiPencil className="text-xs" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => changeProxy(item.id)}
                          className="mt-1 text-10 text-sky-600 hover:underline"
                        >
                          {t("Đổi Proxy")}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 max-w-[180px]">
                        {item.error ? (
                          <span className="text-xs text-rose-600 line-clamp-2" title={item.error}>
                            {item.error}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            STATUS_COLORS[item.status]
                          }`}
                        >
                          {t(STATUS_LABELS[item.status])}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStart([item.id])}
                            disabled={item.status === "success" || item.status === "running"}
                            className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 disabled:opacity-30 transition-colors shadow-sm"
                            title={t("Chạy")}
                          >
                            <HiPlay className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePause([item.id])}
                            disabled={item.status !== "running" && item.status !== "uploading"}
                            className="w-8 h-8 rounded-full bg-amber-400 text-white flex items-center justify-center hover:bg-amber-500 disabled:opacity-30 transition-colors shadow-sm"
                            title={t("Tạm dừng")}
                          >
                            <HiOutlinePause className="text-sm" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors shadow-sm"
                            title={t("Xóa")}
                          >
                            <HiOutlineTrash className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick export */}
      {items.length > 0 && (
        <div className="flex justify-end">
          <Button
            text={t("Xuất CSV")}
            onClick={() => {
              const csv = exportAffiliatePlusCSV(items);
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `video-affiliate-plus-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
        </div>
      )}

      {/* Inline edit dialog */}
      <Dialog
        isOpen={!!editItemId && !!editField}
        onClose={() => {
          setEditItemId(null);
          setEditField(null);
        }}
        width="420px"
        title={t("Chỉnh sửa")}
      >
        <Dialog.Body>
          <Field label={editField || ""}>
            <Input value={editValue} onChange={setEditValue} />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button
            text={t("Hủy")}
            onClick={() => {
              setEditItemId(null);
              setEditField(null);
            }}
          />
          <Button primary text={t("Lưu")} onClick={saveEdit} />
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}