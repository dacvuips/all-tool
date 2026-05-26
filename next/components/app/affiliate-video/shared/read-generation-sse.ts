export type GenerationSSEHandlers = {
  onProgress?: (progress: number, message?: string) => void;
  onError?: (message: string) => void;
};

export function extractGeneratedImages(result: unknown): unknown[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  const wrapped = result as { data?: unknown[]; success?: boolean };
  if (Array.isArray(wrapped.data)) return wrapped.data;
  return [];
}

/**
 * Đọc response JSON hoặc SSE (generation-image / generation-video).
 * SSE: events progress | done | error — trả về payload của event `done`.
 */
export async function consumeGenerationResponse(
  res: Response,
  handlers?: GenerationSSEHandlers
): Promise<unknown> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      res.status === 504
        ? "Gateway timeout — server chưa phản hồi kịp. Vui lòng thử lại sau vài phút."
        : (err as { message?: string })?.message || `Lỗi ${res.status}`;
    handlers?.onError?.(message);
    throw new Error(message);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("event-stream")) {
    return res.json();
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("Không thể đọc response stream");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: unknown;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6)) as {
          type?: string;
          progress?: number;
          message?: string;
          data?: unknown;
        };

        if (event.type === "progress") {
          if (typeof event.progress === "number") {
            handlers?.onProgress?.(event.progress, event.message);
          } else if (event.message) {
            handlers?.onProgress?.(0, event.message);
          }
        } else if (event.type === "done") {
          donePayload = event.data;
        } else if (event.type === "error") {
          const message = event.message || "Lỗi";
          handlers?.onError?.(message);
          throw new Error(message);
        }
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== "Lỗi") {
          if (parseErr.message.startsWith("Gateway timeout")) throw parseErr;
          if (parseErr.message.startsWith("Không thể")) throw parseErr;
          if (parseErr.message.startsWith("Lỗi")) throw parseErr;
        }
      }
    }
  }

  return donePayload;
}
