import React, { useState, useRef, useCallback, useEffect } from "react";
import { CSS } from "./constants";
import { credentialCustomerService } from "../../../lib/repo";
import { AiProviderKeyEnum } from "../../../lib/repo/product/productApp.repo";

/* ───────────────────────────── ZoomModal ───────────────────────────── */
export function ZoomModal({ src, onClose }: { src: string; onClose: () => void }) {
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

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset((o) => ({ x: o.x + e.clientX - lastPos.current.x, y: o.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.93)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "grab" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onWheel={onWheel}
    >
      <img
        src={src}
        draggable={false}
        style={{
          maxWidth: "88vw", maxHeight: "88vh", borderRadius: 16,
          transform: `translate(${offset.x}px,${offset.y}px) scale(${scale})`,
          transition: dragging.current ? "none" : "transform 0.1s",
          userSelect: "none", pointerEvents: "none",
          boxShadow: "0 30px 80px rgba(0,0,0,0.7)",
        }}
      />
      <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
        {[
          { l: "🔍+", t: "Phóng to", fn: () => setScale((s) => Math.min(8, s + 0.4)) },
          { l: "🔍−", t: "Thu nhỏ", fn: () => setScale((s) => Math.max(0.3, s - 0.4)) },
          { l: "↺", t: "Reset", fn: () => { setScale(1); setOffset({ x: 0, y: 0 }); } },
          { l: "✕", t: "Đóng (Esc)", fn: onClose },
        ].map((b) => (
          <button key={b.l} title={b.t} onClick={b.fn} style={{
            background: "rgba(255,255,255,0.14)", border: "1px solid rgba(255,255,255,0.25)",
            color: "#fff", borderRadius: 10, padding: "8px 18px", cursor: "pointer", fontSize: 14,
            backdropFilter: "blur(12px)", fontWeight: 600,
          }}>{b.l}</button>
        ))}
      </div>
      <p style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,0.4)", fontSize: 12, whiteSpace: "nowrap" }}>
        Cuộn để zoom · Kéo để di chuyển · Esc để đóng
      </p>
    </div>
  );
}

export const GEMINI_MODELS = [
  { value: "gemini-2.5-flash-image",                label: "Gemini 2.5 Flash Image (mới nhất)" },
  { value: "gemini-2.0-flash-exp-image-generation", label: "Gemini 2.0 Flash Exp (ổn định)" },
  { value: "gemini-2.0-flash-exp",                  label: "Gemini 2.0 Flash Exp" },
];

/* ────────────────────────── SettingsModal ────────────────────────── */
interface SettingsModalProps {
  credentialId: string | null;
  credentialActive: boolean;
  model: string;
  onSave: (model: string) => void;
  onClose: () => void;
  onCredentialChange: () => void;
}

