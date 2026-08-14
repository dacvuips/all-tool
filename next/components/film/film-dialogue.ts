/**
 * Parse / sync dòng thoại storyboard → item "Tạo giọng".
 * Format: mỗi dòng "Tên nhân vật: lời thoại" (có thể nhiều câu).
 */
import {
  createFilmId,
  type FilmCharacterRecord,
  type FilmDialogueLineRecord,
  type FilmSceneRecord,
} from "./film-types";

export type { FilmDialogueLineRecord };

export type FilmParsedDialogue = {
  character: string;
  line: string;
};

/** Item list tab Tạo giọng (1 dòng thoại) */
export type FilmVoiceListItem = {
  key: string;
  scene: FilmSceneRecord;
  line: FilmDialogueLineRecord;
  /** Thứ tự lời trong cảnh, 1-based */
  lineIndex: number;
};

function isLikelyCharacterName(name: string): boolean {
  const n = name.trim();
  if (!n || n.length > 40) return false;
  if (/^\d{1,2}$/.test(n)) return false;
  if (/^\d{1,2}:\d{2}/.test(n)) return false;
  if (/https?:/i.test(n)) return false;
  if (n.split(/\s+/).length > 5) return false;
  return true;
}

/**
 * Tách chuỗi Thoại thành mảng { character, line }.
 * Hỗ trợ continuum khi lời thoại xuống dòng (không có "Tên:").
 */
