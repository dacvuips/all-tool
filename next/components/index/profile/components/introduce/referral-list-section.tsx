import { useTranslation } from "react-i18next";
import { RiGroupLine } from "react-icons/ri";
import { Introduce } from "../../../../../lib/repo/introduce/introduce.repo";
import { NotifyText } from "../../../../shared/common/notify-text";
import { Spinner } from "../../../../shared/utilities/misc";
import { ReferralCard } from "./referral-card";

interface ReferralListSectionProps {
  introduces: Introduce[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  setPage: (updater: number | ((p: number) => number)) => void;
}

export function ReferralListSection({
  introduces,
  loading,
  total,
  page,
  totalPages,
  limit,
  setPage,
}: ReferralListSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <RiGroupLine className="text-lg text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base">
              {t("Danh sách người được bạn giới thiệu")}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {total} {t("người")}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 md:p-5">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <Spinner />
            <p className="mt-3 text-sm text-gray-400">{t("Đang tải...")}</p>
          </div>
        ) : introduces.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
              <RiGroupLine className="text-4xl text-gray-300" />
            </div>
            <h4 className="font-semibold text-gray-500 mb-1">{t("Chưa có ai")}</h4>
            <p className="text-sm text-gray-400 max-w-xs mx-auto">
              {t("Chia sẻ mã giới thiệu của bạn để mời bạn bè tham gia")}
            </p>
          </div>
        ) : (
          <>
            <NotifyText
              color="blue"
              text={t(
                "Mỗi lần người được bạn giới thiệu nạp gói thành công bạn sẽ nhận được 5% - 10% trên mỗi đơn nạp gói của người đó, không giới hạn số lần"
              )}
              className="mb-2"
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {introduces.map((item, idx) => (
                <ReferralCard key={item.id} item={item} index={(page - 1) * limit + idx} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6 mt-4 border-t border-gray-100">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  ← {t("Trước")}
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
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
                        className={`w-9 h-9 text-sm font-medium rounded-xl border transition-all duration-200 cursor-pointer ${
                          page === pageNum
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
                >
                  {t("Sau")} →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
