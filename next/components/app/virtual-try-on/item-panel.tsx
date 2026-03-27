import React, { useState } from "react";
import { ItemType, ItemSlot, GALLERIES, CSS } from "./constants";
import { GalleryPicker, ImageUploader } from "./components";

interface ItemPanelProps {
  slot: ItemSlot;
  onChange: (patch: Partial<ItemSlot>) => void;
  onZoom: (img: string) => void;
  compact?: boolean;
}

export function ItemPanel({ slot, onChange, onZoom, compact = false }: ItemPanelProps) {
  const gallery = GALLERIES[slot.type];
  const selectedGallery = gallery.find((g) => g.url === slot.image)?.url ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 8 : 12 }}>
      {/* Gallery */}
      <GalleryPicker
        items={gallery}
        selected={selectedGallery}
        onSelect={(url, prompt) => onChange({ image: url, prompt: slot.prompt || prompt })}
      />

      {/* Custom upload / URL */}
      <div>
        <p style={{ color: CSS.textMuted, fontSize: 11, margin: "0 0 6px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          🖼 Ảnh tùy chỉnh
        </p>
        <ImageUploader
          image={gallery.some((g) => g.url === slot.image) ? null : slot.image}
          onChange={(img) => onChange({ image: img })}
          onZoom={onZoom}
          height={compact ? 100 : 130}
          placeholder="Upload hoặc dán URL ảnh"
        />
      </div>

      {/* Prompt */}
      <div>
        <label style={{ color: CSS.textMuted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>✏️ Prompt mô tả</label>
        <textarea
          value={slot.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder="Mô tả chi tiết phong cách, màu sắc, chất liệu..."
          rows={compact ? 2 : 3}
          style={{
            display: "block", width: "100%", boxSizing: "border-box", marginTop: 6,
            padding: "8px 12px", borderRadius: CSS.radiusSm, border: CSS.border,
            background: CSS.bgCard, color: "#fff", fontSize: 12, resize: "vertical",
            outline: "none", lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}
