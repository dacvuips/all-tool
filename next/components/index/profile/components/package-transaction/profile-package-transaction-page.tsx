import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiExchangeLine } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  PackageTransaction,
  PackageTransactionSnapshot,
  PackageTransactionTypeEnum,
  packageTransactionService,
} from "../../../../../lib/repo/package-transaction/package-transaction.repo";
import { Spinner } from "../../../../shared/utilities/misc";

const TYPE_LABELS: Record<PackageTransactionTypeEnum, { label: string; color: string }> = {
  [PackageTransactionTypeEnum.DAILY_RESET_COUNT]: {
    label: "Reset hàng ngày",
    color: "bg-blue-100 text-blue-700",
  },
  [PackageTransactionTypeEnum.EXPIRED_DOWNGRADE]: {
    label: "Hết hạn gói",
    color: "bg-red-100 text-red-700",
  },
  [PackageTransactionTypeEnum.PAYMENT]: {
    label: "Thanh toán",
    color: "bg-green-100 text-green-700",
  },
  [PackageTransactionTypeEnum.MANUAL_ADJUST]: {
    label: "Điều chỉnh",
    color: "bg-yellow-100 text-yellow-700",
  },
};

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

function SnapshotCell({ snapshot }: { snapshot?: PackageTransactionSnapshot }) {
  if (!snapshot) return <span className="text-gray-300">—</span>;

  const items: string[] = [];
  if (snapshot.subscription) items.push(`Gói: ${snapshot.subscription}`);
  if (snapshot.videoCount !== undefined && snapshot.videoCount !== null)
    items.push(`Video: ${snapshot.videoCount}/${snapshot.videoLimit ?? "—"}`);
  if (snapshot.imageCount !== undefined && snapshot.imageCount !== null)
    items.push(`Ảnh: ${snapshot.imageCount}/${snapshot.imageLimit ?? "—"}`);
  if (snapshot.imageStreamCount !== undefined && snapshot.imageStreamCount !== null)
    items.push(`Stream ảnh: ${snapshot.imageStreamCount}`);
  if (snapshot.videoStreamCount !== undefined && snapshot.videoStreamCount !== null)
    items.push(`Stream video: ${snapshot.videoStreamCount}`);
  if (snapshot.expiryPackageDate) items.push(`HH: ${formatDate(snapshot.expiryPackageDate)}`);

  return (
    <div className="text-xs text-gray-600 space-y-0.5 min-w-[140px]">
      {items.map((item, i) => (
        <div key={i}>{item}</div>
      ))}
    </div>
  );
}

export function ProfilePackageTransactionPage() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const [transactions, setTransactions] = useState<PackageTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchTransactions = async (p: number) => {
    try {
      setLoading(true);
      const res = await packageTransactionService.getAll({
        query: {
          limit,
          page: p,
          order: { createdAt: -1 },
        },
        cache: false,
      });
      console.log(res.data);
      setTransactions(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(t("Không thể tải danh sách giao dịch"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      fetchTransactions(page);
    }
  }, [customer, page]);

  const totalPages = Math.ceil(total / limit);

  return (
    <section className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex gap-2 items-center px-3 py-2 border-gray-100">
        <RiExchangeLine className="text-xl text-primary" />
        <div>
          <p className="font-semibold text-gray-800">{t("Lịch sử giao dịch gói")}</p>
          <p className="text-xs text-gray-500">
            {t("Tổng cộng")} {total} {t("giao dịch")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <Spinner />
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <RiExchangeLine className="text-4xl mx-auto mb-2 opacity-50" />
          <p>{t("Chưa có giao dịch nào")}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3 w-12">#</th>
                  <th className="px-4 py-3">{t("Loại")}</th>
                  <th className="px-4 py-3">{t("Mô tả")}</th>
                  <th className="px-4 py-3">{t("Trước")}</th>
                  <th className="px-4 py-3">{t("Sau")}</th>
                  <th className="px-4 py-3">{t("Ngày tạo")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx, idx) => {
                  const typeInfo = TYPE_LABELS[tx.type] || {
                    label: tx.type,
                    color: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-400 font-medium">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${typeInfo.color}`}
                        >
                          {t(typeInfo.label)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[260px] truncate">
                        {tx.description}
                      </td>
                      <td className="px-4 py-3">
                        <SnapshotCell snapshot={tx.before} />
                      </td>
                      <td className="px-4 py-3">
                        <SnapshotCell snapshot={tx.after} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(tx.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← {t("Trước")}
              </button>
              <span className="text-sm text-gray-600">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t("Sau")} →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
