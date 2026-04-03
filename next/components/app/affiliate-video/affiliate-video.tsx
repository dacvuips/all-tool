/**
 * AI Affiliate Video Workshop – affiliate-video.tsx
 * Styling: className only (Tailwind) — no inline styles, no style= props.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { credentialCustomerService } from "../../../lib/repo";
import { AiProviderKeyEnum } from "../../../lib/repo/product/productApp.repo";
import { Button, Textarea } from "../../shared/utilities/form";
import { buildPrompt, DEFAULT_VOICE_CONFIG, PROMPT_TEMPLATES, VoiceConfig } from "./constants";
import { useAffiliateVideoContext } from "./providers/affiliate-video-provider";
import { AffiliateVideoSibar } from "./sibar/affiliate-video-sibar";
import { SettingsModal, ZoomModal } from "./sibar/text-to-video-tab/text-to-video-modal";

export default function AffiliateVideo() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const [showSettings, setShowSettings] = useState(false);

  /* ─── Credential state ─── */
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);

  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(DEFAULT_VOICE_CONFIG);
  const [templateId, setTemplateId] = useState("affiliate_review");
  const [rawPrompt, setRawPrompt] = useState(PROMPT_TEMPLATES[0].template);
  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  const { showAiModal, setShowAiModal, zoomSrc, setZoomSrc, videoConfig, patchConfig } =
    useAffiliateVideoContext();

  const checkCredential = useCallback(async () => {
    setCredentialLoading(true);
    try {
      const cred = await credentialCustomerService.getCredentialByKey(
        AiProviderKeyEnum.GOOGLE_GEMINI_KEY
      );
      if (cred) {
        setCredentialId(cred.id || null);
        setCredentialActive(!!cred.active);
      } else {
        setCredentialId(null);
        setCredentialActive(false);
      }
    } catch {
      setCredentialId(null);
      setCredentialActive(false);
    } finally {
      setCredentialLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  const hasKey = !!credentialId;
  const keyReady = hasKey && credentialActive;

  const processPrompt = useCallback(async () => {
    if (!hasKey) {
      setShowSettings(true);
      return;
    }
    if (!rawPrompt.trim()) {
      setStep1Error("Vui lòng nhập mô tả.");
      return;
    }
    setStep1Error(null);
    setStep1Loading(true);

    try {
      const tpl = PROMPT_TEMPLATES.find((t) => t.id === templateId);
      const finalPrompt = tpl
        ? buildPrompt(tpl.prompt, {
            videoCount: videoConfig.numberOfOutputs,
            videoDuration: videoConfig.duration,
            template: tpl.template,
            aspectRatio: videoConfig.aspectRatio,
            builtInVoice: voiceConfig.voiceName,
            userInput: rawPrompt,
          })
        : rawPrompt;
      const r = await fetch("/api/affiliate-video-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawPrompt: finalPrompt,
          templateId,
          numberOfOutputs: videoConfig.numberOfOutputs,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.success) throw new Error(data.error || "Lỗi xử lý prompt");
    } catch (e: any) {
      setStep1Error(e.message);
    } finally {
      setStep1Loading(false);
    }
  }, [hasKey, rawPrompt, templateId, videoConfig]);

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-gray-900"
      style={{ background: "#080815" }}
    >
      {/* Modals */}
      {zoomSrc && (
        <ZoomModal src={zoomSrc.src} mediaType={zoomSrc.type} onClose={() => setZoomSrc(null)} />
      )}
      {showSettings && (
        <SettingsModal
          credentialId={credentialId}
          credentialActive={credentialActive}
          onClose={() => setShowSettings(false)}
          onCredentialChange={checkCredential}
        />
      )}

      {/* ── AI Modal ── */}
      {showAiModal && (
        <div
          className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowAiModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-indigo-500 border-opacity-30 bg-gray-900 shadow-2xl overflow-hidden"
            style={{ background: "#0e0c1e" }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white border-opacity-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-14">
                  🤖
                </div>
                <span className="text-14 font-bold text-white">AI Tạo Prompt</span>
              </div>
              <Button
                onClick={() => setShowAiModal(false)}
                className="w-7 h-7 rounded-lg bg-white bg-opacity-10 text-blue-300 hover:bg-opacity-20 flex items-center justify-center text-14 border-0 cursor-pointer transition-all"
              >
                ✕
              </Button>
            </div>

            <div className="p-5 space-y-4">
              {/* Template picker */}
              <div>
                <div className="text-10 font-semibold tracking-widest text-blue-400 uppercase mb-2">
                  {t("Chọn Template")}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {PROMPT_TEMPLATES.map((t) => (
                    <Button
                      key={t.id}
                      onClick={() => {
                        setTemplateId(t.id);
                        setRawPrompt(t.template);
                      }}
                      className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-11 font-medium border-0 cursor-pointer transition-all ${
                        templateId === t.id
                          ? "bg-indigo-600 text-white"
                          : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
                      }`}
                    >
                      <span className="text-16">{t.icon}</span>
                      <span>{t.label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <div>
                <div className="text-10 font-semibold tracking-widest text-blue-400 uppercase mb-2">
                  {t("Mô tả ý tưởng")}
                </div>
                <Textarea
                  value={rawPrompt}
                  onChange={(e) => setRawPrompt(e.target.value)}
                  rows={5}
                  placeholder={t("Nhập mô tả ý tưởng video...")}
                  className="w-full rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-13 px-3 py-2 outline-none resize-none placeholder-blue-500 focus:border-indigo-500 transition-colors"
                />
              </div>

              {step1Error && (
                <div className="flex items-center gap-2 text-red-400 text-12 bg-red-900 bg-opacity-20 rounded-lg px-3 py-2">
                  ❌ {step1Error}
                </div>
              )}

              <Button
                onClick={async () => {
                  await processPrompt();
                  if (!step1Error) setShowAiModal(false);
                }}
                disabled={step1Loading}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-14 border-0 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {step1Loading ? (
                  <>
                    <span className="animate-spin">⚙️</span> {t("AI đang xử lý...")}
                  </>
                ) : (
                  `🤖 ${t("Tạo")} ${videoConfig.numberOfOutputs} ${t("Prompt với AI")}`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TOP NAV ══ */}
      <div
        className="flex items-center h-10 px-4 border-b border-white border-opacity-10 flex-shrink-0"
        style={{ background: "#09091a" }}
      >
        <div className="flex items-center gap-2 mr-4">
          <div className="text-16">🎬</div>
          <span className="text-13 font-bold text-white">{t("Affiliate Video")}</span>
          <span className="text-9 font-bold px-2 py-0 rounded bg-indigo-600 text-white tracking-wider">
            PRO
          </span>
          <span className="text-9 text-blue-400 ml-1">v1.0</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => (!customer ? setOpenCustomerLoginDialog(true) : setShowSettings(true))}
          className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
            credentialLoading
              ? "bg-indigo-900 bg-opacity-30 text-indigo-400"
              : keyReady
              ? "bg-green-900 bg-opacity-40 text-green-400 hover:bg-opacity-60"
              : hasKey
              ? "bg-yellow-900 bg-opacity-40 text-yellow-400 hover:bg-opacity-60"
              : "bg-yellow-900 bg-opacity-40 text-yellow-400 hover:bg-opacity-60"
          }`}
        >
          {credentialLoading
            ? "⏳ ..."
            : keyReady
            ? `🔑 ${t("Key OK")}`
            : hasKey
            ? `⚠️ Key inactive`
            : `⚠️ ${t("Cài API Key")}`}
        </button>
      </div>

      <AffiliateVideoSibar />
    </div>
  );
}
