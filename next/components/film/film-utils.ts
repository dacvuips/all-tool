import { FilmProjectRecord } from "./film-types";

export function filmTimeAgo(dateStr?: string, t?: (key: string) => string): string {
  if (!dateStr) return "";
  const translate = t || ((k: string) => k);
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return "";

  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return translate("Vừa xong");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${translate("phút trước")}`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} ${translate("giờ trước")}`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return translate("Hôm qua");
  if (diffDays < 7) return `${diffDays} ${translate("ngày trước")}`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${translate("tuần trước")}`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${translate("tháng trước")}`;
  return `${Math.floor(diffDays / 365)} ${translate("năm trước")}`;
}

/** @deprecated Dùng listFilmProjects / createFilmProject từ film-idb */
export type { FilmProjectRecord as FilmProject };
