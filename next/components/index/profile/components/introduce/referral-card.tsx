import { useTranslation } from "react-i18next";
import { RiMailLine, RiShieldCheckLine, RiShoppingBagLine, RiTimeLine } from "react-icons/ri";
import { Introduce } from "../../../../../lib/repo/introduce/introduce.repo";
import { Img } from "../../../../shared/utilities/misc";

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  if (diffDays < 7) return `${diffDays} ngày trước`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} tháng trước`;
  return `${Math.floor(diffDays / 365)} năm trước`;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export function ReferralCard({ item, index }: { item: Introduce; index: number }) {
  const { t } = useTranslation();
  const referee = item.referee;
  const orderCount = item.orders?.length ?? 0;
  const totalDiscount = item.orders?.reduce((sum, o) => sum + (o.discountPrice ?? 0), 0) ?? 0;

  return (
    <div
      className="group relative bg-white rounded-2xl border border-gray-100 p-4 md:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Status indicator */}
      <div className="absolute top-3 right-3">
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            item.blocked
              ? "bg-red-50 text-red-600 border border-red-100"
              : "bg-emerald-50 text-emerald-600 border border-emerald-100"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              item.blocked ? "bg-red-500" : "bg-emerald-500 animate-pulse"
            }`}
          />
          {item.blocked ? t("Đã khoá") : t("Hoạt động")}
        </span>
      </div>

      <div className="flex items-start gap-3.5">
        {/* Avatar with rank number */}
        <div className="relative flex-shrink-0">
          <div className="relative">
            <Img
              src={referee?.avatarUrl}
              avatar
              className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover border-2 border-gray-100 group-hover:border-primary/30 transition-colors duration-300"
            />
            {/* Rank badge */}
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-primary-dark text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              #{index + 1}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h4 className="text-sm md:text-base font-bold text-gray-800 truncate pr-20 group-hover:text-primary transition-colors">
            {referee?.name || t("Chưa cập nhật")}
          </h4>

          <div className="mt-1.5 flex flex-col gap-1">
            {referee?.email && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <RiMailLine className="flex-shrink-0 text-gray-400" />
                <span className="truncate">{referee.email}</span>
              </div>
            )}
            {referee?.code && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <RiShieldCheckLine className="flex-shrink-0 text-gray-400" />
                <span className="font-mono text-gray-600">{referee.code}</span>
              </div>
            )}
          </div>

          {/* Orders stats */}
          {orderCount > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
              <RiShoppingBagLine className="flex-shrink-0" />
              <span>
                {orderCount} {t("đơn")} · {formatCurrency(totalDiscount)}
              </span>
            </div>
          )}

          {/* Time info */}
          <div className="mt-2.5 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 text-[11px] text-gray-400">
              <RiTimeLine className="text-xs" />
              <span>{timeAgo(item.createdAt)}</span>
            </div>
            <div className="hidden md:block text-[11px] text-gray-300">
              {formatDate(item.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

