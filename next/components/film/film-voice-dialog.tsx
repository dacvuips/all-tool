import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineX } from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import type { FilmVoiceListItem } from "./film-dialogue";
import type { FilmSceneRecord } from "./film-types";

export type FilmVoiceSource = "catalog" | "custom_id" | "minimax";

export type FilmVoiceOption = {
  id: string;
  name: string;
  tags: string;
};

export type FilmVoiceGenerateInput = {
  scene: FilmSceneRecord;
  /** id dòng thoại đã tách; thiếu = legacy scene-level */
  dialogueLineId: string;
  source: FilmVoiceSource;
  voiceId: string;
  voiceLabel: string;
};

type Props = {
  isOpen: boolean;
  item: FilmVoiceListItem | null;
  onClose: () => void;
  onConfirm: (input: FilmVoiceGenerateInput) => Promise<void>;
};

const CATALOG_VOICES: FilmVoiceOption[] = [
  { id: "vi_male_warm", name: "Nam ấm áp", tags: "Warm, Clear" },
  { id: "vi_female_soft", name: "Nữ dịu dàng", tags: "Soft, Natural" },
  { id: "vi_narrator", name: "Người kể chuyện", tags: "Neutral, Measured" },
  { id: "vi_young_male", name: "Nam trẻ", tags: "Energetic, Bright" },
];

const MINIMAX_VOICES: FilmVoiceOption[] = [
  { id: "Friendly_Person", name: "Friendly Man", tags: "Persuasive, Dynamic" },
  { id: "Crisp_Woman", name: "Crisp Woman", tags: "Crisp, Fluid, Polished" },
  { id: "Professional_Narrator", name: "Professional Narrator", tags: "Warm, Neutral, Measured" },
  { id: "Deep_Narrator", name: "Deep Narrator", tags: "Deep, Authoritative" },
  { id: "Young_Hero", name: "Young Hero", tags: "Bold, Energetic" },
];

const SOURCES: { id: FilmVoiceSource; label: string }[] = [
  { id: "catalog", label: "Giọng Có Sẵn" },
  { id: "custom_id", label: "Nhập Voice ID Nhanh" },
  { id: "minimax", label: "Giọng Minimax" },
];

export default function FilmVoiceDialog({ isOpen, item, onClose, onConfirm }: Props) {
  const { t } = useTranslation();
  const [source, setSource] = useState<FilmVoiceSource>("minimax");
  const [selectedId, setSelectedId] = useState(MINIMAX_VOICES[0].id);
  const [customId, setCustomId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const scene = item?.scene || null;
  const line = item?.line || null;

  useEffect(() => {
    if (!isOpen || !line) return;
    const src = line.voiceSource || "minimax";
    setSource(src);
    if (src === "custom_id") {
      setCustomId(line.voiceId || "");
      setSelectedId("");
    } else if (src === "catalog") {
      setSelectedId(line.voiceId || CATALOG_VOICES[0].id);
    } else {
      setSelectedId(line.voiceId || MINIMAX_VOICES[0].id);
    }
    setSubmitting(false);
  }, [isOpen, line]);

  const options = source === "catalog" ? CATALOG_VOICES : MINIMAX_VOICES;
  const sectionTitle =
    source === "catalog"
      ? t("GIỌNG CÓ SẴN")
      : source === "minimax"
        ? t("MINIMAX VIETNAMESE VOICES")
        : t("VOICE ID");

  const speaker = line?.character?.trim() || t("Nhân vật");
  const lineText = line?.line?.trim() || "";
  const sceneNo = scene ? scene.index : 1;
  const lineNo = item?.lineIndex || 1;

  const resolveVoice = (): { id: string; label: string } | null => {
    if (source === "custom_id") {
      const id = customId.trim();
      if (!id) return null;
      return { id, label: id };
    }
    const found = options.find((o) => o.id === selectedId) || options[0];
    if (!found) return null;
    return { id: found.id, label: found.name };
  };

  const canSubmit = !!resolveVoice() && !submitting && !!scene && !!line;

  const handleConfirm = async () => {
    if (!scene || !line || submitting) return;
    const voice = resolveVoice();
    if (!voice) return;
    setSubmitting(true);
    try {
      await onConfirm({
        scene,
        dialogueLineId: line.id,
        source,
        voiceId: voice.id,
        voiceLabel: voice.label,
      });
      onClose();
    } catch (err) {
      console.error("[FilmVoiceDialog] confirm failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen && !!item}
      onClose={onClose}
      width={520}
      maxWidth="94vw"
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-xl"
      bodyClass="relative bg-white"
      hasCloseIcon={false}
    >
      <Dialog.Body>
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 m-0 leading-snug">
                {t("Chọn Giọng cho Lời Thoại")}
              </h2>
              <p className="text-xs text-gray-500 m-0 mt-1.5">
                {t("Phân cảnh")} #{sceneNo}
                {" · "}
                {t("Câu")} {lineNo}
                {" | "}
                {t("Nhân vật")}: {speaker}
              </p>
              {lineText ? (
                <p className="text-xs text-gray-700 m-0 mt-2 leading-relaxed line-clamp-3 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                  {lineText}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-0 bg-transparent cursor-pointer flex-shrink-0"
              aria-label={t("Đóng")}
            >
              <HiOutlineX className="text-xl" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {SOURCES.map((srcItem) => {
              const active = source === srcItem.id;
              return (
                <button
                  key={srcItem.id}
                  type="button"
                  onClick={() => {
                    setSource(srcItem.id);
                    if (srcItem.id === "catalog") {
                      setSelectedId(CATALOG_VOICES[0].id);
                    } else if (srcItem.id === "minimax") {
                      setSelectedId(MINIMAX_VOICES[0].id);
                    }
                  }}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                    active
                      ? "bg-blue-50 text-blue-700 border-blue-400"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      active ? "border-blue-500" : "border-gray-300"
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </span>
                  {t(srcItem.label)}
                </button>
              );
            })}
          </div>

          <div className="mb-1">
            <div className="text-10 font-bold tracking-wider text-gray-400 uppercase mb-2">
              {sectionTitle}
            </div>

            {source === "custom_id" ? (
              <div className="pb-1">
                <input
                  value={customId}
                  onChange={(e) => setCustomId(e.target.value)}
                  placeholder={t("Dán Voice ID...")}
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50"
                />
                <p className="text-xs text-gray-400 m-0 mt-2">
                  {t("Nhập ID giọng từ hệ thống TTS / Minimax để lồng tiếng nhanh.")}
                </p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                {options.map((voice) => {
                  const selected = selectedId === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedId(voice.id)}
                      className={`w-full text-left rounded-xl border px-3.5 py-3 cursor-pointer transition-colors ${
                        selected
                          ? "border-blue-400 bg-blue-50 ring-1 ring-blue-200"
                          : "border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50"
                      }`}
                    >
                      <div className="text-sm font-bold text-gray-900 m-0">{voice.name}</div>
                      <div className="text-xs text-gray-400 m-0 mt-0.5">{voice.tags}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button
            outline
            text={t("Hủy")}
            className="!rounded-xl !px-4 !border-0 !bg-transparent !text-gray-600 hover:!bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          />
          <Button
            primary
            text={t("Xác nhận tạo giọng")}
            className="!rounded-xl !px-4 !bg-blue-600 hover:!bg-blue-700"
            onClick={handleConfirm}
            isLoading={submitting}
            disabled={!canSubmit}
          />
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
