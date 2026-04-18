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
  RecaptchaSubscriptionPlanEnum,
  RecaptchaToken,
  recaptchaTokenService,
} from "../../lib/repo/recaptcha-token/recaptcha-token.repo";
import CodeBlock, { CodeSample } from "../shared/utilities/code-block/codeBlock";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";

const LIMIT = 10;

const RecaptchaPage = () => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [tokens, setTokens] = useState<RecaptchaToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
      const result = await recaptchaTokenService.getMyRecaptchaTokens({
        query: { limit: LIMIT, page },
      });

      setTokens(result.data);
      setTotal(result.total);
    } catch (err) {
      console.error("Failed to fetch recaptcha tokens:", err);
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
      router.push("/recaptcha/pricing");
      return;
    }
    // No tokens yet, create one immediately
    setLoading(true);
    try {
      await recaptchaTokenService.createMyRecaptchaToken();
      await fetchTokens();
    } catch (err) {
      console.error("Failed to create recaptcha token:", err);
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

  const getStatusInfo = (token: RecaptchaToken) => {
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
      color: "bg-emerald-50 text-emerald-600 border-emerald-200",
      dotColor: "bg-emerald-500",
    };
  };

  const getUsagePercent = (token: RecaptchaToken) => {
    if (!token.requestQuantity || token.requestQuantity === 0) return 0;
    return Math.min(100, Math.round(((token.usedQuantity || 0) / token.requestQuantity) * 100));
  };

  const getUsageColor = (percent: number) => {
    if (percent >= 90) return "#ef4444";
    if (percent >= 70) return "#f59e0b";
    return "#10b981";
  };

  const getPlanInfo = (plan?: RecaptchaSubscriptionPlanEnum) => {
    switch (plan) {
      case RecaptchaSubscriptionPlanEnum.BASIC:
        return {
          label: t("Cơ Bản"),
          icon: "🛡️",
          color: "bg-blue-50 text-blue-700 border-blue-200",
        };
      case RecaptchaSubscriptionPlanEnum.STANDARD:
        return {
          label: t("Tiêu Chuẩn"),
          icon: "⚡",
          color: "bg-orange-50 text-orange-700 border-orange-200",
        };
      case RecaptchaSubscriptionPlanEnum.PROFESSIONAL:
        return {
          label: t("Chuyên Nghiệp"),
          icon: "🚀",
          color: "bg-green-50 text-green-700 border-green-200",
        };
      case RecaptchaSubscriptionPlanEnum.UNLIMITED:
        return {
          label: t("Không Giới Hạn"),
          icon: "💎",
          color: "bg-yellow-50 text-yellow-700 border-yellow-200",
        };
      case RecaptchaSubscriptionPlanEnum.FREE:
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

  const [openSettingToken, setOpenSettingToken] = useState<string>("");

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header Section */}
      <div className="sticky top-14 z-40 bg-white shadow-sm">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto px-6 py-3">
          <div
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
          >
            <HiArrowLeft className="text-base" />
            <span>{t("Quay lại")}</span>
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-center gap-2">
            <HiShieldCheck className="text-xl text-green-500" />
            <h1 className="text-base font-bold text-gray-800 m-0">
              {t("Quản lý API Key reCAPTCHA")}
            </h1>
          </div>
        </div>

        {/* Green accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
      </div>

      {/* Stats Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-50">
                <HiLightningBolt className="text-lg text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{t("Đang hoạt động")}</p>
                <p className="text-xl font-bold text-gray-900">
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
                <p className="text-xs text-gray-500 font-medium">{t("Tổng Request")}</p>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "—" : stats.totalRequests.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-50">
                <HiClock className="text-lg text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">{t("Đã sử dụng")}</p>
                <p className="text-xl font-bold text-gray-900">
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
                {t("Bạn chưa có reCAPTCHA token nào. Hãy [+ thêm mới] reCAPTCHA token.")}
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
                    const maskedKey = token.key
                      ? `${token.key.substring(0, 8)}••••••••${token.key.substring(
                          token.key.length - 6
                        )}`
                      : "—";

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
                                onClick={() => copyToClipboard(token.key)}
                                className="flex items-center gap-2"
                              >
                                <p className="text-sm font-mono font-medium text-gray-900 truncate max-w-xs">
                                  {maskedKey}
                                </p>

                                <Button
                                  onClick={() => copyToClipboard(token.key)}
                                  tooltip={t("Sao chép")}
                                  icon={
                                    copiedId === token.id ? (
                                      <HiCheck className="text-sm" />
                                    ) : (
                                      <HiClipboardCopy className="text-sm" />
                                    )
                                  }
                                />
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {t("Tạo ngày")} {formatDate(token.createdAt)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${planInfo.color}`}
                          >
                            <span>{planInfo.icon}</span>
                            {planInfo.label}
                          </span>
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
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.color}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor}`} />
                            {status.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <Button
                            onClick={() => setOpenSettingToken(token.key)}
                            icon={<RiSettings4Line />}
                          ></Button>
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
                const maskedKey = token.key
                  ? `${token.key.substring(0, 6)}••••${token.key.substring(token.key.length - 4)}`
                  : "—";

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
                          <p className="text-sm font-mono font-medium text-gray-900 truncate">
                            {maskedKey}
                          </p>
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
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border flex-shrink-0 ${status.color}`}
                      >
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
                      <button
                        onClick={() => copyToClipboard(token.key)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 bg-gray-100 text-gray-600 hover:bg-primary hover:text-white active:scale-95"
                      >
                        {copiedId === token.id ? (
                          <>
                            <HiCheck className="text-sm" />
                            {t("Đã sao chép")}
                          </>
                        ) : (
                          <>
                            <HiClipboardCopy className="text-sm" />
                            {t("Sao chép")}
                          </>
                        )}
                      </button>
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
      <ApiKeyGuideDialog
        isOpen={!!openSettingToken}
        onClose={() => setOpenSettingToken("")}
        apiKey={openSettingToken}
      />
    </div>
  );
};
// ===== Default Code Samples =====
const CODE_SAMPLES: Record<string, any> = {
  NodeJS: {
    lang: "javascript",
    icon: "JS",
    iconBg: "bg-yellow-400 text-gray-900",
    code: (apiKey: string) => `const API_KEY = '${apiKey}';
const BASE_URL = '${typeof window !== "undefined" ? window.location.origin : ""}/api/recaptcha';

async function getReCaptchaToken(action) {
  const url = action ? \`\${BASE_URL}?action=\${action}\` : BASE_URL;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY,
      }
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    
    const data = await response.json();
    console.log('Response:', data);
    return data;
  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Get reCAPTCHA token (Default action: VIDEO_GENERATION)
getReCaptchaToken();

// With action type IMAGE_GENERATION parameter
getReCaptchaToken('IMAGE_GENERATION');`,
  },
  PHP: {
    lang: "php",
    icon: "PHP",
    iconBg: "bg-indigo-500 text-white",
    code: (apiKey: string) => `<?php

$apiKey = '${apiKey}';
$baseUrl = '${typeof window !== "undefined" ? window.location.origin : ""}/api/recaptcha';

function getReCaptchaToken($apiKey, $baseUrl, $action = null) {
    $url = $baseUrl;
    if ($action) {
        $url .= '?action=' . urlencode($action);
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'X-API-Key: ' . $apiKey,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        echo "Response: " . $response . PHP_EOL;
    } else {
        echo "Error (" . $httpCode . "): " . $response . PHP_EOL;
    }
}

// Get reCAPTCHA token (Default action: VIDEO_GENERATION)
getReCaptchaToken($apiKey, $baseUrl);

// With action type IMAGE_GENERATION parameter
getReCaptchaToken($apiKey, $baseUrl, 'IMAGE_GENERATION');`,
  },
  Python: {
    lang: "python",
    icon: "PY",
    iconBg: "bg-blue-500 text-yellow-300",
    code: (apiKey: string) => `import requests

API_KEY = '${apiKey}'
BASE_URL = '${typeof window !== "undefined" ? window.location.origin : ""}/api/recaptcha'

def get_recaptcha_token(action=None):
    url = BASE_URL
    if action:
        url += f'?action={action}'
        
    headers = {
        'X-API-Key': API_KEY
    }
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        print('Response:', data)
        return data
    except requests.exceptions.RequestException as e:
        print('Error:', e)
        raise

# Get reCAPTCHA token (Default action: VIDEO_GENERATION)
get_recaptcha_token()

# With action type IMAGE_GENERATION parameter
get_recaptcha_token('IMAGE_GENERATION')`,
  },
  Curl: {
    lang: "bash",
    icon: ">_",
    iconBg: "bg-gray-700 text-green-400",
    code: (apiKey: string) => `# Get reCAPTCHA token (Default action: VIDEO_GENERATION)
curl -X GET '${typeof window !== "undefined" ? window.location.origin : ""}/api/recaptcha' \\
  -H 'X-API-Key: ${apiKey}'

# With action type IMAGE_GENERATION parameter
curl -X GET '${typeof window !== "undefined" ? window.location.origin : ""}/api/recaptcha?action=IMAGE_GENERATION' \\
  -H 'X-API-Key: ${apiKey}'`,
  },
};

// ===== API Key Guide Dialog =====
const ApiKeyGuideDialog = ({
  isOpen,
  onClose,
  apiKey,
}: {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [keyCopied, setKeyCopied] = useState(false);

  const handleCopyKey = useCallback(() => {
    copy(apiKey);
    setKeyCopied(true);
    toast.success(t("Đã sao chép API Key"));
    setTimeout(() => setKeyCopied(false), 2000);
  }, [apiKey]);

  const codeSampleList: CodeSample[] = useMemo(() => {
    return Object.entries(CODE_SAMPLES).map(([key, value]) => {
      return {
        ...value,
        label: key,
        code: value.code(apiKey),
      };
    });
  }, [apiKey]);
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Cài đặt API Key")}
      width="620px"
      maxWidth="95vw"
    >
      <Dialog.Body>
        <div className="space-y-5">
          {/* API Key Display */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              API Key
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-sm text-gray-800 overflow-hidden">
                <HiKey className="text-orange-500 mr-2 flex-shrink-0" />
                <span className="truncate select-all">{apiKey}</span>
              </div>
              <button
                onClick={handleCopyKey}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border ${
                  keyCopied
                    ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                {keyCopied ? (
                  <HiCheck className="text-sm" />
                ) : (
                  <HiClipboardCopy className="text-sm" />
                )}
                {keyCopied ? t("Đã chép") : t("Sao chép")}
              </button>
            </div>
          </div>

          <CodeBlock codeSample={codeSampleList} title={t("Hướng dẫn tích hợp")} />
        </div>
      </Dialog.Body>

      <Dialog.Footer>
        <div className="flex justify-end w-full gap-2">
          <Button onClick={onClose} outline>
            {t("Đóng")}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
};

export default RecaptchaPage;
