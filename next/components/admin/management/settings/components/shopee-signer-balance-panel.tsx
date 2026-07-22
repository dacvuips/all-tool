/**
 * Kiểm tra số dư Credit/Signer — chỉ hiện trong Admin Settings → Shopee Video Upload.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiRefresh } from "react-icons/hi";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { getSignerBalance } from "../../../../shopee-video-upload/api/client";
import { MutableSetting } from "./setting-list";

const BASE_URL_KEY = "shopee-signer-base-url";
const ME_BASE_URL_KEY = "shopee-signer-me-base-url";
const API_KEY_KEY = "shopee-signer-api-key";

interface Props {
  settings: MutableSetting[];
}

export function ShopeeSignerBalancePanel({ settings }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<{
    username?: string;
    credits?: number;
    is_active?: boolean;
    signerBaseUrl?: string;
  } | null>(null);

  const pickValue = (key: string) =>
    String(settings.find((s) => s.key === key)?.value ?? "").trim();

  const handleCheck = async () => {
    const signerBaseUrl = pickValue(BASE_URL_KEY);
    const signerMeBaseUrl = pickValue(ME_BASE_URL_KEY);
    const signerApiKey = pickValue(API_KEY_KEY);
    if (!signerBaseUrl && !signerMeBaseUrl) {
      toast.warn(t("Chưa có Signer Base URL"));
      return;
    }
    if (!signerApiKey) {
      toast.warn(t("Chưa có Signer API Key — nhập rồi Lưu, hoặc dán lại trước khi kiểm tra"));
      return;
    }
    setLoading(true);
    try {
      // MLS: ưu tiên /api/me trên cùng host với /sign; Me URL chỉ khi điền riêng
      const bal = await getSignerBalance({
        signerBaseUrl: signerBaseUrl || signerMeBaseUrl,
        signerMeBaseUrl: signerMeBaseUrl || undefined,
        signerApiKey,
      });
      if (bal.success) {
        setBalance({
          username: bal.username,
          credits: bal.credits,
          is_active: bal.is_active,
          signerBaseUrl: bal.signerBaseUrl || signerBaseUrl,
        });
        toast.success(t("Kết nối signer OK"));
      } else {
        setBalance(null);
        toast.warn(bal.error || t("Không lấy được số dư"));
      }
    } catch (err: any) {
      setBalance(null);
      toast.error(err?.message || t("Không kết nối được signer"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 mb-4 rounded-lg border border-sky-200 bg-sky-50/60">
      <div className="flex gap-2 justify-between items-center">
        <div>
          <div className="text-sm font-semibold text-gray-800">
            {t("Kiểm tra số dư Credit / Signer")}
          </div>
          <p className="m-0 mt-0.5 text-xs text-gray-500">
            {t(
              "Gọi /api/me trên cùng host với Signer Base URL (MLS). Chỉ điền Credit Me URL nếu /api/me ở host khác — và API key phải đúng host đó."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={loading}
          className="inline-flex gap-1 items-center px-3 h-9 text-xs font-semibold whitespace-nowrap rounded border border-sky-300 text-sky-800 bg-white hover:bg-sky-50 disabled:opacity-60"
        >
          <HiRefresh className={loading ? "animate-spin" : ""} />
          {t("Kiểm tra số dư")}
        </button>
      </div>
      {balance ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-gray-700 sm:grid-cols-4">
          <div>
            <dt className="text-gray-500">User</dt>
            <dd className="font-semibold">{balance.username || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Credits</dt>
            <dd className="font-bold text-sky-800">{balance.credits ?? 0}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("Trạng thái")}</dt>
            <dd>
              {balance.is_active ? (
                <span className="text-green-700 font-semibold">Active</span>
              ) : (
                <span className="text-red-600 font-semibold">Inactive</span>
              )}
            </dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="text-gray-500">URL</dt>
            <dd className="font-mono break-all">{balance.signerBaseUrl || "—"}</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
