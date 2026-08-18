import { saveAs } from "file-saver";
import JSZip from "jszip";
import { dialogueLineReady, type FilmVoiceListItem } from "./film-dialogue";

function pad(n: number, size = 2): string {
  return String(n).padStart(size, "0");
}

function safeName(raw: string): string {
  return raw.replace(/[<>:"/\\|?*]+/g, "_").trim().slice(0, 60) || "voice";
}

function extOf(blob: Blob, url?: string): string {
  const type = (blob.type || "").toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("m4a") || type.includes("mp4") || type.includes("aac")) return "m4a";
  const fromUrl = String(url || "").toLowerCase();
  if (fromUrl.includes(".wav")) return "wav";
  if (fromUrl.includes(".ogg")) return "ogg";
  if (fromUrl.includes(".m4a") || fromUrl.includes(".mp4")) return "m4a";
  return "mp3";
}

async function blobOfItem(item: FilmVoiceListItem): Promise<Blob | null> {
  if (item.line.voiceBlob && item.line.voiceBlob.size > 0) return item.line.voiceBlob;
  const url = item.line.voiceUrl?.trim();
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return blob.size > 0 ? blob : null;
}

function fileNameOf(
  item: FilmVoiceListItem,
  episodeLabel: string,
  used: Set<string>
): string {
  const ep = safeName(episodeLabel || "tap");
  const scene = pad(item.scene.index || 0);
  const line = pad(item.lineIndex || 0);
  const speaker = safeName(item.line.character?.trim() || "nhan-vat");
  let name = `${ep}_c${scene}_${line}_${speaker}`;
  if (used.has(name)) name = `${name}_${item.line.id.slice(-6)}`;
  used.add(name);
  return name;
}

export async function downloadFilmVoicesZip(
  items: FilmVoiceListItem[],
  episodeLabelById: Map<string, string>
): Promise<number> {
  const ready = items.filter((item) => dialogueLineReady(item.line));
  const zip = new JSZip();
  const used = new Set<string>();
  let count = 0;

  for (const item of ready) {
    const blob = await blobOfItem(item);
    if (!blob) continue;
    const base = fileNameOf(
      item,
      episodeLabelById.get(item.scene.episodeId) || "",
      used
    );
    zip.file(`${base}.${extOf(blob, item.line.voiceUrl)}`, blob);
    count += 1;
  }

  if (!count) return 0;

  const date = new Date().toISOString().slice(0, 10);
  const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  saveAs(out, `am-thanh-phim-${date}.zip`);
  return count;
}
