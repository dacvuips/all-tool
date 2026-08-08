/**
 * Ticker ngang: 10 job media thành công mới nhất.
 * Poll ~30s, chạy chậm từ phải sang trái.
 * Nằm trong document flow (không fixed/sticky) — scroll cùng trang.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/providers/auth-provider";
import {
  getMediaGenerationJobTypeLabel,
  MediaGenerationJobService,
  RecentSucceededMediaJob,
} from "../../lib/repo/media-generation-job/media-generation-job.repo";
import { Img } from "./utilities/misc";

const POLL_MS = 30_000;

function TickerItem({ job }: { job: RecentSucceededMediaJob }) {
  const { t } = useTranslation();
  const typeLabel = getMediaGenerationJobTypeLabel(job.type);

  return (
    <div className="flex flex-shrink-0 gap-1 items-center px-3 h-8 bg-emerald-50 rounded-full">
      <Img
        src={job.customerAvatarUrl}
        className="w-6"
        imageClassName="rounded-full border border-white shadow-sm"
        avatar
      />
      <span className="text-xs text-gray-700 whitespace-nowrap">
        <span className="font-semibold text-gray-900">{job.customerName || t("Thành viên")}</span>
        <span className="mx-1 text-gray-400">·</span>
        <span>{typeLabel}</span>
        <span className="ml-1 font-medium text-emerald-600">{t("thành công")}</span>
      </span>
    </div>
  );
}

export function MediaGenerationSuccessTicker() {
  const { customer } = useAuth();
  const [jobs, setJobs] = useState<RecentSucceededMediaJob[]>([]);

  const loadJobs = useCallback(async () => {
    if (!customer) {
      setJobs([]);
      return;
    }
    try {
      const data = await MediaGenerationJobService.getRecentSucceededJobs(10);
      setJobs(Array.isArray(data) ? data.filter((j) => j?.id) : []);
    } catch {
      // Giữ danh sách cũ nếu poll lỗi tạm thời
    }
  }, [customer]);

  useEffect(() => {
    loadJobs();
    if (!customer) return;
    const timer = window.setInterval(loadJobs, POLL_MS);
    return () => window.clearInterval(timer);
  }, [customer, loadJobs]);

  /** Nhân đôi list để loop seamless với translateX(-50%). */
  const loopItems = useMemo(() => {
    if (!jobs.length) return [];
    return [...jobs, ...jobs];
  }, [jobs]);

  if (!customer || !loopItems.length) return null;

  return (
    <div className="overflow-hidden relative w-full h-9 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-b border-emerald-100/90">
      <div className="flex gap-3 items-center h-full w-max animate-media-success-marquee hover:[animation-play-state:paused]">
        {loopItems.map((job, index) => (
          <TickerItem key={`${job.id}-${index}`} job={job} />
        ))}
      </div>
      <style jsx global>{`
        @keyframes media-success-marquee {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-media-success-marquee {
          animation: media-success-marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
