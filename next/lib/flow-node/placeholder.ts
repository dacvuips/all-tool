/**
 * Flow Node - Placeholder replacement utility
 * Thay thế {{key}} và {{context.nodeId}} trong template bằng giá trị từ fieldValues và context.
 * Dùng chung cho API execute flow node.
 */

/** Map key -> value cho field của node (người dùng nhập) */
export type FieldValues = Record<string, unknown>;

/** Kết quả từ các node trước (nodeId -> response data) dùng cho chuỗi auto-run */
export type NodeContext = Record<string, unknown>;

/**
 * Thay thế placeholder trong chuỗi template.
 * - {{key}} → fieldValues[key]
 * - {{context.nodeId}} hoặc {{context.node_id}} → context[nodeId]
 * @param template Chuỗi có chứa {{placeholder}}
 * @param fieldValues Giá trị các field người dùng nhập
 * @param context Kết quả các node đã chạy trước (cho auto-run)
 * @returns Chuỗi đã thay thế
 */
export function replacePlaceholders(
  template: string,
  fieldValues: FieldValues = {},
  context: NodeContext = {}
): string {
  if (!template || typeof template !== "string") return template;

  return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
    const trimmed = key.trim();

    // {{context.nodeId}} hoặc {{context.node_id}}
    if (trimmed.startsWith("context.")) {
      const nodeKey = trimmed.slice("context.".length).trim();
      const value = context[nodeKey];
      return value === undefined ? "" : safeStringify(value);
    }

    // {{fieldKey}} từ form
    const value = fieldValues[trimmed];
    return value === undefined ? "" : safeStringify(value);
  });
}

/**
 * Chuỗi hóa giá trị an toàn (object/array → JSON, còn lại → String).
 */
function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Parse bodyTemplate sau khi replace thành object/string để gửi API.
 * Nếu template là JSON hợp lệ thì parse, không thì trả về chuỗi.
 */
export function parseBodyAfterReplace(template: string): unknown {
  const trimmed = template.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}
