import { useTranslation } from "react-i18next";
import { HiOutlineTrash } from "react-icons/hi";
import { Button } from "../../shared/utilities/form";
import { AffiliatePlusLog } from "../types";

interface LogsPanelProps {
  logs: AffiliatePlusLog[];
  onClearLogs: () => void;
}

const LEVEL_STYLES: Record<AffiliatePlusLog["level"], string> = {
  info: "bg-sky-50 text-sky-700 border-sky-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
};

export function LogsPanel({ logs, onClearLogs }: LogsPanelProps) {
  const { t } = useTranslation();

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
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-gray-700 m-0">
          {t("Nhật ký hoạt động")} ({logs.length})
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-[600px] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">{t("Chưa có nhật ký")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-800 text-white text-xs uppercase">
                <th className="px-4 py-3 text-left w-40">{t("Thời gian")}</th>
                <th className="px-4 py-3 text-left w-24">Level</th>
                <th className="px-4 py-3 text-left">{t("Nội dung")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{formatTime(log.time)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-10 font-bold uppercase border ${
                        LEVEL_STYLES[log.level]
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
