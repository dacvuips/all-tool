export interface ClassificationOption {
  code: string;
  name: string;
  image?: string; // Data URL for preview
}

export interface ClassificationGroup {
  code: string;
  name: string; // e.g., "Màu sắc", "Kích thước"
  options: ClassificationOption[];
}

export interface Variant {
  code: string;
  option1Id: string; // ID from Group 1
  option2Id?: string; // ID from Group 2 (optional)
  price: number;
  stock: number;
  sku: string;
}

export type VariantField = "price" | "stock" | "sku";
