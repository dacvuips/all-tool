import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiFileCopyLine,
  RiMailLine,
  RiSendPlaneLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiUserAddLine,
  RiUserHeartLine,
} from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Introduce, introduceService } from "../../../../../lib/repo/introduce/introduce.repo";
import { NotifyText } from "../../../../shared/common/notify-text";
import { Img, Spinner } from "../../../../shared/utilities/misc";
import { timeAgo } from "./referral-card";
import { ReferralListSection } from "./referral-list-section";

/** Card hiển thị thông tin người đã giới thiệu mình */
function MyReferrerSection() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();

  const [referrerRecord, setReferrerRecord] = useState<Introduce | null>(null);
  const [loadingReferrer, setLoadingReferrer] = useState(true);
  const [introduceCode, setIntroduceCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMyReferrer = async () => {
    try {
      setLoadingReferrer(true);
      const res = await introduceService.getMyReferrer();
      setReferrerRecord(res);
    } catch (err) {
      // Không có referrer -> null
      setReferrerRecord(null);
    } finally {
      setLoadingReferrer(false);
    }
  };

  useEffect(() => {
    if (customer) {
      fetchMyReferrer();
    }
  }, [customer]);

  const handleSubmitCode = async () => {
    if (!introduceCode.trim()) {
      toast.error(t("Vui lòng nhập mã giới thiệu"));
      return;
    }
    if (introduceCode.trim() === customer?.code) {
      toast.error(t("Không thể tự giới thiệu chính mình"));
      return;
    }
    try {
      setSubmitting(true);
      const res = await introduceService.updateMyReferrer(introduceCode.trim());
      setReferrerRecord(res);
      setIntroduceCode("");
      toast.success(t("Cập nhật người giới thiệu thành công"));
    } catch (err: any) {
      toast.error(err.message || t("Không thể cập nhật người giới thiệu"));
    } finally {
      setSubmitting(false);
    }
  };

  const referrer = referrerRecord?.referrer;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <RiUserHeartLine className="text-lg text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm md:text-base">
              {t("Người đã giới thiệu bạn")}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {referrerRecord
                ? t("Thông tin người giới thiệu")
                : t("Cập nhật mã giới thiệu nếu có")}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-5">
        {loadingReferrer ? (
          <div className="py-8 flex flex-col items-center justify-center">
            <Spinner />
            <p className="mt-3 text-sm text-gray-400">{t("Đang tải...")}</p>
          </div>
        ) : referrerRecord && referrer ? (
          /* Hiển thị thông tin người giới thiệu */
          <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <div className="relative flex-shrink-0">
              <Img
                src={referrer.avatarUrl}
                avatar
                className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover border-2 border-blue-200"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                <RiUserHeartLine className="text-[10px]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base md:text-lg font-bold text-gray-800 truncate">
                {referrer.name || t("Chưa cập nhật")}
              </h4>
              <div className="mt-1 flex flex-col gap-1">
                {referrer.email && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <RiMailLine className="flex-shrink-0 text-gray-400" />
                    <span className="truncate">{referrer.email}</span>
                  </div>
                )}
                {referrer.code && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <RiShieldCheckLine className="flex-shrink-0 text-blue-400" />
                    <span className="font-mono text-blue-600 font-semibold">{referrer.code}</span>
                  </div>
                )}
              </div>
              {referrerRecord.createdAt && (
                <div className="mt-2 flex items-center gap-1 text-[11px] text-gray-400">
                  <RiTimeLine className="text-xs" />
                  <span>
                    {t("Giới thiệu từ")} {timeAgo(referrerRecord.createdAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Form nhập mã giới thiệu */
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              {t("Bạn chưa có người giới thiệu. Nhập mã giới thiệu để cập nhật.")}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={introduceCode}
                onChange={(e) => setIntroduceCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !submitting) handleSubmitCode();
                }}
                placeholder={t("Nhập mã giới thiệu...")}
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 placeholder:text-gray-300"
                disabled={submitting}
              />
              <button
                onClick={handleSubmitCode}
                disabled={submitting || !introduceCode.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary-dark transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-none cursor-pointer shadow-sm shadow-primary/20"
              >
                {submitting ? <Spinner className="w-4 h-4" /> : <RiSendPlaneLine />}
                {t("Cập nhật")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileIntroduce() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const toast = useToast();
  const [introduces, setIntroduces] = useState<Introduce[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 12;

  const fetchIntroduces = async (p: number) => {
    try {
      setLoading(true);
      const res = await introduceService.getMyIntroduces({
        query: {
          limit,
          page: p,
          order: { createdAt: -1 },
        },
      });
      setIntroduces(res.data);
      setTotal(res.total);
    } catch (err) {
      toast.error(t("Không thể tải danh sách giới thiệu"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customer) {
      fetchIntroduces(page);
    }
  }, [customer, page]);

  const totalPages = Math.ceil(total / limit);

  const handleCopyCode = () => {
    if (customer?.code) {
      copy(customer.code);
      toast.success(t("Đã sao chép mã giới thiệu"));
    }
  };

  return (
    <section className="space-y-4">
      {/* 2-column grid: Referral Code | My Referrer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Col 1: Referral Code Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-4 md:p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <RiUserAddLine className="text-xl text-primary" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-gray-800">
                  {t("Chương trình giới thiệu")}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{t("Chia sẻ mã để nhận thưởng")}</p>
              </div>
            </div>

            {/* Active badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">
                {t("Đang hoạt động")}
              </span>
            </div>
          </div>

          {/* Referral code box */}
          <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/3 p-4 md:p-5">
            <div className="uppercase text-gray-400 font-semibold mb-2">
              {t("Mã giới thiệu của bạn")}
            </div>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-2xl md:text-3xl font-black tracking-widest text-gray-800 font-mono">
                {customer?.code || "—"}
              </code>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white font-semibold text-sm rounded-xl hover:bg-primary-dark transition-all duration-200 active:scale-95 border-none cursor-pointer shadow-md shadow-primary/20 flex-shrink-0"
              >
                <RiFileCopyLine />
                {t("Sao chép")}
              </button>
            </div>
            <NotifyText
              color="blue"
              text={t(
                "Chia sẻ mã giới thiệu của bạn với bạn bè để nhận thưởng, bạn sẽ nhận được 5% - 10% trên mỗi đơn nạp gói của người được bạn giới thiệu"
              )}
              className="mt-2"
            />
            <NotifyText color="green" text={t("Đồng hành cùng phát triển")} className="mt-2" />
          </div>
        </div>

        {/* Col 2: My Referrer */}
        <MyReferrerSection />
      </div>

      {/* Referral List - full width */}
      <ReferralListSection
        introduces={introduces}
        loading={loading}
        total={total}
        page={page}
        totalPages={totalPages}
        limit={limit}
        setPage={setPage}
      />
    </section>
  );
}
