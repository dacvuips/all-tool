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
  const [keyVal, setKeyVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const hasCredential = !!credentialId;

  const handleSaveKey = async () => {
    if (!keyVal.trim()) return;
    setSaving(true);
    try {
      if (hasCredential) {
        await credentialCustomerService.update({
          id: credentialId!,
          data: { value: keyVal.trim(), key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY },
          toast,
        });
      } else {
        await credentialCustomerService.create({
          data: {
            key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
            value: keyVal.trim(),
            active: true,
          },
          toast,
        });
      }
      setKeyVal("");
      setEditMode(false);
      onCredentialChange();
    } catch {
      // toast đã hiển thị lỗi
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      width={460}
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
              {t("Cài đặt Gemini API Key")}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <RiShieldCheckLine className="text-green-500 flex-shrink-0" />
              {t("API Key được lưu trên server, an toàn hơn lưu trình duyệt.")}
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
          {/* ── Content ── */}
          {hasCredential && !editMode ? (
            /* ── Credential exists → show masked key + status ── */
            <div className="space-y-3">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <RiEyeOffLine className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-gray-500 text-sm tracking-widest font-mono">
                  ••••••••••••••••
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    credentialActive
                      ? "bg-green-50 text-green-600 border border-green-200"
                      : "bg-red-50 text-red-600 border border-red-200"
                  }`}
                >
                  {credentialActive ? (
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
                  onClick={() => setEditMode(true)}
                  icon={<RiEditLine />}
                  text={t("Cập nhật key")}
                  outline
                  className="justify-end"
                  info
                ></Button>
              </div>
            </div>
          ) : (
            /* ── No credential or editing → input form ── */
            <div className="space-y-3">
              {hasCredential && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg py-2">
                  {t("Nhập key mới để cập nhật")}
                </p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">API Key</label>
                <input
                  type="password"
                  value={keyVal}
                  onChange={(e) => setKeyVal(e.target.value)}
                  placeholder="AIza..."
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                  className="w-full rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-sm px-4 py-2.5 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder-gray-400"
                />
              </div>

              <p className="text-xs text-gray-400 flex items-center gap-1">
                {t("Lấy key tại")}{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-600 font-medium no-underline hover:underline transition-colors"
                >
                  aistudio.google.com
                  <RiExternalLinkLine className="text-xs" />
                </a>
              </p>

              <div className="flex gap-2 pt-1 justify-end">
                <Button
                  onClick={handleSaveKey}
                  disabled={saving || !keyVal.trim()}
                  primary
                  icon={<RiSaveLine />}
                  isLoading={saving}
                  text={t("Lưu key")}
                ></Button>
                {hasCredential && (
                  <Button
                    onClick={() => {
                      setEditMode(false);
                      setKeyVal("");
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
