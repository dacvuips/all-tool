import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiDownload,
  HiOutlineTrash,
  HiOutlineX,
  HiPencil,
  HiPlus,
  HiSearch,
  HiUpload,
} from "react-icons/hi";
import { RiFileTextLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { downloadCsvText } from "../scrape/api";
import { AffiliatePlusUser } from "../types";

interface UsersPanelProps {
  users: AffiliatePlusUser[];
  onUpdateUsers: (users: AffiliatePlusUser[]) => void;
}

const SAMPLE_USERS_CSV =
  "\uFEFF" +
  [
    "Username,Cookie,Proxy",
    "ACC001,cookie_here,host:port:user:pass",
    "ACC002,cookie_here,host:port:user:pass",
  ].join("\n");

function downloadSampleExcel() {
  downloadCsvText(SAMPLE_USERS_CSV, "mau-quan-ly-nguoi-dung.csv");
}

export function UsersPanel({ users, onUpdateUsers }: UsersPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const txtInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const [editUser, setEditUser] = useState<AffiliatePlusUser | null>(null);
  const [form, setForm] = useState({ username: "", cookie: "", proxy: "" });
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active !== false).length;
    const inactive = total - active;
    const error = users.filter((u) => Boolean(String(u.error || "").trim())).length;
    return { total, active, inactive, error };
  }, [users]);

  const normalizedTerm = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  const filteredUsers = useMemo(() => {
    if (!normalizedTerm) return users;
    return users.filter((user) => {
      const haystack = [
        user.username,
        user.email,
        user.cookie,
        user.proxy,
        user.error,
        user.generateItems?.map((g) => g.productName).join(" "),
        user.generateItems?.map((g) => g.productId).join(" "),
        user.generateItems?.map((g) => g.caption).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [users, normalizedTerm]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));

  const toggleSelectVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => {
        if (checked) next.add(u.id);
        else next.delete(u.id);
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
    setForm({ username: "", cookie: "", proxy: "" });
    setIsNew(true);
    setEditUser({} as AffiliatePlusUser);
  };

  const openEdit = (user: AffiliatePlusUser) => {
    setForm({ username: user.username, cookie: user.cookie || "", proxy: user.proxy || "" });
    setIsNew(false);
    setEditUser(user);
  };

  const handleSave = () => {
    if (!form.username.trim()) {
      toast.warn(t("Vui lòng nhập username"));
      return;
    }
    if (isNew) {
      onUpdateUsers([
        ...users,
        {
          id: crypto.randomUUID(),
          username: form.username.trim(),
          email: "",
          role: "user",
          cookie: form.cookie.trim(),
          proxy: form.proxy.trim(),
          error: "",
          active: true,
          createdAt: new Date().toISOString(),
          generateItems: [],
          generateItem: null,
        },
      ]);
      toast.success(t("Đã thêm người dùng"));
    } else if (editUser) {
      onUpdateUsers(
        users.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                username: form.username.trim(),
                cookie: form.cookie.trim(),
                proxy: form.proxy.trim(),
                error: "",
              }
            : u
        )
      );
      toast.success(t("Đã cập nhật"));
    }
    setEditUser(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("Xóa người dùng này?"))) return;
    onUpdateUsers(users.filter((u) => u.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success(t("Đã xóa"));
  };

  const parseUserLines = (text: string): AffiliatePlusUser[] => {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => {
        const lower = line.toLowerCase();
        return !(
          lower.startsWith("username") ||
          lower.startsWith("tên account") ||
          lower.startsWith("ten account")
        );
      })
      .map((line) => {
        const parts = line.split(/[\t|,]/).map((part) => part.trim());
        const [username, cookie = "", proxy = ""] = parts;
        return {
          id: crypto.randomUUID(),
          username,
          email: "",
          role: "user",
          cookie,
          proxy,
          error: "",
          active: true,
          createdAt: new Date().toISOString(),
          generateItems: [],
          generateItem: null,
        };
      })
      .filter((user) => user.username);
  };

  const normalizeImportedUser = (
    raw: Partial<AffiliatePlusUser>,
    index: number
  ): AffiliatePlusUser => ({
    id: raw.id || crypto.randomUUID(),
    username: String(raw.username || raw.email || `USER${index + 1}`).trim(),
    email: String(raw.email || ""),
    role: String(raw.role || "user"),
    cookie: String(raw.cookie || ""),
    proxy: String(raw.proxy || (raw as any).hostPort || ""),
    error: String(raw.error || ""),
    active: raw.active !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
    generateItems: Array.isArray(raw.generateItems)
      ? raw.generateItems
      : raw.generateItem
      ? [raw.generateItem]
      : [],
    generateItem: null,
  });

  const handleImportTxt = async (file: File) => {
    const imported = parseUserLines(await file.text());
    if (!imported.length) {
      toast.warn(t("Không đọc được user từ file TXT"));
      return;
    }
    onUpdateUsers([...users, ...imported]);
    toast.success(t("Đã nhập {{count}} người dùng", { count: imported.length }));
  };

  const handleImportJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const list = Array.isArray(data) ? data : Array.isArray(data?.users) ? data.users : [];
      const imported = list.map(normalizeImportedUser).filter((user) => user.username);
      if (!imported.length) {
        toast.warn(t("Không đọc được user từ JSON"));
        return;
      }
      onUpdateUsers(imported);
      toast.success(t("Đã nhập {{count}} người dùng", { count: imported.length }));
    } catch (err: any) {
      toast.error(err?.message || t("File JSON không hợp lệ"));
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(users, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `video-affiliate-users-${new Date().toISOString().slice(0, 10)}.json`;
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
            label: t("Tắt"),
            value: stats.inactive,
            bg: "#f8fafc",
            border: "#cbd5e1",
            text: "#475569",
            dot: "#94a3b8",
          },
          {
            label: t("Lỗi"),
            value: stats.error,
            bg: "#fff1f2",
            border: "#fb7185",
            text: "#e11d48",
            dot: "#f43f5e",
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
              ref={txtInputRef}
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportTxt(file);
                e.target.value = "";
              }}
            />
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportJson(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={openNew}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <HiPlus className="text-base" />
              {t("Thêm Người Dùng")}
            </button>
            <button
              type="button"
              onClick={() => txtInputRef.current?.click()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3.5 text-sm font-semibold text-blue-700 shadow-sm hover:bg-blue-100"
            >
              <RiFileTextLine className="text-base" />
              {t("Nhập TXT")}
            </button>
            <button
              type="button"
              onClick={() => jsonInputRef.current?.click()}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#ecfeff", borderColor: "#22d3ee", color: "#0891b2" }}
            >
              <HiUpload className="text-base" />
              {t("Nhập JSON")}
            </button>
            <button
              type="button"
              onClick={downloadSampleExcel}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }}
            >
              <HiDownload className="text-base" />
              {t("Tải Excel mẫu")}
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={!users.length}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !users.length
                  ? undefined
                  : { backgroundColor: "#ecfdf5", borderColor: "#34d399", color: "#059669" }
              }
            >
              <HiDownload className="text-base" />
              {t("Xuất JSON")}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden bg-white rounded-xl border border-gray-200 shadow-sm">
        {users.length === 0 ? (
          <div className="py-16 text-sm text-center text-gray-400">{t("Chưa có người dùng")}</div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="relative flex-1 max-w-md" style={{ minWidth: 240 }}>
                <HiSearch className="absolute left-3 top-1/2 text-base text-gray-400 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("Tìm username / cookie / proxy...") as string}
                  className="pr-9 pl-9 w-full h-9 text-sm bg-white rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="flex absolute right-2 top-1/2 justify-center items-center w-6 h-6 text-gray-400 rounded-md -translate-y-1/2 hover:bg-gray-100 hover:text-gray-600"
                    aria-label={t("Xóa tìm kiếm")}
                  >
                    <HiOutlineX className="text-sm" />
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2 items-center text-xs text-gray-500">
                {normalizedTerm ? (
                  <span>
                    {t("Khớp")}: <b className="text-gray-800">{filteredUsers.length}</b>/
                    {users.length}
                  </span>
                ) : (
                  <span>
                    {t("Tổng")}: <b className="text-gray-800">{users.length}</b>
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 1000 }}>
                <thead>
                  <tr className="text-xs tracking-wide text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 w-12">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectVisible(e.target.checked)}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 w-10 text-left">#</th>
                    <th className="px-4 py-3 text-left">Username</th>
                    <th className="px-4 py-3 text-left">{t("Item Generate")}</th>
                    <th className="px-4 py-3 text-left">Cookie</th>
                    <th className="px-4 py-3 text-left">Proxy</th>
                    <th className="px-4 py-3 text-center">Lỗi</th>
                    <th className="px-4 py-3 w-32 text-center">{t("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-sm text-center text-gray-400">
                        {t("Không có người dùng nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className={`bg-white transition-colors hover:bg-blue-50 ${
                          selectedIds.has(user.id) ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={(e) => toggleSelectOne(user.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{index + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{user.username}</td>
                        <td className="px-4 py-3" style={{ maxWidth: 260 }}>
                          {(user.generateItems?.length || 0) > 0 ? (
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-gray-800">
                                {t("{{count}} video/SP", {
                                  count: user.generateItems!.length,
                                })}
                              </div>
                              <div
                                className="text-gray-400 truncate text-10"
                                title={
                                  user
                                    .generateItems!.map(
                                      (g) => g.productName || g.productId || g.itemId
                                    )
                                    .filter(Boolean)
                                    .join(", ") || undefined
                                }
                              >
                                {user.generateItems![0].productName ||
                                  user.generateItems![0].productId ||
                                  "—"}
                                {user.generateItems!.length > 1
                                  ? ` +${user.generateItems!.length - 1}`
                                  : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 360 }}>
                          <span className="inline-block px-2 py-1 max-w-full font-mono text-xs text-gray-700 truncate bg-gray-50 rounded border border-gray-200">
                            {user.cookie || "-"}
                          </span>
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-xs truncate text-pink"
                          style={{ maxWidth: 360 }}
                        >
                          {user.proxy || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{user.error || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="flex justify-center items-center w-8 h-8 text-blue-600 bg-blue-50 rounded-full border border-blue-200 shadow-sm hover:bg-blue-100"
                              title={t("Sửa")}
                            >
                              <HiPencil className="text-sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
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
      </div>

      <Dialog
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={isNew ? t("Thêm Người Dùng") : t("Chỉnh Sửa Người Dùng")}
        icon={isNew ? <HiPlus /> : <HiPencil />}
        width="520px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
      >
        <Dialog.Body>
          <div className="pt-2 space-y-4">
            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Tên Người Dùng")}
              </span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">Cookie</span>
              <textarea
                value={form.cookie}
                onChange={(e) => setForm((f) => ({ ...f, cookie: e.target.value }))}
                rows={3}
                className="px-3 py-2 w-full text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Proxy (tùy chọn)")}
              </span>
              <input
                value={form.proxy}
                onChange={(e) => setForm((f) => ({ ...f, proxy: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
              <span className="block mt-1 text-xs text-gray-500">
                {t("Để trống nếu không dùng proxy")}
              </span>
            </label>
          </div>
          <div className="flex gap-2 justify-end w-full">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="px-4 h-9 text-sm font-bold text-white bg-gray-600 rounded-lg hover:bg-gray-700"
            >
              {t("Đóng")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 h-9 text-sm font-bold text-white rounded-lg bg-primary hover:bg-primary-dark"
            >
              {t("Lưu Thay Đổi")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