export function parseFilmDialogueText(text: string): FilmParsedDialogue[] {
  const raw = String(text || "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!raw) return [];

  const parts = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: FilmParsedDialogue[] = [];
  let current: FilmParsedDialogue | null = null;

  for (const part of parts) {
    const m = part.match(/^([^:]{1,40}?)\s*:\s*(.*)$/);
    if (m && isLikelyCharacterName(m[1])) {
      if (current && (current.line || current.character)) out.push(current);
      current = {
        character: m[1].trim(),
        line: (m[2] || "").trim(),
      };
    } else if (current) {
      current.line = [current.line, part].filter(Boolean).join(" ");
    } else {
      current = { character: "", line: part };
    }
  }
  if (current && (current.line || current.character)) out.push(current);
  return out.filter((x) => x.line.trim().length > 0 || x.character.trim().length > 0);
}

/** Format ngược mảng structured → text "Name: line" */
export function formatFilmDialogueText(
  items: Pick<FilmParsedDialogue, "character" | "line">[]
): string {
  return (items || [])
    .map((d) => {
      const name = String(d.character || "").trim();
      const line = String(d.line || "").trim();
      if (!name && !line) return "";
      if (!name) return line;
      return `${name}: ${line}`;
    })
    .filter(Boolean)
    .join("\n");
}

export function emptyFilmDialogueLine(
  character: string,
  line: string
): FilmDialogueLineRecord {
  return {
    id: createFilmId("dl"),
    character: character.trim(),
    line: line.trim(),
    voiceStatus: "pending",
  };
}

/**
 * Merge parse text với dialogueLines cũ để giữ voiceUrl đã tạo.
 */
export function mergeFilmDialogueLines(
  parsed: FilmParsedDialogue[],
  existing: FilmDialogueLineRecord[] = []
): FilmDialogueLineRecord[] {
  if (!parsed.length) return [];
  const used = new Set<string>();

  return parsed.map((p, i) => {
    const character = p.character.trim();
    const line = p.line.trim();

    const exact = existing.find(
      (e) =>
        !used.has(e.id) &&
        e.character.trim().toLowerCase() === character.toLowerCase() &&
        e.line.trim() === line
    );
    if (exact) {
      used.add(exact.id);
      return { ...exact, character, line };
    }

    const byIndex = existing[i];
    if (
      byIndex &&
      !used.has(byIndex.id) &&
      byIndex.character.trim().toLowerCase() === character.toLowerCase()
    ) {
      used.add(byIndex.id);
      return { ...byIndex, character, line };
    }

    return emptyFilmDialogueLine(character, line);
  });
}

/** Đồng bộ dialogueLines từ field dialogue (source of truth). */
export function syncSceneDialogueLines(scene: FilmSceneRecord): FilmDialogueLineRecord[] {
  const parsed = parseFilmDialogueText(scene.dialogue || "");
  if (!parsed.length) {
    const fallback = scene.dialogue?.trim() || "";
    if (!fallback) return [];
    const character =
      scene.speakerName?.trim() || scene.characterNames?.[0]?.trim() || "";
    return mergeFilmDialogueLines(
      [{ character, line: fallback }],
      scene.dialogueLines || []
    );
  }
  return mergeFilmDialogueLines(parsed, scene.dialogueLines || []);
}

/** Scene sau khi sync dialogueLines (ghi IDB) */
export function withSyncedDialogueLines(scene: FilmSceneRecord): FilmSceneRecord {
  const dialogueLines = syncSceneDialogueLines(scene);
  return {
    ...scene,
    dialogueLines,
    speakerName:
      dialogueLines[0]?.character ||
      scene.speakerName ||
      scene.characterNames?.[0] ||
      "",
  };
}

/** Chỉ sync khi text/list lệch — tránh rewrite IDB không cần thiết */
export function needsDialogueLineSync(scene: FilmSceneRecord): boolean {
  const text = (scene.dialogue || "").trim();
  const lines = scene.dialogueLines || [];
  if (!text && !lines.length) return false;
  if (!text && lines.length) return true;
  const reformed = formatFilmDialogueText(lines).trim();
  if (reformed === text) return false;
  // parsed length khác stored
  const parsed = parseFilmDialogueText(text);
  if (!parsed.length && text) {
    return lines.length !== 1 || lines[0]?.line?.trim() !== text;
  }
  if (parsed.length !== lines.length) return true;
  return !parsed.every(
    (p, i) =>
      lines[i]?.character?.trim() === p.character.trim() &&
      lines[i]?.line?.trim() === p.line.trim()
  );
}

export function hydrateScenesDialogueLines(
  scenes: FilmSceneRecord[]
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((s) => {
    if (!needsDialogueLineSync(s)) return s;
    const synced = withSyncedDialogueLines(s);
    changed.push(synced);
    return synced;
  });
  return { scenes: next, changed };
}

export function dialogueLineReady(line: FilmDialogueLineRecord): boolean {
  return line.voiceStatus === "ready" || !!line.voiceUrl;
}

export function dialogueLineCreating(line: FilmDialogueLineRecord): boolean {
  return line.voiceStatus === "creating";
}

/** Nhân vật xuất hiện trong thoại (tab Tạo giọng) */
export type FilmVoiceSpeakerItem = {
  key: string;
  name: string;
  lineCount: number;
  character: FilmCharacterRecord | null;
};

/** Gộp tên nhân vật unique từ list thoại, khớp record ảnh nếu có. */
export function buildFilmVoiceSpeakerRoster(
  items: FilmVoiceListItem[],
  characters: FilmCharacterRecord[] = []
): FilmVoiceSpeakerItem[] {
  const byName = new Map(
    characters
      .map((c) => [c.name.trim().toLowerCase(), c] as const)
      .filter(([k]) => !!k)
  );
  const order: string[] = [];
  const counts = new Map<string, { name: string; count: number }>();

  for (const item of items) {
    const name = item.line.character?.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    const prev = counts.get(k);
    if (!prev) {
      order.push(k);
      counts.set(k, { name, count: 1 });
    } else {
      prev.count += 1;
    }
  }

  return order.map((k) => {
    const character = byName.get(k) || null;
    const entry = counts.get(k)!;
    return {
      key: character?.id || `name:${k}`,
      name: character?.name || entry.name,
      lineCount: entry.count,
      character,
    };
  });
}

/** Flatten scenes → list card Tạo giọng */
export function buildFilmVoiceListItems(scenes: FilmSceneRecord[]): FilmVoiceListItem[] {
  const sorted = [...scenes].sort((a, b) => a.index - b.index);
  const items: FilmVoiceListItem[] = [];
  for (const scene of sorted) {
    const lines = syncSceneDialogueLines(scene);
    lines.forEach((line, i) => {
      items.push({
        key: `${scene.id}:${line.id}`,
        scene,
        line,
        lineIndex: i + 1,
      });
    });
  }
  return items;
}

/** Cập nhật 1 dialogue line trong scene */
export function patchSceneDialogueLine(
  scene: FilmSceneRecord,
  lineId: string,
  patch: Partial<FilmDialogueLineRecord>
): FilmSceneRecord {
  const lines = syncSceneDialogueLines(scene);
  const dialogueLines = lines.map((l) =>
    l.id === lineId ? { ...l, ...patch } : l
  );
  return {
    ...scene,
    dialogueLines,
    speakerName: dialogueLines[0]?.character || scene.speakerName,
    voiceStatus: dialogueLines.every(dialogueLineReady)
      ? "ready"
      : dialogueLines.some(dialogueLineCreating)
        ? "creating"
        : dialogueLines.some((l) => l.voiceStatus === "error")
          ? "error"
          : "pending",
    voiceUrl: dialogueLines.find(dialogueLineReady)?.voiceUrl || scene.voiceUrl || "",
    updatedAt: new Date().toISOString(),
  };
}
