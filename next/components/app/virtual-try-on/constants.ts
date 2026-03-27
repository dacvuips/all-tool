export type Mode = "single" | "batch";
export type PoseKey = "front" | "tilt_left" | "tilt_right" | "turn_left" | "turn_right" | "back";
export type ItemType = "clothing" | "shoes" | "jewelry" | "accessory";

export interface ItemSlot {
  type: ItemType;
  image: string | null;
  prompt: string;
}

export interface BatchOutfit {
  id: string;
  name: string;
  slots: Partial<Record<ItemType, ItemSlot>>;
  result: string | null;
  isGenerating: boolean;
  error: string | null;
}

export interface HistoryItem {
  id: string;
  ts: number;
  image: string;
}

export const ITEM_META: { key: ItemType; label: string; icon: string }[] = [
  { key: "clothing", label: "Quần áo", icon: "👕" },
  { key: "shoes", label: "Giày dép", icon: "👟" },
  { key: "jewelry", label: "Trang sức", icon: "💎" },
  { key: "accessory", label: "Phụ kiện", icon: "👜" },
];

export const POSES: { key: PoseKey; label: string; icon: string }[] = [
  { key: "front", label: "Đứng thẳng", icon: "🧍" },
  { key: "tilt_left", label: "Nghiêng trái", icon: "↖️" },
  { key: "tilt_right", label: "Nghiêng phải", icon: "↗️" },
  { key: "turn_left", label: "Xoay trái", icon: "↩️" },
  { key: "turn_right", label: "Xoay phải", icon: "↪️" },
  { key: "back", label: "Sau lưng", icon: "🔚" },
];

const Q = "?w=220&q=75&auto=format&fit=crop";

export const GALLERIES: Record<ItemType, { url: string; label: string; prompt: string }[]> = {
  clothing: [
    { url: `https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8${Q}`, label: "Áo trắng", prompt: "White basic t-shirt, minimal clean style" },
    { url: `https://images.unsplash.com/photo-1551028719-00167b16eac5${Q}`, label: "Áo khoác đen", prompt: "Black leather jacket, edgy style" },
    { url: `https://images.unsplash.com/photo-1562157873-818bc0726f68${Q}`, label: "Váy đỏ", prompt: "Red elegant flowing dress" },
    { url: `https://images.unsplash.com/photo-1434389677669-e08b4cac3105${Q}`, label: "Jeans xanh", prompt: "Blue denim jeans, casual" },
    { url: `https://images.unsplash.com/photo-1515886657613-9f3515b0c78f${Q}`, label: "Thời trang", prompt: "High fashion editorial outfit" },
    { url: `https://images.unsplash.com/photo-1469334031218-e382a71b716b${Q}`, label: "Váy xanh", prompt: "Blue chiffon dress, occasion wear" },
  ],
  shoes: [
    { url: `https://images.unsplash.com/photo-1542291026-7eec264c27ff${Q}`, label: "Sneaker đỏ", prompt: "Red sport sneakers, athletic" },
    { url: `https://images.unsplash.com/photo-1543163521-1bf539c55dd2${Q}`, label: "Sneaker trắng", prompt: "White clean leather sneakers" },
    { url: `https://images.unsplash.com/photo-1584464491033-06628f3a6b7b${Q}`, label: "Cao gót", prompt: "Black high heel stilettos, elegant" },
    { url: `https://images.unsplash.com/photo-1515955656352-a1fa3ffcd111${Q}`, label: "Thể thao", prompt: "Running sport shoes, performance" },
    { url: `https://images.unsplash.com/photo-1478131143081-80f7f84ca84d${Q}`, label: "Boots", prompt: "Brown leather ankle boots, chic" },
    { url: `https://images.unsplash.com/photo-1463100099107-aa0980c362e6${Q}`, label: "Sandal", prompt: "Open-toe sandals, summer style" },
  ],
  jewelry: [
    { url: `https://images.unsplash.com/photo-1599643477877-530eb83abc8e${Q}`, label: "Dây chuyền vàng", prompt: "Gold necklace, elegant jewelry" },
    { url: `https://images.unsplash.com/photo-1535632066927-ab7c9ab60908${Q}`, label: "Bông tai", prompt: "Statement drop earrings" },
    { url: `https://images.unsplash.com/photo-1573408301185-9519f94816f7${Q}`, label: "Vòng tay", prompt: "Delicate gold bracelet" },
    { url: `https://images.unsplash.com/photo-1605100804763-247f67b3557e${Q}`, label: "Nhẫn kim cương", prompt: "Diamond ring luxury" },
    { url: `https://images.unsplash.com/photo-1608042314453-ae338d9c6ad6${Q}`, label: "Bông tai ngọc", prompt: "Pearl earrings classic elegant" },
    { url: `https://images.unsplash.com/photo-1618073858940-e68e00af8c04${Q}`, label: "Dây chuyền bạc", prompt: "Silver layered chain necklace" },
  ],
  accessory: [
    { url: `https://images.unsplash.com/photo-1548036328-c9fa89d128fa${Q}`, label: "Túi da", prompt: "Luxury leather handbag" },
    { url: `https://images.unsplash.com/photo-1521369909029-2afed882baee${Q}`, label: "Mũ rơm", prompt: "Straw hat summer beach style" },
    { url: `https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91${Q}`, label: "Kính mát", prompt: "Fashion sunglasses modern" },
    { url: `https://images.unsplash.com/photo-1617038220319-276d3cfab638${Q}`, label: "Thắt lưng", prompt: "Leather waist belt accessory" },
    { url: `https://images.unsplash.com/photo-1622560480605-d83c853bc5c3${Q}`, label: "Khăn lụa", prompt: "Silk scarf elegant neckwear" },
    { url: `https://images.unsplash.com/photo-1553062407-98eeb64c6a62${Q}`, label: "Balo", prompt: "Backpack casual street style" },
  ],
};

// Shared CSS vars
export const CSS = {
  bg: "#0d0d1a",
  bgCard: "rgba(255,255,255,0.05)",
  bgCardHover: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderAccent: "1px solid rgba(139,92,246,0.5)",
  accent: "#8b5cf6",
  accentPink: "#ec4899",
  gradAccent: "linear-gradient(135deg, #8b5cf6, #ec4899)",
  gradBg: "linear-gradient(135deg, #0d0d1a 0%, #1a0f2e 50%, #0d1a2e 100%)",
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textMuted: "#475569",
  radius: "12px",
  radiusSm: "8px",
};

let _uid = 0;
export const uid = () => `${Date.now()}-${++_uid}`;

export const makeDefaultSlots = (): Partial<Record<ItemType, ItemSlot>> => ({});

export const makeDefaultSingleSlots = (): Record<ItemType, ItemSlot> =>
  Object.fromEntries(
    ITEM_META.map(({ key }) => [key, { type: key, image: null, prompt: "" }])
  ) as Record<ItemType, ItemSlot>;

export const makeOutfit = (name: string): BatchOutfit => ({
  id: uid(),
  name,
  slots: makeDefaultSlots(),
  result: null,
  isGenerating: false,
  error: null,
});
