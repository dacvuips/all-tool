/**
 * shared/voice-export-dialog.tsx
 * Dialog xuất Voice: Dialogue, Audio và TTS AI – dùng chung cho các batch action bar
 */
import { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { MdRecordVoiceOver } from "react-icons/md";
import {
  RiCheckLine,
  RiClipboardLine,
  RiCloseLine,
  RiDownloadLine,
  RiLoader4Line,
  RiMagicLine,
  RiVolumeUpLine,
} from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button, Input, Select } from "../../../shared/utilities/form";

export interface VoiceExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dialogueCopied: boolean;
  dialogueExportText: string;
  audioExportText: string;
  handleCopyDialogue: () => void;
  ttsGenerating: boolean;
  ttsAudioUrl: string | null;
  ttsVoiceName: string;
  setTtsVoiceName: (val: string) => void;
  ttsAudioRef: RefObject<HTMLAudioElement | null>;
  handleGenerateTTS: () => void;
  handleDownloadTTSAudio: () => void;
}

export function VoiceExportDialog({
  isOpen,
  onClose,
  dialogueCopied,
  dialogueExportText,
  audioExportText,
  handleCopyDialogue,
  ttsGenerating,
  ttsAudioUrl,
  ttsVoiceName,
  setTtsVoiceName,
  ttsAudioRef,
  handleGenerateTTS,
  handleDownloadTTSAudio,
}: VoiceExportDialogProps) {
  const { t } = useTranslation();
  const { BUILTIN_VOICES } = useOptionsTranslation();

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      width={600}
      slideFromBottom="none"
      hasCloseIcon={false}
      dialogClass="relative bg-white shadow-2xl rounded-2xl overflow-hidden"
      headerClass=""
      bodyClass=""
      footerClass=""
    >
      <Dialog.Header>
        <div className="px-5 pt-4">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex gap-2 items-center text-base font-bold">
                <MdRecordVoiceOver className="text-blue-500" />
                {t("Xuất Voice")}
              </div>
              <div className="text-gray-500 text-xs mt-0.5">
                {t("Tổng hợp Dialogue & Audio từ tất cả Scene")}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex justify-center items-center w-7 h-7 text-gray-500 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer hover:bg-gray-200"
            >
              <RiCloseLine className="text-sm" />
            </button>
          </div>
        </div>
      </Dialog.Header>

      <Dialog.Body>
        <div className="px-5 py-3 space-y-4 max-h-[70vh] overflow-y-auto v-scrollbar">
          <Input
            prefix={t("Giọng đọc")}
            value={audioExportText}
            prefixClassName="border-r border-gray-200 bg-gray-50"
            placeholder={t("Không có Audio")}
          />

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700">Dialogue</span>
              <Button
                onClick={handleCopyDialogue}
                disabled={!dialogueExportText}
                className="!h-7 !px-2.5 text-xs"
                icon={dialogueCopied ? <RiCheckLine /> : <RiClipboardLine />}
                outline
              >
                {dialogueCopied ? t("Đã chép") : t("Copy")}
              </Button>
            </div>
            {dialogueExportText ? (
              <pre className="w-full max-h-48 overflow-y-auto v-scrollbar rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-700 px-4 py-3 whitespace-pre-wrap leading-relaxed">
                {dialogueExportText}
              </pre>
            ) : (
              <div className="py-4 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
                {t("Không có Dialogue")}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex gap-2 items-center mb-3">
              <RiVolumeUpLine className="text-purple-500" />
              <span className="text-sm font-semibold text-gray-700">{t("Tạo Giọng AI")}</span>
            </div>

            <div className="flex gap-2 items-center mb-3">
              <div className="flex-1">
                <Select
                  menuPosition="fixed"
                  value={ttsVoiceName}
                  onChange={(val: string) => setTtsVoiceName(val)}
                  options={BUILTIN_VOICES.map((v) => ({
                    value: v.value,
                    label: v.label,
                  }))}
                  className="text-xs"
                />
              </div>
              <Button
                onClick={handleGenerateTTS}
                disabled={ttsGenerating || !dialogueExportText}
                className="!h-9 !px-4 text-xs whitespace-nowrap"
                icon={ttsGenerating ? <RiLoader4Line className="animate-spin" /> : <RiMagicLine />}
                primary
              >
                {ttsGenerating ? t("Đang tạo...") : t("Generate AI")}
              </Button>
            </div>

            {ttsAudioUrl && (
              <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200">
                <audio
                  ref={ttsAudioRef}
                  controls
                  src={ttsAudioUrl}
                  className="w-full h-8"
                  style={{ borderRadius: "8px" }}
                />
                <div className="flex gap-2 justify-end items-center mt-2">
                  <Button
                    onClick={handleDownloadTTSAudio}
                    className="!h-7 !px-2.5 text-xs"
                    icon={<RiDownloadLine />}
                    outline
                  >
                    {t("Tải Audio")}
                  </Button>
                </div>
              </div>
            )}

            {!ttsAudioUrl && !ttsGenerating && (
              <div className="py-3 text-xs text-center text-gray-400 rounded-xl border border-gray-200 border-dashed">
                {t("Chọn giọng đọc và nhấn Generate AI để tạo audio từ Dialogue")}
              </div>
            )}

            {ttsGenerating && (
              <div className="flex gap-2 justify-center items-center py-4">
                <RiLoader4Line className="text-lg text-purple-500 animate-spin" />
                <span className="text-xs text-gray-500">
                  {t("Đang tạo giọng nói bằng AI... Vui lòng chờ")}
                </span>
              </div>
            )}
          </div>
        </div>
      </Dialog.Body>

      <Dialog.Footer>
        <div className="flex gap-2 justify-end items-center px-5 py-4 bg-white rounded-b-2xl border-t border-gray-100">
          <Button onClick={onClose} outline>
            {t("Đóng")}
          </Button>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
}
