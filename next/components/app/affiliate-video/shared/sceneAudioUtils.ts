/** AI đôi khi trả audio dạng object { gender, personality, pace, sfx } thay vì string. */
export function normalizeSceneAudioField(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const orderedKeys = [
      "gender",
      "personality",
      "tone",
      "mood",
      "style",
      "pace",
      "pacing",
      "sfx",
      "sound",
    ];
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const key of orderedKeys) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        parts.push(v.trim());
        seen.add(key);
      }
    }
    for (const [key, v] of Object.entries(obj)) {
      if (!seen.has(key) && typeof v === "string" && v.trim()) {
        parts.push(v.trim());
      }
    }
    return parts.join(", ");
  }
  return String(value);
}
