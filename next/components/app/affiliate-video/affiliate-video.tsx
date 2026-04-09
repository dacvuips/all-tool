/**
 * affiliate-video.tsx
 * Main page – light cream theme matching "3 BIG Studio" design
 * className only – Tailwind CSS, no inline styles
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiKey2Line, RiSettings3Line } from "react-icons/ri";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { credentialCustomerService } from "../../../lib/repo";
import { AiProviderKeyEnum } from "../../../lib/repo/product/productApp.repo";

import { useAffiliateVideoContext } from "./providers/affiliate-video-provider";

import { AffiliateVideoBody } from "./affiliate-video-body";
import { SettingsModal, ZoomModal } from "./sibar/text-to-video-modal";

export default function AffiliateVideo() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const [showSettings, setShowSettings] = useState(false);

  /* ─── Credential state ─── */
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);

  const [templateId, setTemplateId] = useState("affiliate_review");

  const [step1Loading, setStep1Loading] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  const { showAiModal, setShowAiModal, zoomSrc, setZoomSrc, videoConfig } =
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

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-amber-50"
      style={{ height: "calc(100vh - 10px)" }}
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

      {/* ══ TOP NAV ══ */}
      <div className="flex items-center h-10 px-4 border-b border-gray-200 flex-shrink-0 bg-white shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-2 mr-6">
          <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center"></div>
          <span className="text-sm font-bold text-gray-800">Free Video AI</span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-0 border-l border-gray-200 pl-4">
          {[
            { icon: "📄", label: t("Đơn Lẻ") },
            { icon: "📊", label: t("Hàng Loạt") },
            { icon: "📖", label: t("Cốt Truyện") },
            { icon: "🔁", label: t("Sao Chép") },
            { icon: "🖨", label: t("Nhân Bản") },
            { icon: "👗", label: t("Thời Trang") },
            { icon: "⚙️", label: t("Chế độ Nâng cao") },
          ].map((item, i) => (
            <button
              key={i}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer border-0 bg-transparent ${
                i === 0
                  ? "text-blue-600 border-b-2 border-blue-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Thư Viện */}
          <button className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer border-0 bg-transparent">
            📚 {t("Thư Viện")}
          </button>

          {/* API Key status */}
          <button
            id="api-key-btn"
            onClick={() => (!customer ? setOpenCustomerLoginDialog(true) : setShowSettings(true))}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              credentialLoading
                ? "bg-gray-50 text-gray-400 border-gray-200"
                : keyReady
                ? "bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                : "bg-yellow-50 text-yellow-600 border-yellow-200 hover:bg-yellow-100"
            }`}
          >
            <RiKey2Line className="text-xs" />
            {credentialLoading ? "..." : keyReady ? t("Key OK") : t("Cài API Key")}
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer border-0 bg-transparent"
          >
            <RiSettings3Line className="text-sm" />
          </button>
        </div>
      </div>

      {/* ══ MAIN LAYOUT ══ */}
      <AffiliateVideoBody />
    </div>
  );
}
