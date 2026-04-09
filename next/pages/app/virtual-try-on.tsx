/**
 * Virtual Try-On App – Powered by Gemini AI
 * Slug: "virtual-try-on"
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  GEMINI_MODELS,
  ImageUploader,
  SettingsModal,
  ZoomModal,
} from "../../components/app/virtual-try-on/components";
import {
  BatchOutfit,
  CSS,
  HistoryItem,
  ITEM_META,
  ItemSlot,
  ItemType,
  makeDefaultSingleSlots,
  makeOutfit,
  Mode,
  PoseKey,
  POSES,
  uid,
} from "../../components/app/virtual-try-on/constants";
import { ItemPanel } from "../../components/app/virtual-try-on/item-panel";
import { credentialCustomerService } from "../../lib/repo";
import { AiProviderKeyEnum } from "../../lib/repo/product/productApp.repo";

/* ══════════════════════════════════════════════════════
   Helpers
══════════════════════════════════════════════════════ */
const card = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: CSS.bgCard,
  border: CSS.border,
  borderRadius: CSS.radius,
  backdropFilter: "blur(10px)",
  ...extra,
});

const btn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  border: "none",
  borderRadius: CSS.radiusSm,
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  transition: "all 0.15s",
  ...extra,
});

/* ══════════════════════════════════════════════════════
   Main Component
══════════════════════════════════════════════════════ */
export default function VirtualTryOn() {
  /* ─── Settings ─── */
  const [geminiModel, setGeminiModel] = useState(GEMINI_MODELS[0].value);
  const [showSettings, setShowSettings] = useState(false);

  /* ─── Credential state ─── */
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);

  /* ─── Mode ─── */
  const [mode, setMode] = useState<Mode>("single");

  /* ─── Person ─── */
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [personPrompt, setPersonPrompt] = useState("");
  const [pose, setPose] = useState<PoseKey>("front");
  const [cleanPrompt, setCleanPrompt] = useState(
    "Remove ALL existing clothing, shoes, and accessories from the person first."
  );
  const [showCleanPrompt, setShowCleanPrompt] = useState(false);

  /* ─── Single mode ─── */
  const [singleSlots, setSingleSlots] =
    useState<Record<ItemType, ItemSlot>>(makeDefaultSingleSlots);
  const [activeTab, setActiveTab] = useState<ItemType>("clothing");

  /* ─── Batch mode ─── */
  const [batches, setBatches] = useState<BatchOutfit[]>([makeOutfit("Outfit 1")]);

  /* ─── Results / state ─── */
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ─── Zoom ─── */
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  /* ─── Check credential on mount ─── */
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
  }, []);

  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  const saveSettings = (m: string) => {
    setGeminiModel(m);
  };

  /* ─── Single slot updater ─── */
  const updateSingle = (type: ItemType, patch: Partial<ItemSlot>) =>
    setSingleSlots((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));

  /* ─── Batch slot updater ─── */
  const updateBatchSlot = (outfitId: string, type: ItemType, patch: Partial<ItemSlot>) =>
    setBatches((prev) =>
      prev.map((o) =>
        o.id !== outfitId
          ? o
          : {
              ...o,
              slots: {
                ...o.slots,
                [type]: { type, image: null, prompt: "", ...(o.slots[type] ?? {}), ...patch },
              },
            }
      )
    );

  const removeBatchSlot = (outfitId: string, type: ItemType) =>
    setBatches((prev) =>
      prev.map((o) => {
        if (o.id !== outfitId) return o;
        const slots = { ...o.slots };
        delete slots[type];
        return { ...o, slots };
      })
    );

  /* ─── API call ─── */
  const callApi = async (payload: object): Promise<{ image: string | null; text: string }> => {
    const r = await fetch("/api/virtual-try-on?model=" + encodeURIComponent(geminiModel), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (!r.ok || !d.success) throw new Error(d.error || "Generation failed");
    return { image: d.image, text: d.text };
  };

  /* ─── Determine key status ─── */
  const hasKey = !!credentialId;
  const keyReady = hasKey && credentialActive;

  /* ─── Generate Single ─── */
  const generateSingle = async () => {
    if (!hasKey) return setShowSettings(true);
    if (!personImage) return setError("Vui lòng chọn ảnh nhân vật.");
    const items = Object.values(singleSlots).filter((s) => s.image);
    if (!items.length) return setError("Vui lòng thêm ít nhất 1 trang phục/phụ kiện.");
    setIsGenerating(true);
    setError(null);
    try {
      const { image } = await callApi({
        personImage,
        personPrompt,
        pose,
        cleaningPrompt: cleanPrompt,
        items,
        mode: "single",
      });
      if (image) setHistory((h) => [{ id: uid(), ts: Date.now(), image }, ...h]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  /* ─── Generate Batch ─── */
  const generateBatch = async () => {
    if (!hasKey) return setShowSettings(true);
    if (!personImage) return setError("Vui lòng chọn ảnh nhân vật.");
    setError(null);
    setBatches((prev) =>
      prev.map((o) => ({ ...o, isGenerating: true, error: null, result: null }))
    );

    await Promise.all(
      batches.map(async (outfit) => {
        const items = Object.values(outfit.slots).filter((s) => s?.image);
        if (!items.length) {
          setBatches((prev) =>
            prev.map((o) =>
              o.id === outfit.id ? { ...o, isGenerating: false, error: "Chưa chọn trang phục" } : o
            )
          );
          return;
        }
        try {
          const { image } = await callApi({
            personImage,
            personPrompt,
            pose,
            cleaningPrompt: cleanPrompt,
            items,
            mode: "batch",
            changingItemTypes: Object.keys(outfit.slots),
          });
          setBatches((prev) =>
            prev.map((o) => (o.id === outfit.id ? { ...o, result: image, isGenerating: false } : o))
          );
          if (image) setHistory((h) => [{ id: uid(), ts: Date.now(), image }, ...h]);
        } catch (e: any) {
          setBatches((prev) =>
            prev.map((o) =>
              o.id === outfit.id ? { ...o, isGenerating: false, error: e.message } : o
            )
          );
        }
      })
    );
  };

  /* ══ RENDER ══════════════════════════════════════════════════ */
  return (
    <div
      style={{
        minHeight: "100vh",
        background: CSS.gradBg,
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: CSS.textPrimary,
      }}
    >
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box} textarea,input{font-family:inherit}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.4);border-radius:99px}
      `}</style>

      {/* Modals */}
      {zoomedImage && <ZoomModal src={zoomedImage} onClose={() => setZoomedImage(null)} />}
      {showSettings && (
        <SettingsModal
          credentialId={credentialId}
          credentialActive={credentialActive}
          model={geminiModel}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
          onCredentialChange={checkCredential}
        />
      )}

      {/* ── Header ─────────────────────────────────────── */}
      <div
        style={{
          ...card({
            borderRadius: 0,
            borderLeft: "none",
            borderRight: "none",
            borderTop: "none",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }),
        }}
      >
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>✨</span>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                background: CSS.gradAccent,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Virtual Try-On
            </h1>
            <p style={{ margin: 0, fontSize: 11, color: CSS.textMuted }}>Powered by Gemini AI</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 10,
            padding: 3,
            gap: 3,
          }}
        >
          {[
            ["single", "👗 Single", "Phối đồ đơn"] as const,
            ["batch", "📦 Batch", "Thử nhiều outfit"] as const,
          ].map(([m, label, tip]) => (
            <button
              key={m}
              title={tip}
              onClick={() => setMode(m)}
              style={btn({
                padding: "6px 14px",
                fontSize: 12,
                color: mode === m ? "#fff" : CSS.textSecondary,
                background: mode === m ? CSS.gradAccent : "transparent",
                borderRadius: 8,
              })}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowSettings(true)}
          title={
            credentialLoading
              ? "Đang kiểm tra..."
              : keyReady
              ? "Gemini key đã cài & active"
              : hasKey
              ? "Key chưa được active"
              : "Cần cài Gemini API key"
          }
          style={btn({
            padding: "8px 14px",
            fontSize: 12,
            background: credentialLoading
              ? "rgba(139,92,246,0.1)"
              : keyReady
              ? "rgba(16,185,129,0.15)"
              : "rgba(239,68,68,0.15)",
            border: credentialLoading
              ? "1px solid rgba(139,92,246,0.3)"
              : keyReady
              ? "1px solid rgba(16,185,129,0.4)"
              : "1px solid rgba(239,68,68,0.4)",
            color: credentialLoading ? CSS.textMuted : keyReady ? "#10b981" : "#ef4444",
          })}
        >
          {credentialLoading
            ? "⏳ ..."
            : keyReady
            ? "🔑 Gemini OK"
            : hasKey
            ? "⚠️ Key inactive"
            : "⚠️ Cài Gemini Key"}
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "290px 1fr 330px",
          gap: 12,
          padding: 12,
          maxWidth: 1600,
          margin: "0 auto",
        }}
      >
        {/* ══ LEFT: Person Panel ═════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={card({ padding: 16 })}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: CSS.accent }}>
              👤 Nhân vật
            </h3>
            <ImageUploader
              image={personImage}
              onChange={setPersonImage}
              onZoom={setZoomedImage}
              height={180}
              placeholder="Upload / URL ảnh người mẫu"
            />
            <textarea
              value={personPrompt}
              onChange={(e) => setPersonPrompt(e.target.value)}
              placeholder="Mô tả nhân vật: giới tính, vóc dáng, màu da, kiểu tóc..."
              rows={2}
              style={{
                display: "block",
                width: "100%",
                marginTop: 10,
                padding: "8px 12px",
                borderRadius: CSS.radiusSm,
                border: CSS.border,
                background: CSS.bgCard,
                color: "#fff",
                fontSize: 12,
                resize: "none",
                outline: "none",
              }}
            />
          </div>

          {/* Pose */}
          <div style={card({ padding: 16 })}>
            <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: CSS.accent }}>
              🕺 Tư thế
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {POSES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPose(p.key)}
                  style={btn({
                    padding: "8px 6px",
                    fontSize: 11,
                    textAlign: "center",
                    background: pose === p.key ? CSS.gradAccent : CSS.bgCard,
                    color: pose === p.key ? "#fff" : CSS.textSecondary,
                    border: pose === p.key ? "none" : CSS.border,
                  })}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clean Prompt */}
          <div style={card({ padding: 12 })}>
            <button
              onClick={() => setShowCleanPrompt(!showCleanPrompt)}
              style={btn({
                background: "transparent",
                color: CSS.textSecondary,
                fontSize: 12,
                padding: "4px 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
              })}
            >
              🧹 Prompt làm sạch {showCleanPrompt ? "▲" : "▼"}
            </button>
            {showCleanPrompt && (
              <textarea
                value={cleanPrompt}
                onChange={(e) => setCleanPrompt(e.target.value)}
                rows={3}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 8,
                  padding: "8px 12px",
                  borderRadius: CSS.radiusSm,
                  border: CSS.border,
                  background: CSS.bgCard,
                  color: "#fff",
                  fontSize: 11,
                  resize: "vertical",
                  outline: "none",
                }}
              />
            )}
          </div>
        </div>

        {/* ══ CENTER: Results ════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Generate Button */}
          <button
            onClick={mode === "single" ? generateSingle : generateBatch}
            disabled={isGenerating}
            style={btn({
              width: "100%",
              padding: "14px 0",
              fontSize: 15,
              background: isGenerating ? "rgba(139,92,246,0.3)" : CSS.gradAccent,
              color: "#fff",
              opacity: isGenerating ? 0.7 : 1,
              boxShadow: isGenerating ? "none" : "0 4px 24px rgba(139,92,246,0.4)",
              transform: isGenerating ? "none" : "translateY(0)",
            })}
          >
            {isGenerating
              ? "⏳ Đang tạo ảnh..."
              : `✨ ${mode === "single" ? "Thử đồ ngay" : "Thử tất cả outfit"}`}
          </button>

          {error && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: CSS.radiusSm,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444",
                fontSize: 13,
              }}
            >
              ❌ {error}
            </div>
          )}

          {/* Single Mode – Latest result big view */}
          {mode === "single" && (
            <>
              <div
                style={card({
                  padding: 0,
                  overflow: "hidden",
                  minHeight: 320,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                })}
              >
                {history.length > 0 ? (
                  <div
                    style={{ position: "relative", width: "100%", cursor: "zoom-in" }}
                    onClick={() => setZoomedImage(history[0].image)}
                  >
                    <img
                      src={history[0].image}
                      style={{
                        width: "100%",
                        maxHeight: "65vh",
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                    <div style={{ position: "absolute", top: 10, right: 10 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomedImage(history[0].image);
                        }}
                        style={btn({
                          padding: "6px 12px",
                          background: "rgba(0,0,0,0.6)",
                          color: "#fff",
                          fontSize: 12,
                          border: "1px solid rgba(255,255,255,0.2)",
                          backdropFilter: "blur(8px)",
                        })}
                      >
                        🔍 Zoom
                      </button>
                    </div>
                    <a
                      href={history[0].image}
                      download={`tryon-${history[0].ts}.png`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        padding: "6px 12px",
                        background: "rgba(0,0,0,0.6)",
                        color: "#fff",
                        fontSize: 12,
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: CSS.radiusSm,
                        backdropFilter: "blur(8px)",
                        textDecoration: "none",
                      }}
                    >
                      💾 Tải về
                    </a>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", color: CSS.textMuted, padding: 40 }}>
                    <div style={{ fontSize: 56, marginBottom: 16 }}>✨</div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Kết quả sẽ hiển thị tại đây</div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>
                      Chọn trang phục và nhấn "Thử đồ ngay"
                    </div>
                  </div>
                )}
              </div>

              {/* History */}
              {history.length > 1 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      color: CSS.textMuted,
                      fontWeight: 600,
                    }}
                  >
                    🕐 Lịch sử ({history.length})
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                      gap: 8,
                    }}
                  >
                    {history.slice(1).map((h) => (
                      <div
                        key={h.id}
                        style={{
                          position: "relative",
                          borderRadius: CSS.radiusSm,
                          overflow: "hidden",
                          cursor: "pointer",
                          border: CSS.border,
                        }}
                        onClick={() => setZoomedImage(h.image)}
                      >
                        <img
                          src={h.image}
                          style={{
                            width: "100%",
                            height: 80,
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: 2,
                            right: 4,
                            fontSize: 9,
                            color: "rgba(255,255,255,0.5)",
                          }}
                        >
                          {new Date(h.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Batch Mode – Grid of outfit results */}
          {mode === "batch" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 10,
              }}
            >
              {batches.map((outfit, idx) => (
                <div key={outfit.id} style={card({ padding: 10 })}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: CSS.textPrimary }}>
                      {outfit.name}
                    </span>
                    {batches.length > 1 && (
                      <button
                        onClick={() => setBatches((prev) => prev.filter((o) => o.id !== outfit.id))}
                        style={btn({
                          padding: "2px 6px",
                          fontSize: 11,
                          background: "rgba(239,68,68,0.15)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.3)",
                        })}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      minHeight: 140,
                      borderRadius: CSS.radiusSm,
                      overflow: "hidden",
                      background: "rgba(0,0,0,0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: outfit.result ? "zoom-in" : "default",
                    }}
                    onClick={() => outfit.result && setZoomedImage(outfit.result)}
                  >
                    {outfit.isGenerating ? (
                      <div style={{ textAlign: "center", color: CSS.textMuted, padding: 20 }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                        <div style={{ fontSize: 12 }}>Đang tạo...</div>
                      </div>
                    ) : outfit.error ? (
                      <div
                        style={{ color: "#ef4444", fontSize: 11, padding: 12, textAlign: "center" }}
                      >
                        ❌ {outfit.error}
                      </div>
                    ) : outfit.result ? (
                      <img
                        src={outfit.result}
                        style={{ width: "100%", height: 140, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          color: CSS.textMuted,
                          fontSize: 12,
                          textAlign: "center",
                          padding: 20,
                        }}
                      >
                        <div style={{ fontSize: 28, marginBottom: 4 }}>📦</div>Chưa tạo
                      </div>
                    )}
                  </div>
                  {outfit.result && (
                    <a
                      href={outfit.result}
                      download={`batch-${outfit.name}-${Date.now()}.png`}
                      style={{
                        display: "block",
                        textAlign: "center",
                        marginTop: 6,
                        padding: "4px 0",
                        borderRadius: CSS.radiusSm,
                        background: "rgba(139,92,246,0.15)",
                        color: CSS.accent,
                        fontSize: 11,
                        textDecoration: "none",
                        border: CSS.borderAccent,
                      }}
                    >
                      💾 Tải về
                    </a>
                  )}
                </div>
              ))}
              <button
                onClick={() =>
                  setBatches((prev) => [...prev, makeOutfit(`Outfit ${prev.length + 1}`)])
                }
                style={card({
                  padding: 10,
                  border: "2px dashed rgba(139,92,246,0.3)",
                  cursor: "pointer",
                  color: CSS.accent,
                  fontSize: 13,
                  fontWeight: 600,
                  minHeight: 140,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(139,92,246,0.04)",
                } as React.CSSProperties)}
              >
                <span style={{ fontSize: 28 }}>➕</span>
                Thêm outfit
              </button>
            </div>
          )}
        </div>

        {/* ══ RIGHT: Item Panels ════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {mode === "single" ? (
            <div style={card({ padding: 0, overflow: "hidden" })}>
              {/* Tabs */}
              <div style={{ display: "flex", borderBottom: CSS.border }}>
                {ITEM_META.map(({ key, icon, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={btn({
                      flex: 1,
                      padding: "10px 4px",
                      fontSize: 11,
                      borderRadius: 0,
                      background: activeTab === key ? "rgba(139,92,246,0.12)" : "transparent",
                      color: activeTab === key ? CSS.accent : CSS.textMuted,
                      borderBottom:
                        activeTab === key ? `2px solid ${CSS.accent}` : "2px solid transparent",
                    })}
                  >
                    <span style={{ fontSize: 16, display: "block" }}>{icon}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ padding: 14, overflowY: "auto", maxHeight: "calc(100vh - 200px)" }}>
                <ItemPanel
                  slot={singleSlots[activeTab]}
                  onChange={(patch) => updateSingle(activeTab, patch)}
                  onZoom={setZoomedImage}
                />
              </div>
            </div>
          ) : (
            /* Batch: show outfit card configurator for selected outfit */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {batches.map((outfit) => (
                <div key={outfit.id} style={card({ padding: 14 })}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <input
                      value={outfit.name}
                      onChange={(e) =>
                        setBatches((prev) =>
                          prev.map((o) => (o.id === outfit.id ? { ...o, name: e.target.value } : o))
                        )
                      }
                      style={{
                        flex: 1,
                        background: CSS.bgCard,
                        border: CSS.border,
                        borderRadius: CSS.radiusSm,
                        color: "#fff",
                        padding: "6px 10px",
                        fontSize: 13,
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                  </div>
                  {/* Toggle which item types to include */}
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
                    {ITEM_META.map(({ key, icon, label }) => {
                      const active = key in outfit.slots;
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (active) removeBatchSlot(outfit.id, key);
                            else
                              updateBatchSlot(outfit.id, key, {
                                type: key,
                                image: null,
                                prompt: "",
                              });
                          }}
                          style={btn({
                            padding: "4px 10px",
                            fontSize: 11,
                            background: active ? CSS.gradAccent : CSS.bgCard,
                            color: active ? "#fff" : CSS.textMuted,
                            border: active ? "none" : CSS.border,
                          })}
                        >
                          {icon} {label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Panels for active slots */}
                  {Object.entries(outfit.slots).map(([type, slot]) => (
                    <div key={type} style={{ marginBottom: 12 }}>
                      <p
                        style={{
                          margin: "0 0 6px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: CSS.accent,
                        }}
                      >
                        {ITEM_META.find((m) => m.key === type)?.icon}{" "}
                        {ITEM_META.find((m) => m.key === type)?.label}
                      </p>
                      <ItemPanel
                        slot={slot!}
                        onChange={(patch) => updateBatchSlot(outfit.id, type as ItemType, patch)}
                        onZoom={setZoomedImage}
                        compact
                      />
                    </div>
                  ))}
                  {Object.keys(outfit.slots).length === 0 && (
                    <p
                      style={{
                        color: CSS.textMuted,
                        fontSize: 12,
                        textAlign: "center",
                        margin: "10px 0",
                      }}
                    >
                      Chọn các thành phần muốn thay đổi ở trên
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* end grid */}
    </div>
  );
}
