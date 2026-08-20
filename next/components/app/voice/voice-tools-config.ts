import type { IconType } from "react-icons";
import {
  RiChatVoiceLine,
  RiFileTextLine,
  RiFolderMusicLine,
  RiMicLine,
  RiMusic2Line,
  RiScissorsCutLine,
  RiUserVoiceLine,
  RiVoiceprintLine,
} from "react-icons/ri";
import type { VoiceToolId } from "./voice-types";

/** Query param for Voice sub-tab (tts, conversion, clone, stt, cleanup, cut, voices, mine) */
export const VOICE_TAB_QUERY_KEY = "voiceTab";

export const VOICE_TOOLS: {
  id: VoiceToolId;
  Icon: IconType;
  labelKey: string;
  descKey: string;
  resultTitleKey: string;
  resultDescKey: string;
  color: string;
}[] = [
  {
    id: "tts",
    Icon: RiChatVoiceLine,
    labelKey: "Tạo giọng nói",
    descKey: "Tạo audio từ văn bản",
    resultTitleKey: "Giọng đã tạo",
    resultDescKey: "Chỉ các giọng tạo ở tab Tạo giọng nói",
    color: "#f97316",
  },
  {
    id: "conversion",
    Icon: RiVoiceprintLine,
    labelKey: "Chuyển giọng",
    descKey: "Đổi giọng file thu",
    resultTitleKey: "Giọng đã chuyển",
    resultDescKey: "Chỉ các file chuyển giọng ở tab này",
    color: "#8b5cf6",
  },
  {
    id: "clone",
    Icon: RiMicLine,
    labelKey: "Nhân bản giọng",
    descKey: "Nhân bản giọng 3–30 giây",
    resultTitleKey: "Giọng đã nhân bản",
    resultDescKey: "Mã clone và audio mẫu lưu trên máy",
    color: "#ec4899",
  },
  {
    id: "stt",
    Icon: RiFileTextLine,
    labelKey: "Chép lời",
    descKey: "Chép lời JSON / SRT",
    resultTitleKey: "Lời đã chép",
    resultDescKey: "Audio và lời thoại lưu trên máy",
    color: "#10b981",
  },
  {
    id: "cleanup",
    Icon: RiMusic2Line,
    labelKey: "Lọc tạp âm",
    descKey: "Gỡ tạp âm nền",
    resultTitleKey: "Audio đã lọc",
    resultDescKey: "File đã gỡ tạp âm, lưu trên máy",
    color: "#06b6d4",
  },
  {
    id: "cut",
    Icon: RiScissorsCutLine,
    labelKey: "Cắt video/audio",
    descKey: "Cắt, ghép, tốc độ, crop trên máy",
    resultTitleKey: "File đã xử lý",
    resultDescKey: "Cắt, tách, phụ đề và audio lưu trên máy",
    color: "#e11d48",
  },
  {
    id: "voices",
    Icon: RiUserVoiceLine,
    labelKey: "Danh sách giọng",
    descKey: "Danh sách giọng & bộ lọc",
    resultTitleKey: "Danh sách giọng",
    resultDescKey: "Lọc và chọn voice_id",
    color: "#0ea5e9",
  },
  {
    id: "mine",
    Icon: RiFolderMusicLine,
    labelKey: "Giọng của tôi",
    descKey: "Giọng do bạn tạo, lưu trên máy",
    resultTitleKey: "Giọng của tôi",
    resultDescKey: "Tất cả giọng đã tạo từ mọi tab, lưu trên máy",
    color: "#4f46e5",
  },
];

export function getVoiceTool(id?: string | null) {
  return VOICE_TOOLS.find((item) => item.id === id) || VOICE_TOOLS[0];
}

export function parseVoiceToolId(value: unknown): VoiceToolId | null {
  const id = Array.isArray(value) ? value[0] : value;
  if (typeof id !== "string" || !id.trim()) return null;
  return VOICE_TOOLS.some((item) => item.id === id) ? (id as VoiceToolId) : null;
}

export function voiceTabFromLocation(): VoiceToolId | null {
  if (typeof window === "undefined") return null;
  return parseVoiceToolId(new URLSearchParams(window.location.search).get(VOICE_TAB_QUERY_KEY));
}
