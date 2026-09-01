import copy from "copy-to-clipboard";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiArrowLeft,
  HiCheck,
  HiChevronLeft,
  HiChevronRight,
  HiClipboardCopy,
  HiClock,
  HiExclamationCircle,
  HiKey,
  HiLightningBolt,
  HiPlus,
  HiRefresh,
  HiShieldCheck,
} from "react-icons/hi";
import { RiSettings4Line } from "react-icons/ri";
import { useScreen } from "../../lib/hooks/useScreen";
import { useAuth } from "../../lib/providers/auth-provider";
import { useGlobalContext } from "../../lib/providers/global-provider";
import { useToast } from "../../lib/providers/toast-provider";
import {
  ApiMediaSubscriptionPlanEnum,
  ApiMediaToken,
  apiMediaTokenService,
} from "../../lib/repo/api-media-token/api-media-token.repo";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button, Switch } from "../shared/utilities/form";
import ApiMediaGuide from "./api-media-guide";

const LIMIT = 10;

function getTokenPlainKey(token: ApiMediaToken, plainKeys: Record<string, string>): string {
  return plainKeys[token.id] || token.key || "";
}

function getTokenDisplayKey(
  token: ApiMediaToken,
  plainKeys: Record<string, string>,
  hiddenLabel: string
): string {
  const full = getTokenPlainKey(token, plainKeys);
  if (full) {
    if (full.length > 16) {
      return `${full.slice(0, 8)}••••••••${full.slice(-6)}`;
    }
    return full;
  }
  return token.keyPrefix || hiddenLabel;
}

