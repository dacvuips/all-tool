import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDownload2Line } from "react-icons/ri";
import { VoiceCatalogCard } from "./voice-catalog-card";
import {
  VoiceCatalogFilters,
  type VoiceCatalogView,
  type VoiceFilterValue,
} from "./voice-catalog-filters";
import { resultFeatureOf, type VoiceResultRecord } from "./voice-idb";
import { useVoiceContext } from "./voice-provider";
import { getVoiceTool } from "./voice-tools-config";
import type { MicroxVoice } from "./voice-types";

function extOf(mime: string): string {
  const type = (mime || "").toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("m4a") || type.includes("mp4")) return "m4a";
  return "mp3";
}

function safeName(raw: string): string {
  return raw.replace(/[<>:"/\\|?*]+/g, "_").trim().slice(0, 80) || "voice";
}

function formatWhen(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function recordVoice(item: VoiceResultRecord): MicroxVoice {
  const id = item.id || item.voiceId || item.jobId;
  const base = String(item.voice?.name || item.voice?.display_name || item.voiceId || item.jobId);
  return {
    ...(item.voice || {}),
    id,
    voice_id: item.voiceId || item.jobId,
    name: base,
    capabilities: item.voice?.capabilities || [item.tool],
  };
}

function matchesFilters(item: VoiceResultRecord, filters: VoiceFilterValue): boolean {
  const voice = recordVoice(item);
  const query = filters.query.trim().toLowerCase();
  if (query) {
    const hay = `${voice.name || ""} ${item.voiceId} ${item.tool}`.toLowerCase();
    if (!hay.includes(query)) return false;
  }
  const gender = String(voice.gender || voice.sex || "").toLowerCase();
  if (filters.gender && !gender.includes(filters.gender)) return false;
  const category = String(voice.category || voice.role || "").toLowerCase();
  if (filters.category && !category.includes(filters.category)) return false;
  const accent = String(voice.accent || voice.region || "").toLowerCase();
  if (filters.accent && !accent.includes(filters.accent)) return false;
  return true;
}

function downloadOne(item: VoiceResultRecord) {
  const blob = item.blobs?.[0];
  if (!blob) return;
  const voice = recordVoice(item);
  const name = safeName(String(voice.name || item.voiceId || "voice"));
  saveAs(blob, `${name}.${extOf(item.mimeTypes?.[0] || blob.type)}`);
}

export function MyVoicesPanel({
  records,
  heading,
  emptyText,
  showToolTag = false,
  onSelect,
  selectText,
  defaultView,
}: {
  records?: VoiceResultRecord[];
  heading?: string;
  emptyText?: string;
  showToolTag?: boolean;
  onSelect?: (record: VoiceResultRecord) => void;
  selectText?: string;
  defaultView?: VoiceCatalogView;
}) {
  const { t } = useTranslation();
  const { library, removeHistory } = useVoiceContext();
  const source = records || library;
  const [view, setView] = useState<VoiceCatalogView>(defaultView || "grid");
  const [zipping, setZipping] = useState(false);
  const [filters, setFilters] = useState<VoiceFilterValue>({
    capability: "",
    language: "",
    gender: "",
    accent: "",
    engine: "",
    query: "",
    sort: "popular",
    category: "",
  });

  const blobUrls = useMemo(() => {
    const map: Record<string, string> = {};
    source.forEach((item) => {
      const blob = item.blobs?.[0];
      if (blob) map[item.id] = URL.createObjectURL(blob);
      else if (item.urls?.[0]) map[item.id] = item.urls[0];
    });
    return map;
  }, [source]);

  useEffect(() => {
    return () => {
      Object.values(blobUrls).forEach((url) => {
        try {
          if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      });
    };
  }, [blobUrls]);

  const items = useMemo(() => {
    const list = source.filter((item) => matchesFilters(item, filters));
    if (filters.sort === "name") {
      return [...list].sort((a, b) =>
        String(recordVoice(a).name).localeCompare(String(recordVoice(b).name))
      );
    }
    return list;
  }, [source, filters]);

  const downloadAll = async () => {
    if (!items.length || zipping) return;
    setZipping(true);
    try {
      const zip = new JSZip();
      const used = new Set<string>();
      items.forEach((item, index) => {
        const blob = item.blobs?.[0];
        if (!blob) return;
        const voice = recordVoice(item);
        let file = `${safeName(
          String(voice.name || item.voiceId || `voice-${index + 1}`)
        )}-${item.tool}-${index + 1}.${extOf(item.mimeTypes?.[0] || blob.type)}`;
        if (used.has(file)) file = `${index + 1}-${file}`;
        used.add(file);
        zip.file(file, blob);
      });
      const out = await zip.generateAsync({ type: "blob" });
      saveAs(out, "voice-cua-toi.zip");
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-4 bg-white p-2 rounded-md">
      <VoiceCatalogFilters
        value={filters}
        view={view}
        total={items.length}
        loading={false}
        heading={heading || t("Giọng đã lưu")}
        onChange={setFilters}
        onViewChange={setView}
        extra={
          <button
            type="button"
            disabled={!items.length || zipping}
            onClick={() => void downloadAll()}
            className="inline-flex gap-1.5 items-center px-3 h-9 text-xs font-semibold text-white rounded-lg border-0 disabled:cursor-default"
            style={{ background: items.length && !zipping ? "#4f46e5" : "#d1d5db" }}
          >
            <RiDownload2Line className="text-base" />
            {zipping ? t("Đang nén...") : t("Tải tất cả")}
          </button>
        }
      />
      {!source.length ? (
        <p className="py-10 text-sm text-center text-slate-500">
          {emptyText || t("Chưa có voice tự tạo. Chạy TTS, Clone hoặc Chuyển giọng để lưu vào đây.")}
        </p>
      ) : !items.length ? (
        <p className="py-10 text-sm text-center text-slate-500">{t("Không có giọng khớp bộ lọc")}</p>
      ) : (
        <div
          className={
            view === "list"
              ? "flex flex-col gap-3"
              : "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          }
        >
          {items.map((item) => {
            const voice = recordVoice(item);
            const meta = getVoiceTool(item.tool);
            const feature = t(resultFeatureOf(item, meta.labelKey));
            const when = formatWhen(item.createdAt);
            const tag = [voice.name !== feature ? voice.name : "", showToolTag ? t(meta.labelKey) : "", when]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200">
                <VoiceCatalogCard
                  voice={{ ...voice, name: feature }}
                  variant={view}
                  showSave={false}
                  audioSrc={blobUrls[item.id]}
                  tag={tag}
                  accentColor={meta.color}
                  onDownload={() => downloadOne(item)}
                  onClear={() => void removeHistory(item.id)}
                  onPick={onSelect ? () => onSelect(item) : undefined}
                />
                {onSelect ? (
                  <div className="px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="w-full h-8 text-xs font-semibold text-white rounded-lg border-0 cursor-pointer"
                      style={{ background: meta.color }}
                    >
                      {selectText || t("Dùng giọng này")}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
