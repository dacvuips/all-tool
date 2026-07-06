import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineTrash, HiPencil, HiPlus } from "react-icons/hi";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Button, Field, Form, Input, Switch } from "../../shared/utilities/form";
import { AffiliatePlusUser } from "../types";

interface UsersPanelProps {
  users: AffiliatePlusUser[];
  onUpdateUsers: (users: AffiliatePlusUser[]) => void;
}

export function UsersPanel({ users, onUpdateUsers }: UsersPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [editUser, setEditUser] = useState<AffiliatePlusUser | null>(null);
  const [form, setForm] = useState({ username: "", email: "", role: "user" });
  const [isNew, setIsNew] = useState(false);

  const openNew = () => {
    setForm({ username: "", email: "", role: "user" });
    setIsNew(true);
    setEditUser({} as AffiliatePlusUser);
  };

  const openEdit = (user: AffiliatePlusUser) => {
    setForm({ username: user.username, email: user.email, role: user.role });
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
          username: form.username,
          email: form.email,
          role: form.role,
          active: true,
          createdAt: new Date().toISOString(),
        },
      ]);
      toast.success(t("Đã thêm người dùng"));
    } else if (editUser) {
      onUpdateUsers(
        users.map((u) =>
          u.id === editUser.id
            ? { ...u, username: form.username, email: form.email, role: form.role }
            : u
        )
      );
      toast.success(t("Đã cập nhật"));
    }
    setEditUser(null);
  };

  const toggleActive = (id: string, active: boolean) => {
    onUpdateUsers(users.map((u) => (u.id === id ? { ...u, active } : u)));
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("Xóa người dùng này?"))) return;
    onUpdateUsers(users.filter((u) => u.id !== id));
    toast.success(t("Đã xóa"));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="m-0 text-sm font-bold text-gray-700">{t("Danh sách người dùng")}</h3>
        <Button primary icon={<HiPlus />} text={t("Thêm người dùng")} onClick={openNew} />
      </div>

      <div className="overflow-hidden bg-white rounded-xl border border-gray-200">
        {users.length === 0 ? (
          <div className="py-12 text-sm text-center text-gray-400">{t("Chưa có người dùng")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white uppercase bg-slate-800">
                <th className="px-4 py-3 text-left">Username</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-center">{t("Hoạt động")}</th>
                <th className="px-4 py-3 w-24 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-gray-800">{user.username}</td>
                  <td className="px-4 py-3 text-gray-600">{user.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Switch value={user.active} onChange={(val) => toggleActive(user.id, val)} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-center">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="p-1.5 text-sky-500 hover:bg-sky-50 rounded"
                      >
                        <HiPencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded"
                      >
                        <HiOutlineTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Form
        dialog
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        width="420px"
        title={isNew ? t("Thêm người dùng") : t("Sửa người dùng")}
      >
        <Dialog.Body>
          <div className="space-y-3">
            <Field label="Username">
              <Input
                value={form.username}
                onChange={(v) => setForm((f) => ({ ...f, username: v }))}
              />
            </Field>
            <Field label="Email">
              <Input value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            </Field>
            <Field label="Role">
              <Input value={form.role} onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
            </Field>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button text={t("Hủy")} onClick={() => setEditUser(null)} />
          <Button primary text={t("Lưu")} onClick={handleSave} />
        </Dialog.Footer>
      </Form>
    </div>
  );
}
