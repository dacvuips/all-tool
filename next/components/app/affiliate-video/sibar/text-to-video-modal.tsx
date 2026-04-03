/**
 * affiliate-video/components.tsx
 * className only — no inline styles, no style= props.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "../../../../lib/providers/toast-provider";
import { credentialCustomerService } from "../../../../lib/repo";
import { AiProviderKeyEnum } from "../../../../lib/repo/product/productApp.repo";
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {[
          { l: "🔍+", fn: () => setScale((s) => Math.min(8, s + 0.4)) },
          { l: "🔍−", fn: () => setScale((s) => Math.max(0.3, s - 0.4)) },
          {
            l: "↺",
            fn: () => {
              setScale(1);
              setOffset({ x: 0, y: 0 });
            },
          },
          { l: "✕", fn: onClose },
        ].map((b) => (
          <button
            key={b.l}
            onClick={b.fn}
            className="w-9 h-9 rounded-xl bg-black bg-opacity-60 text-white border border-white border-opacity-20 hover:bg-opacity-80 cursor-pointer text-14 font-bold transition-all flex items-center justify-center"
          >
            {b.l}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    <div
      className="fixed inset-0 z-500 flex items-center justify-center bg-black bg-opacity-70 backdrop-filter backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-indigo-500 border-opacity-30 shadow-2xl overflow-hidden"
        style={{ background: "#0e0c1e" }}
      >
        <div className="px-6 py-5 border-b border-white border-opacity-10">
          <h2 className="text-16 font-bold text-white mb-1">⚙️ Cài đặt Gemini API Key</h2>
          <p className="text-12 text-blue-400">
            API Key được lưu trên server, an toàn hơn lưu trình duyệt.
          </p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-11 font-semibold text-blue-400 uppercase tracking-wider mb-2">
              Google Gemini API Key
            </label>

            {hasCredential && !editMode ? (
              /* Đã tồn tại → hiển thị masked + active status */
              <div className="space-y-2">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10">
                  <span className="flex-1 text-blue-300 text-14 tracking-widest">
                    ••••••••••••••••
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-11 font-bold border ${
                      credentialActive
                        ? "bg-green-500 bg-opacity-15 text-green-400 border-green-500 border-opacity-40"
                        : "bg-red-500 bg-opacity-15 text-red-400 border-red-500 border-opacity-40"
                    }`}
                  >
                    {credentialActive ? "✓ Active" : "✗ Inactive"}
                  </span>
                </div>
                <button
                  onClick={() => setEditMode(true)}
                  className="px-4 py-2 rounded-xl text-13 font-semibold text-indigo-400 border border-indigo-500 border-opacity-30 bg-indigo-500 bg-opacity-10 hover:bg-opacity-20 cursor-pointer transition-all"
                >
                  ✏️ Cập nhật key
                </button>
              </div>
            ) : (
              /* Chưa có hoặc đang cập nhật → form nhập */
              <div className="space-y-2">
                {hasCredential && <p className="text-11 text-blue-500">Nhập key mới để cập nhật</p>}
                <input
                  type="password"
                  value={keyVal}
                  onChange={(e) => setKeyVal(e.target.value)}
                  placeholder="AIza..."
                  onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                  className="w-full rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-blue-100 text-13 px-4 py-2 outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-10 text-blue-500">
                  🔹 Gemini{" "}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 underline"
                  >
                    aistudio.google.com
                  </a>
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSaveKey}
                    disabled={saving || !keyVal.trim()}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-14 border-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {saving ? "⏳ Đang lưu..." : hasCredential ? "💾 Cập nhật key" : "💾 Lưu key"}
                  </button>
                  {hasCredential && (
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setKeyVal("");
                      }}
                      className="px-4 py-2 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 text-blue-300 font-semibold text-13 border-0 cursor-pointer transition-all"
                    >
                      Hủy
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-white bg-opacity-10 hover:bg-opacity-20 text-blue-300 font-semibold text-13 border-0 cursor-pointer transition-all"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
