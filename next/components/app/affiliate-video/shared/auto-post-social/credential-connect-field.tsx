/**
 * Credential UX (lưu MongoDB qua GraphQL CredentialCustomer):
 * - YouTube: tách Access token / Refresh token / Client ID / Client secret → ghép JSON khi Lưu
 * - Facebook: Page Access Token + Page ID → ghép JSON khi Lưu
 * - TikTok: 1 ô token (giữ đơn giản)
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckLine,
  RiCloseLine,
  RiEditLine,
  RiEyeOffLine,
  RiKey2Line,
  RiLoader4Line,
  RiSaveLine,
} from "react-icons/ri";
import { Button } from "../../../../shared/utilities/form";
import { SocialCredentialState, SocialPlatform } from "./types";

interface CredentialConnectFieldProps {
  platform: SocialPlatform;
  credential: SocialCredentialState;
  onSave: (input: {
    platform: SocialPlatform;
    value: string;
    id?: string | null;
  }) => Promise<unknown>;
  onDelete: (platform: SocialPlatform) => Promise<void>;
}

type YoutubeOAuthForm = {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
};

const EMPTY_YOUTUBE: YoutubeOAuthForm = {
  accessToken: "",
  refreshToken: "",
  clientId: "",
  clientSecret: "",
};

function buildYoutubeCredentialValue(form: YoutubeOAuthForm): string | null {
  const access_token = form.accessToken.trim();
  if (!access_token) return null;

  const refresh_token = form.refreshToken.trim();
  const client_id = form.clientId.trim();
  const client_secret = form.clientSecret.trim();

  // Chỉ access token → lưu chuỗi thuần (tương thích cũ)
  if (!refresh_token && !client_id && !client_secret) {
    return access_token;
  }

  return JSON.stringify({
    access_token,
    ...(refresh_token ? { refresh_token } : {}),
    ...(client_id ? { client_id } : {}),
    ...(client_secret ? { client_secret } : {}),
  });
}

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 text-gray-800 text-sm px-3 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 font-mono placeholder-gray-400 disabled:opacity-60";

export function CredentialConnectField({
  platform,
  credential,
  onSave,
  onDelete,
}: CredentialConnectFieldProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [youtubeForm, setYoutubeForm] = useState<YoutubeOAuthForm>(EMPTY_YOUTUBE);
  const [saving, setSaving] = useState(false);

  const hasCred = !!credential?.id;
  const loaded = !!credential?.loaded;
  const isYoutube = platform === "youtube";

  const resetForm = () => {
    setValue("");
    setYoutubeForm(EMPTY_YOUTUBE);
  };

  const startCreate = () => {
    resetForm();
    setEditing(true);
  };

  const startEdit = () => {
    resetForm();
    setEditing(true);
  };

  const cancelEdit = () => {
    resetForm();
    setEditing(false);
  };

  const canSave = isYoutube ? !!youtubeForm.accessToken.trim() : !!value.trim();

  const handleSave = async () => {
    if (!canSave || saving) return;
    const payload = isYoutube ? buildYoutubeCredentialValue(youtubeForm) : value.trim();
    if (!payload) return;

    setSaving(true);
    try {
      await onSave({ platform, value: payload, id: credential?.id });
      resetForm();
      setEditing(false);
    } catch {
      // toast already shown by service
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasCred || saving) return;
    setSaving(true);
    try {
      await onDelete(platform);
      resetForm();
      setEditing(false);
    } catch {
      // toast already shown
    } finally {
      setSaving(false);
    }
  };

  const patchYoutube = (key: keyof YoutubeOAuthForm, next: string) => {
    setYoutubeForm((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="px-4 py-3 space-y-3 bg-white rounded-xl border border-gray-200">
      <div className="flex gap-2 justify-between items-center">
        <label className="block text-xs font-medium text-gray-700">
          {t("Credential to connect with /Oauth")}
        </label>
        {hasCred && !editing && (
          <button
            type="button"
            title={t("Sửa credential")}
            onClick={startEdit}
            className="flex justify-center items-center w-8 h-8 text-gray-500 bg-transparent rounded-lg border-0 transition-colors cursor-pointer hover:text-indigo-600 hover:bg-indigo-50"
          >
            <RiEditLine className="text-base" />
          </button>
        )}
      </div>

      {!loaded ? (
        <div className="flex items-center justify-center gap-2 py-3 text-xs text-gray-400">
          <RiLoader4Line className="animate-spin" />
          {t("Đang tải...")}
        </div>
      ) : (
        <>
          {hasCred && !editing && (
            <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-gray-50 border border-gray-100">
              <RiEyeOffLine className="flex-shrink-0 text-base text-gray-400" />
              <span className="flex-1 font-mono text-sm tracking-widest text-gray-500 select-none">
                ••••••••••••••••
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${
                  credential.active
                    ? "bg-green-50 text-green-600 border-green-200"
                    : "bg-amber-50 text-amber-600 border-amber-200"
                }`}
              >
                <RiCheckLine className="text-sm" />
                {credential.active ? t("Đã kết nối") : t("Inactive")}
              </span>
            </div>
          )}

          {!hasCred && !editing && (
            <button
              type="button"
              onClick={startCreate}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-semibold cursor-pointer hover:bg-indigo-100 hover:border-indigo-400 transition-colors"
            >
              <RiKey2Line className="text-base" />
              {t("Nhập Credential")}
            </button>
          )}

          {editing && (
            <div className="space-y-3">
              {isYoutube ? (
                <>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {t(
                      "Access token bắt buộc. Client ID + Client secret (+ Refresh token) để tự làm mới khi token hết hạn."
                    )}
                  </p>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      {t("Access token")} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={youtubeForm.accessToken}
                      onChange={(e) => patchYoutube("accessToken", e.target.value)}
                      placeholder={t("OAuth access_token")}
                      rows={2}
                      autoFocus
                      disabled={saving}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      {t("Refresh token")}
                    </label>
                    <input
                      type="text"
                      value={youtubeForm.refreshToken}
                      onChange={(e) => patchYoutube("refreshToken", e.target.value)}
                      placeholder={t("OAuth refresh_token (tuỳ chọn)")}
                      disabled={saving}
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">{t("Client ID")}</label>
                      <input
                        type="text"
                        value={youtubeForm.clientId}
                        onChange={(e) => patchYoutube("clientId", e.target.value)}
                        placeholder={t("client_id")}
                        disabled={saving}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5">
                        {t("Client secret")}
                      </label>
                      <input
                        type="password"
                        value={youtubeForm.clientSecret}
                        onChange={(e) => patchYoutube("clientSecret", e.target.value)}
                        placeholder={t("client_secret")}
                        disabled={saving}
                        className={inputClass}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">
                    {t("Token / Access key")}
                  </label>
                  <textarea
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={t("Nhập token / OAuth access key tài khoản")}
                    rows={3}
                    autoFocus
                    disabled={saving}
                    className={`${inputClass} resize-none`}
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end items-center">
                {hasCred && (
                  <Button outline danger text={t("Xóa")} disabled={saving} onClick={handleDelete} />
                )}
                <Button
                  outline
                  text={t("Hủy")}
                  icon={<RiCloseLine />}
                  disabled={saving}
                  onClick={cancelEdit}
                />
                <Button
                  primary
                  icon={<RiSaveLine />}
                  text={t("Lưu")}
                  isLoading={saving}
                  disabled={!canSave || saving}
                  onClick={handleSave}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
