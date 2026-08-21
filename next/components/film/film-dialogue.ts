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
  const studioOnlyLines = (scene.dialogueLines || []).filter((l) => l.studioOnly);
  const parsed = parseFilmDialogueText(scene.dialogue || "");
  if (!parsed.length) {
    const fallback = scene.dialogue?.trim() || "";
    if (!fallback) return studioOnlyLines;
    const character =
      scene.speakerName?.trim() || scene.characterNames?.[0]?.trim() || "";
    return [
      ...mergeFilmDialogueLines(
        [{ character, line: fallback }],
        (scene.dialogueLines || []).filter((l) => !l.studioOnly)
      ),
      ...studioOnlyLines,
    ];
  }
  return [
    ...mergeFilmDialogueLines(
      parsed,
      (scene.dialogueLines || []).filter((l) => !l.studioOnly)
    ),
    ...studioOnlyLines,
  ];
}

/** Scene sau khi sync dialogueLines (ghi IDB) */
export function withSyncedDialogueLines(scene: FilmSceneRecord): FilmSceneRecord {
  const dialogueLines = syncSceneDialogueLines(scene);
  const storyboardLines = dialogueLines.filter((l) => !l.studioOnly);
  return {
    ...scene,
    dialogueLines,
    dialogue: formatFilmDialogueText(storyboardLines),
    speakerName:
      storyboardLines[0]?.character ||
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
  return line.voiceStatus === "ready" || !!line.voiceUrl || !!line.voiceBlob;
}

export function dialogueLineCreating(line: FilmDialogueLineRecord): boolean {
  return line.voiceStatus === "creating";
}

/** Dừng tạo giọng: giữ audio cũ nếu có, không ghi lỗi. */
export function stopSceneDialogueVoice(
  scene: FilmSceneRecord,
  lineId: string
): FilmSceneRecord {
  const line = scene.dialogueLines?.find((l) => l.id === lineId);
  const hasAudio = !!(line?.voiceBlob || line?.voiceUrl);
  return patchSceneDialogueLine(scene, lineId, {
    voiceStatus: hasAudio ? "ready" : "pending",
    voiceError: undefined,
  });
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

/** Tất cả nhân vật dự án (+ tên chỉ có trong thoại) — tab Tạo giọng. */
export function buildFilmVoiceCharacterRoster(
  characters: FilmCharacterRecord[],
  items: FilmVoiceListItem[] = []
): FilmVoiceSpeakerItem[] {
  const lineCounts = new Map<string, number>();
  for (const item of items) {
    const name = item.line.character?.trim();
    if (!name) continue;
    const k = name.toLowerCase();
    lineCounts.set(k, (lineCounts.get(k) || 0) + 1);
  }

  const roster: FilmVoiceSpeakerItem[] = [...characters]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "vi"))
    .map((c) => ({
      key: c.id,
      name: c.name,
      lineCount: lineCounts.get(c.name.trim().toLowerCase()) || 0,
      character: c,
    }));

  const seen = new Set(roster.map((r) => r.name.trim().toLowerCase()));
  for (const sp of buildFilmVoiceSpeakerRoster(items, characters)) {
    const k = sp.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    roster.push(sp);
  }
  return roster;
}

/** Flatten scenes → list card Tạo giọng (sort tập → cảnh) */
export function buildFilmVoiceListItems(
  scenes: FilmSceneRecord[],
  episodeOrder?: Map<string, number>
): FilmVoiceListItem[] {
  const sorted = [...scenes].sort((a, b) => {
    const epA = episodeOrder?.get(a.episodeId) ?? 0;
    const epB = episodeOrder?.get(b.episodeId) ?? 0;
    if (epA !== epB) return epA - epB;
    return a.index - b.index;
  });
  const items: FilmVoiceListItem[] = [];
  for (const scene of sorted) {
    const lines = syncSceneDialogueLines(scene).filter((l) => !l.studioOnly);
    const syncedScene: FilmSceneRecord = { ...scene, dialogueLines: lines };
    lines.forEach((line, i) => {
      items.push({
        key: `${scene.id}:${line.id}`,
        scene: syncedScene,
        line,
        lineIndex: i + 1,
      });
    });
  }
  return items;
}

/**
 * Gắn 1 dòng thoại vào scene theo id (hoặc character+text), giữ nguyên các dòng khác.
 * `occupiedIds` tránh đè dòng trùng nội dung đã dành cho câu khác trong cùng hàng đợi.
 */
export function withDialogueLineOnScene(
  scene: FilmSceneRecord,
  line: FilmDialogueLineRecord,
  occupiedIds?: Set<string>
): FilmSceneRecord {
  const lines = (
    scene.dialogueLines?.length ? scene.dialogueLines : syncSceneDialogueLines(scene)
  ).map((l) => ({ ...l }));
  const byId = lines.findIndex((l) => l.id === line.id);
  if (byId >= 0) {
    lines[byId] = { ...lines[byId], ...line };
    return { ...scene, dialogueLines: lines };
  }
  const byText = lines.findIndex((l) => {
    if (l.character.trim().toLowerCase() !== line.character.trim().toLowerCase()) return false;
    if (l.line.trim() !== line.line.trim()) return false;
    if (occupiedIds?.has(l.id) && l.id !== line.id) return false;
    return true;
  });
  if (byText >= 0) {
    lines[byText] = { ...lines[byText], ...line };
    return { ...scene, dialogueLines: lines };
  }
  return { ...scene, dialogueLines: [...lines, line] };
}

