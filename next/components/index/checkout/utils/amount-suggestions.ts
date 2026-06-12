export const NORMAL_CHECKOUT_MIN = 100_000;
export const NORMAL_CHECKOUT_MAX = 50_000_000;

/** Parse chuỗi nhập tiền (có thể chứa dấu phân cách) thành số nguyên VNĐ. */
export function parseAmountInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * Gợi ý số tiền: nhân base với 10, 100, 1000, 10000.
 * Mỗi gợi ý tối đa NORMAL_CHECKOUT_MAX (50 triệu), không vượt quá.
 * Ví dụ: 2 → 20, 200, 2000, 20000 | 2000 → 20000, 200000, ...
 */
export function getAmountSuggestions(base: number): number[] {
  if (!base || base <= 0) return [];
  const suggestions = [10, 100, 1000, 10000].map((multiplier) =>
    Math.min(base * multiplier, NORMAL_CHECKOUT_MAX)
  );
  return suggestions.filter((value, index, arr) => arr.indexOf(value) === index);
}

export function validateNormalAmount(amount: number | null): string | null {
  if (amount === null || amount <= 0) {
    return "Vui lòng nhập số tiền hợp lệ";
  }
  if (amount < NORMAL_CHECKOUT_MIN) {
    return `Số tiền tối thiểu là ${NORMAL_CHECKOUT_MIN.toLocaleString("vi-VN")}đ`;
  }
  if (amount > NORMAL_CHECKOUT_MAX) {
    return `Số tiền tối đa là ${NORMAL_CHECKOUT_MAX.toLocaleString("vi-VN")}đ`;
  }
  return null;
}
