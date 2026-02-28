/**
 * Flow Node - Placeholder replacement (dùng chung cho API execute flow node trong src/routers).
 * Thay {{key}} và {{context.nodeId}} trong template bằng fieldValues và context.
 */

export type FieldValues = Record<string, unknown>;
export type NodeContext = Record<string, unknown>;

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
 * Thay placeholder trong template: {{key}} → fieldValues[key], {{context.nodeId}} → context[nodeId].
 */
export function replacePlaceholders(
  template: string,
  fieldValues: FieldValues = {},
  context: NodeContext = {}
): string {
  if (!template || typeof template !== "string") return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_: string, key: string) => {
    const trimmed = key.trim();
    if (trimmed.startsWith("context.")) {
      const nodeKey = trimmed.slice("context.".length).trim();
      const value = context[nodeKey];
      return value === undefined ? "" : safeStringify(value);
    }
    const value = fieldValues[trimmed];
    return value === undefined ? "" : safeStringify(value);
  });
}

/**
 * Parse chuỗi sau replace thành object/string để gửi API (JSON nếu hợp lệ).
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
