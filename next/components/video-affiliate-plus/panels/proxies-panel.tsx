/**
 * proxies-panel.tsx — Quản lý Proxy (host:port:user:pass)
 * Import: Excel/CSV, TXT, nhập thủ công · CRUD · tải mẫu
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiDownload,
  HiOutlineTrash,
  HiPencil,
  HiPlus,
  HiUpload,
} from "react-icons/hi";
import { RiArrowDownSLine, RiFileTextLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Popover } from "../../shared/utilities/popover/popover";
import { downloadCsvText } from "../scrape/api";
import {
  PanelListCard,
  PanelListMatchCount,
  PanelListSearch,
  PanelListToolbar,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusProxy, buildProxyRaw, parseProxyLine } from "../types";

interface ProxiesPanelProps {
  proxies: AffiliatePlusProxy[];
  onUpdateProxies: (proxies: AffiliatePlusProxy[]) => void;
}

const SAMPLE_PROXIES_CSV =
  "\uFEFF" +
  [
    "host:port:user:pass",
    "1.2.3.4:8080:user1:pass1",
    "5.6.7.8:3128:user2:pass2",
    "proxy.example.com:8000:myuser:mypass",
  ].join("\n");

function downloadSampleExcel() {
  downloadCsvText(SAMPLE_PROXIES_CSV, "mau-quan-ly-proxy.csv");
}

function makeProxy(
  partial: Partial<AffiliatePlusProxy> & Pick<AffiliatePlusProxy, "host" | "port">
): AffiliatePlusProxy {
  const raw =
    partial.raw ||
    buildProxyRaw({
      host: partial.host,
      port: partial.port,
      username: partial.username,
      password: partial.password,
    });
  return {
    id: partial.id || crypto.randomUUID(),
    host: partial.host,
    port: partial.port,
    username: partial.username || "",
    password: partial.password || "",
    raw,
    note: partial.note || "",
    error: partial.error || "",
    active: partial.active !== false,
    createdAt: partial.createdAt || new Date().toISOString(),
  };
}

export function ProxiesPanel({ proxies, onUpdateProxies }: ProxiesPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLButtonElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editItem, setEditItem] = useState<AffiliatePlusProxy | null>(null);
  const [form, setForm] = useState({
    host: "",
    port: "",
    username: "",
    password: "",
    note: "",
    raw: "",
  });
  const [isNew, setIsNew] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualText, setManualText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const stats = useMemo(() => {
    const total = proxies.length;
    const active = proxies.filter((p) => p.active !== false).length;
    const withAuth = proxies.filter((p) => Boolean(p.username || p.password)).length;
    return { total, active, withAuth, inactive: total - active };
  }, [proxies]);

  const normalizedTerm = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  const filtered = useMemo(() => {
    if (!normalizedTerm) return proxies;
    return proxies.filter((p) => {
      const haystack = [p.host, p.port, p.username, p.raw, p.note, p.error].join(" ").toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [proxies, normalizedTerm]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  const toggleSelectVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((p) => {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const openNew = () => {
    setForm({ host: "", port: "", username: "", password: "", note: "", raw: "" });
    setIsNew(true);
    setEditItem({} as AffiliatePlusProxy);
  };

  const openEdit = (item: AffiliatePlusProxy) => {
    setForm({
      host: item.host,
      port: item.port,
      username: item.username || "",
      password: item.password || "",
      note: item.note || "",
      raw: item.raw || "",
    });
    setIsNew(false);
    setEditItem(item);
  };

  const applyRawToForm = (raw: string) => {
    const parsed = parseProxyLine(raw);
    if (!parsed) return;
    setForm((f) => ({
      ...f,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      password: parsed.password,
      raw: parsed.raw,
    }));
  };

  const handleSave = () => {
    let host = form.host.trim();
    let port = form.port.trim();
    let username = form.username.trim();
    let password = form.password.trim();

    if ((!host || !port) && form.raw.trim()) {
      const parsed = parseProxyLine(form.raw.trim());
      if (parsed) {
        host = parsed.host;
        port = parsed.port;
        username = parsed.username;
        password = parsed.password;
      }
    }

    if (!host || !port) {
      toast.warn(t("Vui lòng nhập host và port (hoặc host:port:user:pass)"));
      return;
    }
    if (!/^\d+$/.test(port)) {
      toast.warn(t("Port phải là số"));
      return;
    }

    const next = makeProxy({
      id: isNew ? undefined : editItem?.id,
      host,
      port,
      username,
      password,
      note: form.note.trim(),
      active: true,
      createdAt: isNew ? undefined : editItem?.createdAt,
    });

    if (isNew) {
      const dup = proxies.some(
        (p) =>
          p.raw === next.raw ||
          (p.host === next.host && p.port === next.port && p.username === next.username)
      );
      if (dup) {
        toast.warn(t("Proxy này đã tồn tại"));
        return;
      }
      onUpdateProxies([...proxies, next]);
      toast.success(t("Đã thêm proxy"));
    } else if (editItem) {
      const dup = proxies.some(
        (p) =>
          p.id !== editItem.id &&
          (p.raw === next.raw ||
            (p.host === next.host && p.port === next.port && p.username === next.username))
      );
      if (dup) {
        toast.warn(t("Proxy này đã tồn tại"));
        return;
      }
      onUpdateProxies(
        proxies.map((p) => (p.id === editItem.id ? { ...next, id: editItem.id } : p))
      );
      toast.success(t("Đã cập nhật proxy"));
    }
    setEditItem(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("Xóa proxy này?"))) return;
    onUpdateProxies(proxies.filter((p) => p.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success(t("Đã xóa"));
  };

  const handleDeleteSelected = () => {
    if (!selectedIds.size) return;
    if (!confirm(t("Xóa {{count}} proxy đã chọn?", { count: selectedIds.size }))) return;
    onUpdateProxies(proxies.filter((p) => !selectedIds.has(p.id)));
    setSelectedIds(new Set());
    toast.success(t("Đã xóa {{count}} proxy", { count: selectedIds.size }));
  };

  const parseProxyText = (text: string): AffiliatePlusProxy[] => {
    const seen = new Set<string>();
    const list: AffiliatePlusProxy[] = [];
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    for (const line of cleaned.split(/\r?\n/)) {
      const parsed = parseProxyLine(line);
      if (!parsed) continue;
      const key = parsed.raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(makeProxy(parsed));
    }
    return list;
  };

  const mergeImported = (imported: AffiliatePlusProxy[]) => {
    if (!imported.length) {
      toast.warn(t("Không đọc được proxy — mỗi dòng: host:port:user:pass"));
      return;
    }
    const existingKeys = new Set(proxies.map((p) => p.raw.toLowerCase()).filter(Boolean));
    const fresh = imported.filter((p) => {
      const key = p.raw.toLowerCase();
      if (!key || existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });
    const skipped = imported.length - fresh.length;
    if (!fresh.length) {
      toast.warn(t("Tất cả proxy đã tồn tại — không thêm mới"));
      return;
    }
    onUpdateProxies([...proxies, ...fresh]);
    toast.success(
      skipped > 0
        ? t("Đã nhập {{count}} proxy (bỏ trùng {{skipped}})", {
            count: fresh.length,
            skipped,
          })
        : t("Đã nhập {{count}} proxy", { count: fresh.length })
    );
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    mergeImported(parseProxyText(text));
  };

  const handleManualImport = () => {
    const imported = parseProxyText(manualText);
    if (!imported.length) {
      toast.warn(t("Không đọc được proxy. Mỗi dòng: host:port:user:pass"));
      return;
    }
    mergeImported(imported);
    setManualText("");
    setShowManual(false);
  };

  const exportTxt = () => {
    const body = proxies
      .map((p) => p.raw)
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([body + (body ? "\n" : "")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-affiliate-proxies-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: t("Tổng"),
            value: stats.total,
            bg: "#e0f2fe",
            border: "#38bdf8",
            text: "#0284c7",
            dot: "#0ea5e9",
          },
          {
            label: t("Đang bật"),
            value: stats.active,
            bg: "#ecfdf5",
            border: "#34d399",
            text: "#059669",
            dot: "#10b981",
          },
          {
            label: t("Có auth"),
            value: stats.withAuth,
            bg: "#fef3c7",
            border: "#fbbf24",
            text: "#d97706",
            dot: "#f59e0b",
          },
          {
            label: t("Tắt"),
            value: stats.inactive,
            bg: "#f8fafc",
            border: "#cbd5e1",
            text: "#475569",
            dot: "#94a3b8",
          },
        ].map((s) => (
          <div
            key={String(s.label)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-sm font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-3 justify-between lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.xlsx,.xls,text/plain,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = "";
              }}
            />
            <button
              ref={addMenuRef}
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <HiPlus className="text-base" />
              {t("Thêm / Nhập")}
              <RiArrowDownSLine className="text-sm opacity-80" />
            </button>
            <Popover
              reference={addMenuRef}
              trigger="click"
              placement="bottom-start"
              arrow={false}
              maxWidth={280}
              visible={addMenuOpen}
              hideOnClickOutside
              zIndex={10050}
              onHidden={() => setAddMenuOpen(false)}
              onClickOutside={() => setAddMenuOpen(false)}
            >
              <div className="py-1 min-w-[240px]">
                {[
                  {
                    label: t("Thêm Proxy"),
                    hint: t("Nhập host / port / user / pass"),
                    icon: <HiPlus className="text-base text-blue-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      openNew();
                    },
                  },
                  {
                    label: t("Nhập thủ công"),
                    hint: t("Dán nhiều dòng host:port:user:pass"),
                    icon: <HiPencil className="text-base text-indigo-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      setShowManual(true);
                    },
                  },
                  {
                    label: t("Nhập TXT / Excel"),
                    hint: t("File TXT/CSV — mỗi dòng 1 proxy"),
                    icon: <RiFileTextLine className="text-base text-blue-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      fileInputRef.current?.click();
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex gap-2.5 items-start px-3 py-2 w-full text-left transition-colors hover:bg-gray-50"
                    onClick={item.action}
                  >
                    <span className="mt-0.5 shrink-0">{item.icon}</span>
                    <span>
                      <span className="block text-xs font-medium text-gray-800">{item.label}</span>
                      <span className="block mt-0.5 text-[11px] text-gray-400">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Popover>
            <button
              type="button"
              onClick={downloadSampleExcel}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }}
            >
              <HiDownload className="text-base" />
              {t("Tải mẫu nhập proxy")}
            </button>
            <button
              type="button"
              onClick={exportTxt}
              disabled={!proxies.length}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !proxies.length
                  ? undefined
                  : { backgroundColor: "#ecfdf5", borderColor: "#34d399", color: "#059669" }
              }
            >
              <HiDownload className="text-base" />
              {t("Xuất TXT")}
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100"
              >
                <HiOutlineTrash className="text-base" />
                {t("Xóa đã chọn")} ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {t("Định dạng mỗi dòng")}:{" "}
          <code className="px-1.5 py-0.5 bg-gray-100 rounded text-pink-600">
            host:port:user:pass
          </code>
        </p>
      </div>

      <PanelListCard>
        {proxies.length === 0 ? (
          <div className={panelListClasses.empty}>{t("Chưa có proxy")}</div>
        ) : (
          <>
            <PanelListToolbar
              trailing={
                <PanelListMatchCount
                  term={normalizedTerm}
                  matched={filtered.length}
                  total={proxies.length}
                />
              }
            >
              <PanelListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("Tìm host / port / user...") as string}
              />
            </PanelListToolbar>

            <div className="overflow-x-auto">
              <table className={panelListClasses.table} style={{ minWidth: 900 }}>
                <thead>
                  <tr className={panelListClasses.theadTr}>
                    <th className={`${panelListClasses.th} w-12`}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectVisible(e.target.checked)}
                        className={panelListClasses.checkbox}
                      />
                    </th>
                    <th className={`${panelListClasses.th} w-10 text-left`}>#</th>
                    <th className={`${panelListClasses.th} text-left`}>Host</th>
                    <th className={`${panelListClasses.th} text-left`}>Port</th>
                    <th className={`${panelListClasses.th} text-left`}>User</th>
                    <th className={`${panelListClasses.th} text-left`}>Pass</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Chuỗi đầy đủ")}</th>
                    <th className={`${panelListClasses.th} w-32 text-center`}>{t("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className={panelListClasses.emptyMatch}>
                        {t("Không có proxy nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item, index) => (
                      <tr
                        key={item.id}
                        className={panelListRowClass({ selected: selectedIds.has(item.id) })}
                      >
                        <td className={panelListClasses.td}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={(e) => toggleSelectOne(item.id, e.target.checked)}
                            className={panelListClasses.checkbox}
                          />
                        </td>
                        <td className={`${panelListClasses.td} font-mono text-xs text-gray-400`}>
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{item.host}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">{item.port}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {item.username || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {item.password ? "••••••" : "-"}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 360 }}>
                          <span
                            className="inline-block px-2 py-1 max-w-full font-mono text-xs text-pink-600 truncate bg-pink-50 rounded border border-pink-100"
                            title={item.raw}
                          >
                            {item.raw}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="flex justify-center items-center w-8 h-8 text-blue-600 bg-blue-50 rounded-full border border-blue-200 shadow-sm hover:bg-blue-100"
                              title={t("Sửa")}
                            >
                              <HiPencil className="text-sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="flex justify-center items-center w-8 h-8 rounded-full border shadow-sm text-danger bg-danger-light border-danger hover:opacity-90"
                              title={t("Xóa")}
                            >
                              <HiOutlineTrash className="text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelListCard>

      <Dialog
        isOpen={!!editItem}
        onClose={() => setEditItem(null)}
        title={isNew ? t("Thêm Proxy") : t("Chỉnh Sửa Proxy")}
        icon={isNew ? <HiPlus /> : <HiPencil />}
        width="520px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
      >
        <Dialog.Body>
          <div className="pt-2 space-y-4">
            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Dán nhanh")} (host:port:user:pass)
              </span>
              <input
                value={form.raw}
                onChange={(e) => {
                  const raw = e.target.value;
                  setForm((f) => ({ ...f, raw }));
                  applyRawToForm(raw);
                }}
                placeholder="1.2.3.4:8080:user:pass"
                className="px-3 w-full h-10 font-mono text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">Host</span>
                <input
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>
              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">Port</span>
                <input
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">User</span>
                <input
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>
              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">Pass</span>
                <input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">{t("Ghi chú")}</span>
              <input
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <button
              type="button"
              onClick={() => setEditItem(null)}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 h-9 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              {t("Lưu")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={showManual}
        onClose={() => setShowManual(false)}
        title={t("Nhập thủ công Proxy")}
        icon={<HiUpload />}
        width="560px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
      >
        <Dialog.Body>
          <div className="pt-2 space-y-3">
            <p className="text-xs text-gray-500">
              {t("Mỗi dòng một proxy")}: <code className="text-pink-600">host:port:user:pass</code>
            </p>
            <textarea
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={12}
              placeholder={"1.2.3.4:8080:user1:pass1\n5.6.7.8:3128:user2:pass2"}
              className="px-3 py-2 w-full font-mono text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
            />
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowManual(false)}
              className="px-4 h-9 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              onClick={handleManualImport}
              className="px-4 h-9 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              {t("Nhập")}
            </button>
          </div>
        </Dialog.Footer>
      </Dialog>
    </div>
  );
}
