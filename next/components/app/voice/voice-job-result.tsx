import { useTranslation } from "react-i18next";
import { extractJobMedia, type MicroxJob } from "./voice-types";

type Props = {
  job: MicroxJob | null;
  loading?: boolean;
};

export function VoiceJobResult({ job, loading }: Props) {
  const { t } = useTranslation();
  if (!job && !loading) {
    return (
      <div className="p-6 text-sm text-gray-500 bg-white rounded-xl border border-gray-200">
        {t("Kết quả sẽ hiện ở đây sau khi chạy.")}
      </div>
    );
  }

  const status = String(job?.status || (loading ? "processing" : "")).toLowerCase();
  const media = job ? extractJobMedia(job) : { urls: [], voiceIds: [], texts: [] };
  const amount = job?.usage?.amount;

  return (
    <div className="p-4 space-y-4 bg-white rounded-xl border border-gray-200">
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-semibold text-gray-800">{t("Job")}</span>
        {job?.id && (
          <code className="px-2 py-0.5 text-xs bg-gray-100 rounded">{String(job.id)}</code>
        )}
        <span
          className={`px-2 py-0.5 text-xs font-medium rounded-full ${
            status === "completed"
              ? "bg-emerald-50 text-emerald-700"
              : status === "failed"
                ? "bg-red-50 text-red-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {status || "…"}
        </span>
        {amount != null && (
          <span className="text-xs text-gray-500">
            {t("Credits")}: {amount}
          </span>
        )}
      </div>

      {media.voiceIds.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-gray-500">{t("Voice ID")}</div>
          <div className="flex flex-col gap-1">
            {media.voiceIds.map((id) => (
              <code key={id} className="px-2 py-1 text-xs break-all bg-gray-50 rounded">
                {id}
              </code>
            ))}
          </div>
        </div>
      )}

      {media.urls.length > 0 && (
        <div className="space-y-3">
          {media.urls.map((url) => (
            <div key={url}>
              <audio controls src={url} className="w-full" />
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline"
              >
                {t("Tải / mở file")}
              </a>
            </div>
          ))}
        </div>
      )}

      {media.texts.map((item) => (
        <div key={item.label}>
          <div className="mb-1 text-xs font-medium text-gray-500 uppercase">{item.label}</div>
          <pre className="overflow-auto p-3 max-h-64 text-xs whitespace-pre-wrap bg-gray-50 rounded">
            {item.value}
          </pre>
        </div>
      ))}

      {job && (
        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer">{t("JSON job")}</summary>
          <pre className="overflow-auto p-3 mt-2 max-h-72 whitespace-pre-wrap bg-gray-50 rounded">
            {JSON.stringify(job, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
