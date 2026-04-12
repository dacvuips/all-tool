/**
 * affiliate-video/components.tsx
 * className only — no inline styles, no style= props.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiCheckLine,
  RiCloseLine,
  RiEditLine,
  RiExternalLinkLine,
  RiEyeOffLine,
  RiKey2Line,
  RiSaveLine,
  RiShieldCheckLine,
  RiZoomInLine,
  RiZoomOutLine,
} from "react-icons/ri";
import { useToast } from "../../../../lib/providers/toast-provider";
import { credentialCustomerService } from "../../../../lib/repo";
import { AiProviderKeyEnum } from "../../../../lib/repo/product/productApp.repo";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import { MediaType } from "../constants";

/* ═══════════════════════════════════════════════════════════ ZoomModal */
interface ZoomModalProps {
  src: string;
  mediaType?: MediaType;
  onClose: () => void;
}

export function ZoomModal({ src, mediaType = "image", onClose }: ZoomModalProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(8, Math.max(0.3, s - e.deltaY * 0.002)));
  }, []);

  const zoomIn = () => setScale((s) => Math.min(8, s + 0.4));
  const zoomOut = () => setScale((s) => Math.max(0.3, s - 0.4));
  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomPercent = Math.round(scale * 100);

  return (
    <div
      className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-80 backdrop-filter backdrop-blur-sm cursor-zoom-out"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onMouseDown={(e) => {
        dragging.current = true;
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        setOffset((o) => ({
          x: o.x + e.clientX - lastPos.current.x,
          y: o.y + e.clientY - lastPos.current.y,
        }));
        lastPos.current = { x: e.clientX, y: e.clientY };
      }}
      onMouseUp={() => {
        dragging.current = false;
      }}
      onWheel={onWheel}
    >
      {mediaType === "video" ? (
        <video
          src={src}
          controls
          autoPlay
          className="rounded-2xl"
          style={{
            maxWidth: "88vw",
            maxHeight: "88vh",
            transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          }}
        />
      ) : (
        <img
          src={src}
          draggable={false}
          alt=""
          className="rounded-2xl select-none"
          style={{
            maxWidth: "88vw",
            maxHeight: "88vh",
            transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          }}
        />
      )}

      {/* ── Floating toolbar ── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-gray-900 bg-opacity-70 backdrop-filter backdrop-blur-md rounded-2xl px-2 py-1.5 border border-white border-opacity-10">
        <button
          onClick={zoomOut}
          title="Zoom out"
          className="w-9 h-9 rounded-xl text-white hover:bg-white hover:bg-opacity-15 cursor-pointer text-base transition-all flex items-center justify-center border-0 bg-transparent"
        >
          <RiZoomOutLine />
        </button>

        <span className="text-white text-opacity-60 text-xs font-medium min-w-10 text-center select-none tabular-nums">
          {zoomPercent}%
        </span>

        <button
          onClick={zoomIn}
          title="Zoom in"
          className="w-9 h-9 rounded-xl text-white hover:bg-white hover:bg-opacity-15 cursor-pointer text-base transition-all flex items-center justify-center border-0 bg-transparent"
        >
          <RiZoomInLine />
        </button>

        <div className="w-px h-5 bg-white bg-opacity-20 mx-1" />

        <button
          onClick={resetView}
          title="Reset"
          className="h-8 px-3 rounded-xl text-white text-xs hover:bg-white hover:bg-opacity-15 cursor-pointer transition-all flex items-center justify-center border-0 bg-transparent font-medium"
        >
          Reset
        </button>

        <div className="w-px h-5 bg-white bg-opacity-20 mx-1" />

        <button
          onClick={onClose}
          title="Close"
          className="w-9 h-9 rounded-xl text-white hover:bg-red-500 hover:bg-opacity-60 cursor-pointer text-lg transition-all flex items-center justify-center border-0 bg-transparent"
        >
          <RiCloseLine />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ SettingsModal */

interface CredentialTab {
  key: AiProviderKeyEnum;
  label: string;
  placeholder: string;
  helpUrl?: string;
  helpLabel?: string;
  inputType?: string;
  description?: string;
}

const CREDENTIAL_TABS: CredentialTab[] = [
  {
    key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
    label: "Gemini API Key",
    placeholder: "AIza...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpLabel: "aistudio.google.com",
    description: "Dùng cho tạo kịch bản và video (Gemini / Veo)",
  },
  {
    key: AiProviderKeyEnum.GOOGLE_LABS_TOKEN,
    label: "Google Labs Token",
    placeholder: "ya29...",
    helpUrl: "https://aisandbox.google.com",
    helpLabel: "aisandbox.google.com",
    description: "Access Token cho tạo ảnh (GEM PIX 2)",
  },
  {
    key: AiProviderKeyEnum.GOOGLE_LABS_PROJECT_ID,
    label: "Google Labs Project ID",
    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    inputType: "text",
    description: "Project ID từ Google Labs Sandbox",
  },
];

export function SettingsModal({
  credentialId,
  credentialActive,
  onClose,
  onCredentialChange,
}: {
  credentialId: string | null;
  credentialActive: boolean;
  onClose: () => void;
  onCredentialChange: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();

  // Per-tab state
  const [tabCreds, setTabCreds] = useState<
    Record<string, { id: string | null; active: boolean; loaded: boolean }>
  >({});
  const [editingTab, setEditingTab] = useState<string | null>(null);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeTabKey, setActiveTabKey] = useState(CREDENTIAL_TABS[0].key);

  // Seed Gemini tab from parent props
  useEffect(() => {
    setTabCreds((prev) => ({
      ...prev,
      [AiProviderKeyEnum.GOOGLE_GEMINI_KEY]: {
        id: credentialId,
        active: credentialActive,
        loaded: true,
      },
    }));
  }, [credentialId, credentialActive]);

  // Load Labs credentials on mount
  useEffect(() => {
    const loadLabsCreds = async () => {
      for (const tab of CREDENTIAL_TABS) {
        if (tab.key === AiProviderKeyEnum.GOOGLE_GEMINI_KEY) continue; // already seeded
        try {
          const cred = await credentialCustomerService.getCredentialByKey(tab.key);
          setTabCreds((prev) => ({
            ...prev,
            [tab.key]: {
              id: cred?.id || null,
              active: !!cred?.active,
              loaded: true,
            },
          }));
        } catch {
          setTabCreds((prev) => ({
            ...prev,
            [tab.key]: { id: null, active: false, loaded: true },
          }));
        }
      }
    };
    loadLabsCreds();
  }, []);

  const handleSave = async (tabKey: AiProviderKeyEnum) => {
    const val = (inputValues[tabKey] || "").trim();
    if (!val) return;
    setSaving(true);
    try {
      const existing = tabCreds[tabKey];
      if (existing?.id) {
        await credentialCustomerService.update({
          id: existing.id,
          data: { value: val, key: tabKey },
          toast,
        });
      } else {
        await credentialCustomerService.create({
          data: { key: tabKey, value: val, active: true },
          toast,
        });
      }
      setInputValues((prev) => ({ ...prev, [tabKey]: "" }));
      setEditingTab(null);
      // Refresh this tab's credential
      try {
        const cred = await credentialCustomerService.getCredentialByKey(tabKey);
        setTabCreds((prev) => ({
          ...prev,
          [tabKey]: { id: cred?.id || null, active: !!cred?.active, loaded: true },
        }));
      } catch {}
      onCredentialChange();
    } catch {
      // toast already shows error
    } finally {
      setSaving(false);
    }
  };

  const activeTab = CREDENTIAL_TABS.find((t) => t.key === activeTabKey)!;
  const cred = tabCreds[activeTabKey];
  const hasCred = !!cred?.id;
  const isEditing = editingTab === activeTabKey;

  return (
    <Dialog
      isOpen
      onClose={onClose}
      width={520}
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-lg"
      hasCloseIcon
    >
      <Dialog.Header>
        {/* ── Header ── */}
        <div className="flex items-start gap-3 my-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <RiKey2Line className="text-lg text-indigo-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-800 leading-tight">
              {t("Cài đặt API Credentials")}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <RiShieldCheckLine className="text-green-500 flex-shrink-0" />
              {t("Credentials được mã hóa và lưu trên server.")}
            </p>
          </div>
        </div>
        {/* ── Close button ── */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex items-center justify-center"
        >
          <RiCloseLine className="text-lg" />
        </button>
      </Dialog.Header>
      <Dialog.Body>
        <div className="p-1">
          {/* ── Tabs ── */}
          <div className="flex gap-1 mb-4 bg-gray-50 rounded-xl p-1 border border-gray-100">
            {CREDENTIAL_TABS.map((tab) => {
              const tc = tabCreds[tab.key];
              const isActive = tab.key === activeTabKey;
              const hasVal = !!tc?.id;
              const isOk = hasVal && tc?.active;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTabKey(tab.key);
                    setEditingTab(null);
                  }}
                  className={`flex-1 text-xs font-medium py-2 px-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-white shadow-sm text-gray-800 border border-gray-200"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      isOk ? "bg-green-500" : hasVal ? "bg-amber-400" : "bg-gray-300"
                    }`}
                  />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* ── Description ── */}
          {activeTab.description && (
            <p className="text-xs text-gray-400 mb-3 px-1">{t(activeTab.description)}</p>
          )}

          {/* ── Content ── */}
          {!cred?.loaded ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-gray-400">{t("Đang tải...")}</span>
            </div>
          ) : hasCred && !isEditing ? (
            /* ── Credential exists → show masked + status ── */
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <RiEyeOffLine className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-gray-500 text-sm tracking-widest font-mono">
                  ••••••••••••••••
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    cred.active
                      ? "bg-green-50 text-green-600 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {cred.active ? (
                    <>
                      <RiCheckLine /> {t("Active")}
                    </>
                  ) : (
                    <>✗ {t("Inactive")}</>
                  )}
                </span>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={() => setEditingTab(activeTabKey)}
                  icon={<RiEditLine />}
                  text={t("Cập nhật")}
                  outline
                  className="justify-end"
                  info
                ></Button>
              </div>
            </div>
          ) : (
            /* ── No credential or editing → input form ── */
            <div className="space-y-3">
              {hasCred && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg py-2 px-3">
                  {t("Nhập giá trị mới để cập nhật")}
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  {activeTab.label}
                </label>
                <input
                  type={activeTab.inputType || "password"}
                  value={inputValues[activeTabKey] || ""}
                  onChange={(e) =>
                    setInputValues((prev) => ({ ...prev, [activeTabKey]: e.target.value }))
                  }
                  placeholder={activeTab.placeholder}
                  onKeyDown={(e) => e.key === "Enter" && handleSave(activeTabKey)}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-sm px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-gray-400"
                />
              </div>

              {activeTab.helpUrl && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  {t("Lấy tại")}{" "}
                  <a
                    href={activeTab.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-600 font-medium no-underline hover:underline transition-colors"
                  >
                    {activeTab.helpLabel || activeTab.helpUrl}
                    <RiExternalLinkLine className="text-xs" />
                  </a>
                </p>
              )}

              <div className="flex gap-2 pt-1 justify-end">
                <Button
                  onClick={() => handleSave(activeTabKey)}
                  disabled={saving || !(inputValues[activeTabKey] || "").trim()}
                  primary
                  icon={<RiSaveLine />}
                  isLoading={saving}
                  text={t("Lưu")}
                ></Button>
                {hasCred && (
                  <Button
                    onClick={() => {
                      setEditingTab(null);
                      setInputValues((prev) => ({ ...prev, [activeTabKey]: "" }));
                    }}
                    outline
                    text={t("Hủy")}
                  ></Button>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog.Body>
    </Dialog>
  );
}

