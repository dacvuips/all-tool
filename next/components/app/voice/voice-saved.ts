import { useCallback, useEffect, useState } from "react";
import type { MicroxVoice } from "./voice-types";
import { voiceIdOf } from "./voice-types";

const STORAGE_KEY = "microx-saved-voices";

type SavedEntry = { id: string; voice: MicroxVoice };

function readSaved(): SavedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.id === "string" && item.voice);
  } catch {
    return [];
  }
}

function writeSaved(items: SavedEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useSavedVoices() {
  const [saved, setSaved] = useState<SavedEntry[]>([]);

  useEffect(() => {
    setSaved(readSaved());
  }, []);

  const savedIds = saved.map((item) => item.id);
  const savedSet = new Set(savedIds);

  const isSaved = useCallback((id: string) => savedSet.has(id), [savedSet]);

  const toggleSave = useCallback((voice: MicroxVoice) => {
    const id = voiceIdOf(voice);
    if (!id) return;
    setSaved((prev) => {
      const exists = prev.some((item) => item.id === id);
      const next = exists
        ? prev.filter((item) => item.id !== id)
        : [{ id, voice }, ...prev];
      writeSaved(next);
      return next;
    });
  }, []);

  return { saved, savedIds, isSaved, toggleSave };
}

export function hoistSavedVoices(voices: MicroxVoice[], saved: SavedEntry[]): MicroxVoice[] {
  const byId = new Map<string, MicroxVoice>();
  for (const voice of voices) {
    const id = voiceIdOf(voice);
    if (id) byId.set(id, voice);
  }
  const head: MicroxVoice[] = [];
  const seen = new Set<string>();
  for (const item of saved) {
    const voice = byId.get(item.id) || item.voice;
    if (!voice) continue;
    head.push(voice);
    seen.add(item.id);
  }
  const rest = voices.filter((voice) => {
    const id = voiceIdOf(voice);
    return !id || !seen.has(id);
  });
  return [...head, ...rest];
}