export function SettingsModal({
  credentialId,
  credentialActive,
  model,
  onSave,
  onClose,
  onCredentialChange,
}: SettingsModalProps) {
  const [keyVal, setKeyVal] = useState("");
  const [modelVal, setModelVal] = useState(model || GEMINI_MODELS[0].value);
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
        });
      } else {
        await credentialCustomerService.create({
          data: {
            key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
            value: keyVal.trim(),
            active: true,
          },
        });
      }
      setKeyVal("");
      setEditMode(false);
      onCredentialChange();
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 8888, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: "linear-gradient(135deg,#1a1a2e,#16213e)", border: CSS.borderAccent, borderRadius: 20, padding: 32, width: 520, boxShadow: "0 0 60px rgba(139,92,246,0.3)" }}>
        <h2 style={{ color: "#fff", margin: "0 0 8px", fontSize: 20, fontWeight: 700 }}>⚙️ Cài đặt Gemini API</h2>
        <p style={{ color: CSS.textSecondary, fontSize: 13, margin: "0 0 20px" }}>
          API Key được lưu trên server, bảo mật hơn lưu vào trình duyệt.
        </p>

        {/* Credential Section */}
        <label style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600 }}>Gemini API Key</label>

        {hasCredential && !editMode ? (
          /* Đã tồn tại credential → hiển thị masked + status */
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(255,255,255,0.05)", border: CSS.borderAccent, borderRadius: 10 }}>
              <span style={{ flex: 1, color: "#94a3b8", fontSize: 14, letterSpacing: 3 }}>••••••••••••••••</span>
              <span style={{
                padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                background: credentialActive ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                color: credentialActive ? "#10b981" : "#ef4444",
                border: `1px solid ${credentialActive ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
              }}>
                {credentialActive ? "✓ Active" : "✗ Inactive"}
              </span>
            </div>
            <button
              onClick={() => setEditMode(true)}
              style={{ marginTop: 8, padding: "8px 16px", borderRadius: 8, border: CSS.borderAccent, background: "rgba(139,92,246,0.15)", color: CSS.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              ✏️ Cập nhật key
            </button>
          </div>
        ) : (
          /* Chưa tồn tại hoặc đang cập nhật → form nhập key */
          <div style={{ marginTop: 8 }}>
            {hasCredential && (
              <p style={{ fontSize: 12, color: CSS.textMuted, marginBottom: 8 }}>
                Nhập key mới để cập nhật (để trống nếu muốn giữ key cũ)
              </p>
            )}
            <input
              type="password"
              value={keyVal}
              onChange={(e) => setKeyVal(e.target.value)}
              placeholder="AIza..."
              onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
              style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "12px 16px", background: "rgba(255,255,255,0.07)", border: CSS.borderAccent, borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }}
            />
            <p style={{ color: CSS.textMuted, fontSize: 11, marginTop: 6 }}>
              Lấy key tại: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: CSS.accent }}>Google AI Studio</a>
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button
                onClick={handleSaveKey}
                disabled={saving || !keyVal.trim()}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: saving ? "rgba(139,92,246,0.4)" : CSS.gradAccent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", opacity: !keyVal.trim() ? 0.5 : 1 }}
              >
                {saving ? "⏳ Đang lưu..." : hasCredential ? "💾 Cập nhật key" : "💾 Lưu key"}
              </button>
              {hasCredential && (
                <button
                  onClick={() => { setEditMode(false); setKeyVal(""); }}
                  style={{ padding: "10px 18px", borderRadius: 10, border: CSS.border, background: "transparent", color: CSS.textSecondary, fontSize: 14, cursor: "pointer" }}
                >
                  Hủy
                </button>
              )}
            </div>
          </div>
        )}

        {/* Model Selector */}
        <label style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 600, display: "block", marginTop: 20 }}>Gemini Model</label>
        <select value={modelVal} onChange={(e) => setModelVal(e.target.value)} style={{
          display: "block", width: "100%", boxSizing: "border-box", marginTop: 8, padding: "12px 16px",
          background: "rgba(255,255,255,0.07)", border: CSS.borderAccent, borderRadius: 10,
          color: "#fff", fontSize: 13, outline: "none", cursor: "pointer",
        }}>
          {GEMINI_MODELS.map((m) => <option key={m.value} value={m.value} style={{ background: "#1a1a2e" }}>{m.label}</option>)}
        </select>
        <p style={{ color: CSS.textMuted, fontSize: 11, marginTop: 6 }}>Chọn model hỗ trợ tạo ảnh (image generation)</p>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={() => { onSave(modelVal); onClose(); }} style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: CSS.gradAccent, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
            ✓ Đóng & Lưu model
          </button>
          <button onClick={onClose} style={{ padding: "12px 24px", borderRadius: 10, border: CSS.border, background: "transparent", color: CSS.textSecondary, fontSize: 14, cursor: "pointer" }}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── ImageUploader ─────────────────────────── */
interface ImageUploaderProps {
  image: string | null;
  onChange: (img: string | null) => void;
  onZoom?: (img: string) => void;
  placeholder?: string;
  height?: number;
}

export function ImageUploader({ image, onChange, onZoom, placeholder = "Kéo thả hoặc nhấp để tải ảnh", height = 160 }: ImageUploaderProps) {
  const [urlMode, setUrlMode] = useState(false);
  const [urlVal, setUrlVal] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (f: File) => {
    const r = new FileReader();
    r.onload = (e) => onChange(e.target?.result as string);
    r.readAsDataURL(f);
  };

  const tabBtn = (active: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 6, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
      background: active ? CSS.gradAccent : "rgba(255,255,255,0.08)",
      color: active ? "#fff" : CSS.textSecondary,
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {tabBtn(!urlMode, "📁 Upload", () => setUrlMode(false))}
        {tabBtn(urlMode, "🔗 URL", () => setUrlMode(true))}
      </div>

      {urlMode ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input value={urlVal} onChange={(e) => setUrlVal(e.target.value)} placeholder="https://..."
            onKeyDown={(e) => e.key === "Enter" && urlVal.trim() && onChange(urlVal.trim())}
            style={{ flex: 1, padding: "8px 12px", borderRadius: CSS.radiusSm, border: CSS.border, background: CSS.bgCard, color: "#fff", fontSize: 13, outline: "none" }} />
          <button onClick={() => urlVal.trim() && onChange(urlVal.trim())} style={{
            padding: "8px 14px", borderRadius: CSS.radiusSm, border: "none", background: CSS.gradAccent, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Tải</button>
        </div>
      ) : (
        <div
          onClick={() => !image && fileRef.current?.click()}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) readFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          style={{
            height, borderRadius: CSS.radius, border: `2px dashed ${dragging ? CSS.accent : "rgba(255,255,255,0.15)"}`,
            background: dragging ? "rgba(139,92,246,0.08)" : CSS.bgCard,
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden", position: "relative", cursor: image ? "default" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {image ? (
            <img src={image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center", color: CSS.textMuted }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
              <div style={{ fontSize: 12 }}>{placeholder}</div>
            </div>
          )}
        </div>
      )}

      {image && (
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button onClick={() => onZoom?.(image)} style={{ flex: 1, padding: "6px 0", borderRadius: CSS.radiusSm, border: CSS.border, background: "transparent", color: CSS.textSecondary, fontSize: 12, cursor: "pointer" }}>
            🔍 Zoom
          </button>
          <button onClick={() => { onChange(null); setUrlVal(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: CSS.radiusSm, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: 12, cursor: "pointer" }}>
            🗑 Xóa
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ""; }} />
    </div>
  );
}

/* ─────────────────────────── GalleryPicker ─────────────────────────── */
interface GalleryItem {
  url: string;
  label: string;
  prompt: string;
}

interface GalleryPickerProps {
  items: GalleryItem[];
  selected: string | null;
  onSelect: (url: string, prompt: string) => void;
}

export function GalleryPicker({ items, selected, onSelect }: GalleryPickerProps) {
  return (
    <div>
      <p style={{ color: CSS.textMuted, fontSize: 11, margin: "0 0 8px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        📚 Thư viện mẫu
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {items.map((item) => (
          <div
            key={item.url}
            title={item.label}
            onClick={() => onSelect(item.url, item.prompt)}
            style={{
              borderRadius: CSS.radiusSm, overflow: "hidden", cursor: "pointer", position: "relative",
              border: selected === item.url ? `2px solid ${CSS.accent}` : "2px solid transparent",
              transition: "all 0.15s",
              boxShadow: selected === item.url ? `0 0 12px ${CSS.accent}60` : "none",
            }}
          >
            <img src={item.url} alt={item.label} style={{ width: "100%", height: 72, objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.65)", paddingBlock: 3, textAlign: "center" }}>
              <span style={{ color: "#fff", fontSize: 9, fontWeight: 600 }}>{item.label}</span>
            </div>
            {selected === item.url && (
              <div style={{ position: "absolute", top: 3, right: 3, background: CSS.accent, borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