/** Cập nhật 1 dialogue line trong scene */
export function patchSceneDialogueLine(
  scene: FilmSceneRecord,
  lineId: string,
  patch: Partial<FilmDialogueLineRecord>,
  match?: Pick<FilmDialogueLineRecord, "character" | "line">
): FilmSceneRecord {
  const lines = syncSceneDialogueLines(scene);
  let found = false;
  let dialogueLines = lines.map((l) => {
    if (l.id !== lineId) return l;
    found = true;
    return { ...l, ...patch };
  });
  if (!found && match) {
    const ch = match.character?.trim().toLowerCase() || "";
    const text = match.line?.trim() || "";
    dialogueLines = lines.map((l) => {
      if (found) return l;
      if (
        ch &&
        l.character.trim().toLowerCase() === ch &&
        l.line.trim() === text
      ) {
        found = true;
        return { ...l, id: lineId, ...patch };
      }
      return l;
    });
  }
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

/** Chỉ gắn voiceId / voiceLabel từ nhân vật — không copy blob / audio data. */
export function applyCharacterVoiceLinksToScenes(
  scenes: FilmSceneRecord[],
  characters: FilmCharacterRecord[]
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const byName = new Map(
    characters
      .map((c) => [c.name.trim().toLowerCase(), c] as const)
      .filter(([k]) => !!k)
  );
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((scene) => {
    const lines = scene.dialogueLines;
    if (!lines?.length) return scene;
    let dirty = false;
    const dialogueLines = lines.map((line) => {
      const ch = byName.get(line.character?.trim().toLowerCase() || "");
      const voiceId = ch?.voiceId?.trim() || "";
      const voiceLabel = ch?.voiceLabel?.trim() || "";
      if (!voiceId && !voiceLabel) return line;
      if (line.voiceId === voiceId && (line.voiceLabel || "") === voiceLabel) return line;
      dirty = true;
      return {
        ...line,
        voiceId: voiceId || line.voiceId,
        voiceLabel: voiceLabel || line.voiceLabel,
      };
    });
    if (!dirty) return scene;
    const patched: FilmSceneRecord = {
      ...scene,
      dialogueLines,
      updatedAt: new Date().toISOString(),
    };
    changed.push(patched);
    return patched;
  });
  return { scenes: next, changed };
}

/** Gỡ voiceId/voiceLabel trên dòng thoại của nhân vật (không xóa file audio đã tạo). */
export function stripCharacterVoiceLinksFromScenes(
  scenes: FilmSceneRecord[],
  characterName: string
): { scenes: FilmSceneRecord[]; changed: FilmSceneRecord[] } {
  const name = characterName.trim().toLowerCase();
  if (!name) return { scenes, changed: [] };
  const changed: FilmSceneRecord[] = [];
  const next = scenes.map((scene) => {
    if (!scene.dialogueLines?.length) return scene;
    let dirty = false;
    const dialogueLines = scene.dialogueLines.map((line) => {
      if (line.character?.trim().toLowerCase() !== name) return line;
      if (!line.voiceId?.trim() && !line.voiceLabel?.trim()) return line;
      dirty = true;
      return { ...line, voiceId: undefined, voiceLabel: undefined };
    });
    if (!dirty) return scene;
    const patched: FilmSceneRecord = {
      ...scene,
      dialogueLines,
      updatedAt: new Date().toISOString(),
    };
    changed.push(patched);
    return patched;
  });
  return { scenes: next, changed };
}

/** Giọng gắn nhân vật (link) — ưu tiên hơn voice trên dòng thoại. */
export function resolveDialogueLineVoiceLink(
  line: Pick<FilmDialogueLineRecord, "character" | "voiceId" | "voiceLabel">,
  characters: FilmCharacterRecord[] = []
): { voiceId: string; voiceLabel: string } {
  const name = line.character?.trim().toLowerCase() || "";
  const ch = name
    ? characters.find((c) => c.name.trim().toLowerCase() === name)
    : undefined;
  const voiceId = (ch?.voiceId || line.voiceId || "").trim();
  const voiceLabel = (ch?.voiceLabel || line.voiceLabel || "").trim();
  return { voiceId, voiceLabel };
}

/**
 * Giọng dùng khi gen video Flow2 (mode Thành phần).
 * Ưu tiên dòng thoại đầu có voiceId; fallback scene.voiceId.
 */
export function resolveFilmSceneVideoVoice(
  scene: Pick<FilmSceneRecord, "voiceId" | "dialogueLines">,
  characters: FilmCharacterRecord[] = []
): string | undefined {
  for (const line of scene.dialogueLines || []) {
    const { voiceId } = resolveDialogueLineVoiceLink(line, characters);
    if (voiceId) return voiceId;
  }
  const sceneVoice = String(scene.voiceId || "").trim();
  return sceneVoice || undefined;
}
