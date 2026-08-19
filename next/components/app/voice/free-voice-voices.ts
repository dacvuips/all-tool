export type FreeGenAudioVoice = {
  id: string;
  name: string;
  description: string;
};

/** Danh sách voice Gemini TTS miễn phí (Flow2 gen_audio). */
export const FREE_GEN_AUDIO_VOICES: FreeGenAudioVoice[] = [
  { id: "achernar", name: "Achernar", description: "Female, soft, high pitch" },
  { id: "achird", name: "Achird", description: "Male, friendly, mid pitch" },
  { id: "algenib", name: "Algenib", description: "Male, gravelly, low pitch" },
  { id: "algieba", name: "Algieba", description: "Male, easy-going, mid-low pitch" },
  { id: "alnilam", name: "Alnilam", description: "Male, firm, mid-low pitch" },
  { id: "aoede", name: "Aoede", description: "Female, breezy, mid pitch" },
  { id: "autonoe", name: "Autonoe", description: "Female, bright, mid pitch" },
  { id: "callirrhoe", name: "Callirrhoe", description: "Female, easy-going, mid pitch" },
  { id: "charon", name: "Charon", description: "Male, informative, lower pitch" },
  { id: "despina", name: "Despina", description: "Female, smooth, mid pitch" },
  { id: "enceladus", name: "Enceladus", description: "Male, breathy, lower pitch" },
  { id: "erinome", name: "Erinome", description: "Female, clear, mid pitch" },
  { id: "fenrir", name: "Fenrir", description: "Male, excitable, younger pitch" },
  { id: "gacrux", name: "Gacrux", description: "Female, mature, mid pitch" },
  { id: "iapetus", name: "Iapetus", description: "Male, clear, mid-low pitch" },
  { id: "kore", name: "Kore", description: "Female, firm, mid pitch" },
  { id: "laomedeia", name: "Laomedeia", description: "Female, upbeat, mid-high pitch" },
  { id: "leda", name: "Leda", description: "Female, youthful, mid-high pitch" },
  { id: "orus", name: "Orus", description: "Male, firm, mid-low pitch" },
  { id: "puck", name: "Puck", description: "Male, upbeat, mid pitch" },
  { id: "pulcherrima", name: "Pulcherrima", description: "Ungendered, forward, mid-high pitch" },
  { id: "rasalgethi", name: "Rasalgethi", description: "Male, informative, mid pitch" },
  { id: "sadachbia", name: "Sadachbia", description: "Male, lively, low pitch" },
  { id: "sadaltager", name: "Sadaltager", description: "Male, knowledgeable, mid pitch" },
  { id: "schedar", name: "Schedar", description: "Male, even, mid-low pitch" },
  { id: "sulafat", name: "Sulafat", description: "Female, warm, mid pitch" },
  { id: "umbriel", name: "Umbriel", description: "Male, smooth, lower pitch" },
  { id: "vindemiatrix", name: "Vindemiatrix", description: "Female, gentle, mid pitch" },
  { id: "zephyr", name: "Zephyr", description: "Female, bright, mid-high pitch" },
  { id: "zubenelgenubi", name: "Zubenelgenubi", description: "Male, casual, mid-low pitch" },
];

export function freeGenAudioVoiceLabel(voiceId: string): string {
  const id = String(voiceId || "").trim().toLowerCase();
  const found = FREE_GEN_AUDIO_VOICES.find((item) => item.id === id);
  if (!found) return id;
  return `${found.name} — ${found.description}`;
}

export function isFreeGenAudioVoiceId(voiceId: string): boolean {
  const id = String(voiceId || "").trim().toLowerCase();
  if (!id) return false;
  return FREE_GEN_AUDIO_VOICES.some((item) => item.id === id);
}