const ApiMediaPage = ({
  hideHeader = false,
  onNavigateToPricing,
}: {
  hideHeader?: boolean;
  onNavigateToPricing?: () => void;
}) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [tokens, setTokens] = useState<ApiMediaToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [plainKeys, setPlainKeys] = useState<Record<string, string>>({});
  const [rotatingId, setRotatingId] = useState<string | null>(null);
  const sm = useScreen("sm");
  const { setOpenCustomerLoginDialog } = useGlobalContext();

  const totalPages = useMemo(() => Math.ceil(total / LIMIT), [total]);
  function copyToClipboard(text) {
    copy(text);
    toast.success(t("Đã sao chép"));
  }
  const fetchTokens = async () => {
    setLoading(true);
    try {
      const result = await apiMediaTokenService.getMyApiMediaTokens({
        query: { limit: LIMIT, page },
      });

      setTokens(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch API Media tokens:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, [page, customer]);

  const handleAddNew = async () => {
    if (!customer) {
      setOpenCustomerLoginDialog(true);
      return;
    }
    if (total > 0) {
      // Customer already has tokens, navigate to pricing page
      if (onNavigateToPricing) {
        onNavigateToPricing();
      } else {
        router.push("/api-generate-media/pricing");
      }
      return;
    }
    // No tokens yet, create one immediately
    setLoading(true);
    try {
      const created = await apiMediaTokenService.createMyApiMediaToken();
      if (created?.id && created.key) {
        setPlainKeys((prev) => ({ ...prev, [created.id]: created.key! }));
      }
      await fetchTokens();
    } catch (err) {
      console.error("Failed to create API Media token:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const getStatusInfo = (token: ApiMediaToken) => {
    const now = new Date();
    const expired = token.expiredDate ? new Date(token.expiredDate) < now : false;

    if (!token.active) {
      return {
        label: t("Vô hiệu"),
        color: "bg-red-50 text-red-600 border-red-200",
        dotColor: "bg-red-500",
      };
    }
    if (expired) {
      return {
        label: t("Hết hạn"),
        color: "bg-amber-50 text-amber-600 border-amber-200",
        dotColor: "bg-amber-500",
      };
    }
    return {
      label: t("Hoạt động"),
      color: "bg-success-light text-success border-success",
      dotColor: "bg-emerald-500",
    };
  };

  const getUsagePercent = (token: ApiMediaToken) => {
    if (!token.requestQuantity || token.requestQuantity === 0) return 0;
    return Math.min(100, Math.round(((token.usedQuantity || 0) / token.requestQuantity) * 100));
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "#ef4444";
    if (percent >= 70) return "#f59e0b";
    return "#10b981";
  };

  const getPlanInfo = (plan?: ApiMediaSubscriptionPlanEnum) => {
    switch (plan) {
      case ApiMediaSubscriptionPlanEnum.BASIC:
        return {
          label: t("Cơ Bản"),
          icon: "🛡️",
          color: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case ApiMediaSubscriptionPlanEnum.STANDARD:
        return {
          label: t("Tiêu Chuẩn"),
          icon: "⚡",
          color: "bg-orange-50 text-orange-700 border-orange-200",
        };
      case ApiMediaSubscriptionPlanEnum.PROFESSIONAL:
        return {
          label: t("Chuyên Nghiệp"),
          icon: "🚀",
          color: "bg-green-50 text-green-700 border-green-200",
        };
      case ApiMediaSubscriptionPlanEnum.UNLIMITED:
        return {
          label: t("Không Giới Hạn"),
          icon: "💎",
          color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        };
      case ApiMediaSubscriptionPlanEnum.FREE:
      default:
        return {
          label: t("Miễn phí"),
          icon: "🎁",
          color: "bg-gray-50 text-gray-600 border-gray-200",
        };
    }
  };

  // Summary stats
  const stats = useMemo(() => {
    const activeCount = tokens.filter((t) => {
      const now = new Date();
      const expired = t.expiredDate ? new Date(t.expiredDate) < now : false;
      return t.active && !expired;
    }).length;
    const totalRequests = tokens.reduce((acc, t) => acc + (t.requestQuantity || 0), 0);
    const usedRequests = tokens.reduce((acc, t) => acc + (t.usedQuantity || 0), 0);
    return { activeCount, totalRequests, usedRequests };
  }, [tokens]);

  const [guideOpen, setGuideOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const openTokenGuide = () => {
    setGuideOpen(true);
  };

  const handleRotateKey = async (token: ApiMediaToken) => {
    if (rotatingId) return;
    setRotatingId(token.id);
    try {
      const { plainKey } = await apiMediaTokenService.rotateMyApiMediaToken(token.id);
      setPlainKeys((prev) => ({ ...prev, [token.id]: plainKey }));
      copyToClipboard(plainKey);
      await fetchTokens();
      toast.success(t("Đã tạo API key mới — hãy lưu key ngay"));
    } catch (err: any) {
      toast.error(err?.message || t("Không thể tạo lại key"));
    } finally {
      setRotatingId(null);
    }
  };

  const handleToggleActive = async (token: ApiMediaToken) => {
    if (togglingId) return;
    setTogglingId(token.id);
    try {
      const updated = await apiMediaTokenService.toggleMyApiMediaTokenActive(token.id);
      setTokens((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      toast.success(updated.active ? t("Đã kích hoạt token") : t("Đã vô hiệu token"));
    } catch (err) {
      console.error("Failed to toggle token active:", err);
      toast.error(t("Có lỗi xảy ra, vui lòng thử lại"));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {!hideHeader && (
        <>
          {/* Header Section */}
          <div className="sticky top-14 z-40 bg-white shadow-sm">
            <div className="flex items-center gap-4 max-w-screen-xl mx-auto px-6 py-3">
              <div
                onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
              >
                <HiArrowLeft className="text-base" />
                {sm && <span>{t("Quay lại")}</span>}
              </div>
              <div className="w-px h-5 bg-gray-300" />
              <div className="flex items-center gap-2">
                <HiShieldCheck className="text-xl text-green-500" />
                <h1 className="text-base font-bold text-gray-800 m-0">
                  {t("Quản lý API Key Media")}
                </h1>
              </div>
            </div>

            {/* Green accent bar */}
            <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
          </div>
        </>
      )}

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-50">
                <HiLightningBolt className="text-lg text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-500 font-medium">{t("Đang hoạt động")}</p>
                <p className="text-xl font-bold text-green-900">
                  {loading ? "—" : stats.activeCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-50">
                <HiKey className="text-lg text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-blue-500 font-medium">{t("Tổng Request")}</p>
                <p className="text-xl font-bold text-blue-900">
                  {loading ? "—" : stats.totalRequests.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-50">
                <HiClock className="text-lg text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-yellow-500 font-medium">{t("Đã sử dụng")}</p>
                <p className="text-xl font-bold text-yellow-900">
                  {loading ? "—" : stats.usedRequests.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table Header Row */}
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {t("Danh sách Token")}
              </h2>
              <span className="text-xs sm:text-sm text-gray-400 font-medium">
                {total > 0 && `${total} ${t("token")}`}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAddNew}
                disabled={loading}
                outline
                icon={<HiPlus className={`text-lg ${loading ? "animate-spin" : ""}`} />}
                text={sm ? t("Thêm mới") : ""}
              />
              <Button
                onClick={fetchTokens}
                disabled={loading}
                outline
                icon={<HiRefresh className={`text-lg ${loading ? "animate-spin" : ""}`} />}
                text={sm ? t("Làm mới") : ""}
              />
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="p-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-2/3" />
                    </div>
                    <div className="h-6 w-20 bg-gray-200 rounded-full" />
                  </div>
                  {i < 2 && <div className="border-b border-gray-50" />}
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && tokens.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(242, 137, 13, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                }}
              >
                <HiShieldCheck className="text-4xl text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t("Chưa có token nào")}</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm">
                {t("Bạn chưa có API Media token nào. Hãy [+ thêm mới] API Media token.")}
              </p>
            </div>
          )}

          {/* Desktop Table (hidden on mobile) */}
          {!loading && tokens.length > 0 && (
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                      API Key
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                      {t("Gói")}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                      {t("Sử dụng")}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                      {t("Hết hạn")}
                    </th>
                    <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                      {t("Trạng thái")}
                    </th>
                    <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-6 py-3">
                      {t("Thao tác")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tokens.map((token) => {
                    const status = getStatusInfo(token);
                    const planInfo = getPlanInfo(token.subscriptionPlan);
                    const usagePercent = getUsagePercent(token);
                    const usageColor = getUsageColor(usagePercent);
                    const maskedKey = getTokenDisplayKey(
                      token,
                      plainKeys,
                      t("Đã hash — Tạo lại key")
                    );
                    const plainKey = getTokenPlainKey(token, plainKeys);

                    return (
                      <tr
                        key={token.id}
                        className="group hover:bg-gray-50 transition-colors duration-150"
                      >
                        {/* Key */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{
                                background: token.active
                                  ? "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)"
                                  : "#e5e7eb",
                              }}
                            >
                              <HiKey
                                className={`text-sm ${
                                  token.active ? "text-white" : "text-gray-400"
                                }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <div
                                onClick={() => plainKey && copyToClipboard(plainKey)}
                                className="flex items-center gap-2"
                              >
                                <p className="text-sm font-mono font-medium text-gray-900 truncate max-w-xs">
                                  {maskedKey}
                                </p>

                                {plainKey && (
                                  <Button
                                    onClick={() => copyToClipboard(plainKey)}
                                    className="px-0"
                                    tooltip={t("Sao chép")}
                                    icon={
                                      copiedId === token.id ? (
                                        <HiCheck className="text-sm" />
                                      ) : (
                                        <HiClipboardCopy className="text-sm" />
                                      )
                                    }
                                  />
                                )}
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {t("Tạo ngày")} {formatDate(token.createdAt)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border w-fit ${planInfo.color}`}
                            >
                              <span>{planInfo.icon}</span>
                              {planInfo.label}
                            </span>
                            {(token.subscriptionPlan === ApiMediaSubscriptionPlanEnum.FREE ||
                              !token.subscriptionPlan) && (
                              <p className="text-xs text-blue-600 w-full leading-snug">
                                {t("Hãy liên hệ Admin để được cấp thêm lượt dùng thử trải nghiệm")}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Usage */}
                        <td className="px-4 py-4">
                          <div className="min-w-32">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-gray-700">
                                {(token.usedQuantity || 0).toLocaleString()}/
                                {(token.requestQuantity || 0).toLocaleString()}
                              </span>
                              <span className="text-xs font-bold" style={{ color: usageColor }}>
                                {usagePercent}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${usagePercent}%`,
                                  background: usageColor,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Expiry */}
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-600">
                            {formatDate(token.expiredDate)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-8 items-center gap-1 px-0.5  rounded-full text-xs font-semibold border ${status.color}`}
                            >
                              <Switch
                                value={token.active}
                                onChange={() => handleToggleActive(token)}
                                dependent
                              />
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                              {status.label}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              onClick={() => handleRotateKey(token)}
                              className="bg-gray-50"
                              tooltip={t("Tạo lại key")}
                              disabled={!!rotatingId}
                              icon={
                                <HiRefresh
                                  className={rotatingId === token.id ? "animate-spin" : ""}
                                />
                              }
                            />
                            <Button
                              onClick={() => openTokenGuide()}
                              className=" bg-gray-50"
                              tooltip={t("Hướng dẫn tích hợp API")}
                              icon={<RiSettings4Line />}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Mobile Cards (hidden on desktop) */}
          {!loading && tokens.length > 0 && (
            <div className="md:hidden divide-y divide-gray-100">
              {tokens.map((token) => {
                const status = getStatusInfo(token);
                const usagePercent = getUsagePercent(token);
                const usageColor = getUsageColor(usagePercent);
                const maskedKey = getTokenDisplayKey(token, plainKeys, t("Đã hash — Tạo lại key"));
                const plainKey = getTokenPlainKey(token, plainKeys);

                return (
                  <div key={token.id} className="p-4 sm:p-5">
                    {/* Top Row: Key + Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: token.active
                              ? "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)"
                              : "#e5e7eb",
                          }}
                        >
                          <HiKey
                            className={`text-sm ${token.active ? "text-white" : "text-gray-400"}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div
                            onClick={() => plainKey && copyToClipboard(plainKey)}
                            className="flex items-center gap-2"
                          >
                            <p className="text-sm font-mono font-medium text-gray-900 truncate max-w-xs">
                              {maskedKey}
                            </p>

                            {plainKey && (
                              <Button
                                onClick={() => copyToClipboard(plainKey)}
                                className="px-0"
                                tooltip={t("Sao chép")}
                                icon={
                                  copiedId === token.id ? (
                                    <HiCheck className="text-sm" />
                                  ) : (
                                    <HiClipboardCopy className="text-sm" />
                                  )
                                }
                              />
                            )}
                          </div>
                          <p className="text-xs text-gray-400">
                            {t("Tạo ngày")} {formatDate(token.createdAt)}
                          </p>
                          {/* Plan Badge */}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap text-10 font-semibold border mt-1 ${
                              getPlanInfo(token.subscriptionPlan).color
                            }`}
                          >
                            <span>{getPlanInfo(token.subscriptionPlan).icon}</span>
                            {getPlanInfo(token.subscriptionPlan).label}
                          </span>
                          {(token.subscriptionPlan === ApiMediaSubscriptionPlanEnum.FREE ||
                            !token.subscriptionPlan) && (
                            <p className="text-xs text-amber-600 mt-1 leading-snug">
                              {t("Hãy liên hệ Admin để được cấp thêm lượt dùng thử trải nghiệm")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`inline-flex h-8 items-center gap-1 px-0.5  rounded-full text-xs font-semibold border ${status.color}`}
                      >
                        <Switch
                          value={token.active}
                          onChange={() => handleToggleActive(token)}
                          dependent
                        />
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                        {status.label}
                      </span>
                    </div>

                    {/* Usage Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500">{t("Sử dụng")}</span>
                        <span className="text-xs font-semibold text-gray-700">
                          {(token.usedQuantity || 0).toLocaleString()}/
                          {(token.requestQuantity || 0).toLocaleString()}{" "}
                          <span style={{ color: usageColor }}>({usagePercent}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${usagePercent}%`,
                            background: usageColor,
                          }}
                        />
                      </div>
                    </div>

                    {/* Bottom Row: Expiry + Copy */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <HiClock className="text-sm" />
                        <span>
                          {t("Hết hạn")}: {formatDate(token.expiredDate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => handleRotateKey(token)}
                          className="bg-gray-50"
                          tooltip={t("Tạo lại key")}
                          disabled={!!rotatingId}
                          icon={
                            <HiRefresh className={rotatingId === token.id ? "animate-spin" : ""} />
                          }
                        />
                        <Button
                          onClick={() => openTokenGuide()}
                          className=" bg-gray-50"
                          tooltip={t("Hướng dẫn tích hợp API")}
                          icon={<RiSettings4Line />}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs sm:text-sm text-gray-500">
                {t("Trang")} {page}/{totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <HiChevronLeft className="text-lg" />
                </button>

                {/* Page Numbers */}
                <div className="hidden sm:flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-200 ${
                          page === pageNum
                            ? "text-white shadow-sm"
                            : "bg-transparent text-gray-500 hover:bg-gray-100"
                        }`}
                        style={
                          page === pageNum
                            ? {
                                background: "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)",
                              }
                            : {}
                        }
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <HiChevronRight className="text-lg" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Banner */}
        {!loading && tokens.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 sm:p-5 flex items-start gap-3">
            <HiExclamationCircle className="text-lg text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">{t("Lưu ý bảo mật")}</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t(
                  "API Key của bạn đã được ẩn một phần để bảo mật. Nhấn nút Sao chép để lấy key đầy đủ. Không chia sẻ key với người khác."
                )}
              </p>
            </div>
          </div>
        )}
      </div>
      <ApiKeyGuideDialog isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
};

// ===== API Key Guide Dialog =====
const ApiKeyGuideDialog = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Hướng dẫn tích hợp API")}
      width="1100px"
      maxWidth="96vw"
    >
      <Dialog.Body>
        <ApiMediaGuide />
      </Dialog.Body>
    </Dialog>
  );
};

export default ApiMediaPage;
