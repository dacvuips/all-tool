/**
 * Panel trạng thái Credit / Signer — chỉ xem (cấu hình ở Admin Settings).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiRefresh } from "react-icons/hi";
import { useToast } from "../../../lib/providers/toast-provider";
import { getSignerBalance, getSignerConfig } from "../api/client";

export function SignerSettingsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<{
    signerBaseUrl?: string;
    adapter?: string;
    dryRun?: boolean;
    apiKeySet?: boolean;
    source?: string;
  } | null>(null);
  const [balance, setBalance] = useState<{
    username?: string;
    credits?: number;
    is_active?: boolean;
  } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, bal] = await Promise.all([getSignerConfig(), getSignerBalance()]);
      if (cfg.success) setConfig(cfg);
      if (bal.success) {
        setBalance({
          username: bal.username,
          credits: bal.credits,
          is_active: bal.is_active,
        });
      } else {
        setBalance(null);
        if (bal.error) toast.warn(bal.error);
      }
    } catch (err: any) {
      toast.error(err?.message || t("Không kết nối được signer"));
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-4 max-w-lg space-y-3 bg-white rounded-xl border border-gray-200">
      <div className="flex gap-2 justify-between items-center">
        <h3 className="m-0 text-sm font-bold text-gray-800">
          {t("Credit Shopee (Signer)")}
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex gap-1 items-center px-2 h-8 text-xs font-semibold rounded border border-sky-300 text-sky-700 bg-sky-50"
        >
          <HiRefresh className={loading ? "animate-spin" : ""} />
          {t("Kiểm tra số dư")}
        </button>
      </div>
      <p className="m-0 text-xs text-gray-500">
        {t(
          "Base URL và API Key cấu hình tại Admin → Settings → Shopee Video Upload. Không chỉnh ở đây."
        )}
      </p>
      <dl className="space-y-1 text-xs text-gray-700">
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">Base URL</dt>
          <dd className="font-mono break-all">{config?.signerBaseUrl || "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">Nguồn</dt>
          <dd>{config?.source || "—"}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">Adapter</dt>
          <dd>
            <span className="font-semibold">{config?.adapter || "—"}</span>
            {config?.dryRun ? (
              <span className="ml-2 text-amber-700">(dry-run)</span>
            ) : null}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-28 text-gray-500">API Key</dt>
          <dd>{config?.apiKeySet ? t("Đã cấu hình") : t("Chưa set")}</dd>
        </div>
        {balance ? (
          <>
            <div className="flex gap-2">
              <dt className="w-28 text-gray-500">User</dt>
              <dd>
                {balance.username}{" "}
                {balance.is_active ? (
                  <span className="text-green-700">Active</span>
                ) : (
                  <span className="text-red-600">Inactive</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 text-gray-500">Credits</dt>
              <dd className="font-bold">{balance.credits ?? 0}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </div>
  );
}
