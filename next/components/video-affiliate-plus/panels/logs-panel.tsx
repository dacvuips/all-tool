import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronLeft, HiChevronRight, HiOutlineTrash } from "react-icons/hi";
import { Button } from "../../shared/utilities/form";
import { AffiliatePlusLog } from "../types";

interface LogsPanelProps {
  logs: AffiliatePlusLog[];
  onClearLogs: () => void;
}

type LevelFilter = "all" | AffiliatePlusLog["level"];

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

const LEVEL_META: Record<AffiliatePlusLog["level"], { label: string; className: string }> = {
  info: { label: "Info", className: "bg-info text-white" },
  success: { label: "Success", className: "bg-success text-white" },
  warning: { label: "Warning", className: "bg-warning text-white" },
  error: { label: "Error", className: "bg-danger text-white" },
};

const FILTER_OPTIONS: { value: LevelFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

export function LogsPanel({ logs, onClearLogs }: LogsPanelProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");

  const filteredLogs = useMemo(() => {
    if (levelFilter === "all") return logs;
    return logs.filter((log) => log.level === levelFilter);
  }, [logs, levelFilter]);

  const levelCounts = useMemo(() => {
    const counts: Record<LevelFilter, number> = {
      all: logs.length,
      info: 0,
      success: 0,
      warning: 0,
      error: 0,
    };
    for (const log of logs) {
      counts[log.level] += 1;
    }
    return counts;
  }, [logs]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;

  const pageLogs = useMemo(
    () => filteredLogs.slice(pageStartIndex, pageStartIndex + pageSize),
    [filteredLogs, pageStartIndex, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, levelFilter, logs.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center">
        <h3 className="m-0 text-sm font-bold text-gray-700">
          {t("Nhật ký hoạt động")} ({filteredLogs.length}
          {levelFilter !== "all" ? ` / ${logs.length}` : ""})
        </h3>
        {logs.length > 0 && (
          <Button
            icon={<HiOutlineTrash />}
            text={t("Xóa nhật ký")}
            onClick={() => {
              if (confirm(t("Xóa toàn bộ nhật ký?"))) onClearLogs();
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500">{t("Lọc trạng thái")}:</span>
        {FILTER_OPTIONS.map((opt) => {
          const active = levelFilter === opt.value;
          const count = levelCounts[opt.value];
          const colorClass =
            opt.value === "all"
              ? active
                ? "bg-primary text-white border-primary"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              : active
              ? `${LEVEL_META[opt.value].className} border-transparent`
              : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50";
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setLevelFilter(opt.value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${colorClass}`}
            >
              {t(opt.label)}
              <span
                className={`inline-flex min-w-5 justify-center rounded-full px-1.5 text-10 font-bold ${
                  active ? "bg-white bg-opacity-25 text-inherit" : "bg-gray-100 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="overflow-hidden bg-white rounded-xl border border-gray-200">
        {logs.length === 0 ? (
          <div className="py-12 text-sm text-center text-gray-400">{t("Chưa có nhật ký")}</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-sm text-center text-gray-400">
            {t("Không có nhật ký khớp bộ lọc.")}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-600 uppercase bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 w-40 text-left">{t("Thời gian")}</th>
                    <th className="px-4 py-3 w-28 text-left">{t("Trạng thái")}</th>
                    <th className="px-4 py-3 text-left">{t("Nội dung")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageLogs.map((log) => {
                    const meta = LEVEL_META[log.level] || LEVEL_META.info;
                    return (
                      <tr key={log.id} className="bg-white hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-500">
                          {formatTime(log.time)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex h-6 items-center rounded-full px-2.5 text-10 font-bold uppercase ${meta.className}`}
                          >
                            {t(meta.label)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">{log.message}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-3 justify-between items-center px-4 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex gap-3 items-center text-xs text-gray-500">
                <span>
                  {t("Trang")} <b className="text-gray-800">{safePage}</b>/{totalPages}
                  <span className="mx-1 text-gray-300">·</span>
                  {pageStartIndex + 1}–{Math.min(safePage * pageSize, filteredLogs.length)} /{" "}
                  {filteredLogs.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 50)}
                  className="px-1.5 h-7 text-xs bg-white rounded-md border border-gray-200"
                  aria-label={t("Số dòng mỗi trang")}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}/{t("trang")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 items-center">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex justify-center items-center w-7 h-7 text-gray-700 bg-white rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={t("Trang trước")}
                >
                  <HiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - safePage) <= 1;
                  })
                  .reduce<number[]>((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push(-p);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p) =>
                    p < 0 ? (
                      <span key={`e${p}`} className="px-1 text-xs text-gray-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`inline-flex h-7 items-center justify-center rounded-md border px-1.5 text-xs font-semibold ${
                          p === safePage
                            ? "text-white border-primary bg-primary"
                            : "text-gray-700 bg-white border-gray-200 hover:bg-gray-50"
                        }`}
                        style={{ minWidth: "1.75rem" }}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex justify-center items-center w-7 h-7 text-gray-700 bg-white rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={t("Trang sau")}
                >
                  <HiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
