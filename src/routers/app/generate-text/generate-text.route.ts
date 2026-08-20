/**
 * Proxy Flow2 gen_text — API key chỉ nằm server-side.
 *
 * POST   /api/app/generate-text/        tạo request (poll nội bộ đến done)
 * GET    /api/app/generate-text/:id/    poll status
 * DELETE /api/app/generate-text/:id/    hủy khi queued/running
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  cancelFlow2TextRequest,
  createFlow2TextRequest,
  DEFAULT_FLOW2_TEXT_MODEL,
  DEFAULT_FLOW2_THINKING_LEVEL,
  generateTextWithFlow2,
  getFlow2TextRequestStatus,
  MAX_FLOW2_TEXT_IMAGES,
  sanitizeFlow2TextStatus,
  serializeFlow2TextClientResult,
  type Flow2ImageInput,
} from "../../api-media/flow2";
import { checkRequestLimit, incrementRequestCount } from "../affiliate-scene/_shared";

const MAX_PROMPT_CHARS = 80_000;
const MAX_SYSTEM_INSTRUCTION_CHARS = 20_000;

type GenerateTextBody = {
  prompt?: string;
  systemInstruction?: string;
  system_instruction?: string;
  model?: string;
  thinkingLevel?: string;
  thinking_level?: string;
  images?: Flow2ImageInput[];
  image_base64s?: Flow2ImageInput[];
  /** Bật JSON output mode (json: true + response_mime_type: application/json) */
  jsonMode?: boolean;
  json?: boolean;
  /** Schema JSON enforce output structure */
  jsonSchema?: Record<string, unknown>;
  schema?: Record<string, unknown>;
  /** true = trả requestId ngay, client tự poll GET */
  async?: boolean;
};

function sendRouteError(res: Response, err: any) {
  const status = err?.statusCode || 500;
  res.status(status).json({ message: err?.message || "Lỗi server" });
}

function asTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

function collectImageInputs(body: GenerateTextBody): Flow2ImageInput[] {
  const raw = Array.isArray(body.images)
    ? body.images
    : Array.isArray(body.image_base64s)
    ? body.image_base64s
    : [];
  return raw.filter(Boolean).slice(0, MAX_FLOW2_TEXT_IMAGES);
}

function parseGenerateTextParams(body: GenerateTextBody) {
  const prompt = asTrimmed(body.prompt).slice(0, MAX_PROMPT_CHARS);
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt"), { statusCode: 400 });
  }

  const systemInstruction = asTrimmed(body.systemInstruction || body.system_instruction).slice(
    0,
    MAX_SYSTEM_INSTRUCTION_CHARS
  );

  const rawSchema = body.jsonSchema ?? body.schema;
  const jsonSchema =
    rawSchema && typeof rawSchema === "object" && !Array.isArray(rawSchema)
      ? (rawSchema as Record<string, unknown>)
      : undefined;
  const jsonMode = body.jsonMode === true || body.json === true || jsonSchema != null;

  return {
    prompt,
    systemInstruction: systemInstruction || undefined,
    model: asTrimmed(body.model) || DEFAULT_FLOW2_TEXT_MODEL,
    thinkingLevel: asTrimmed(body.thinkingLevel || body.thinking_level) || DEFAULT_FLOW2_THINKING_LEVEL,
    imageInputs: collectImageInputs(body),
    jsonMode: jsonMode || undefined,
    jsonSchema: jsonSchema || undefined,
  };
}

export default [
  {
    method: "post",
    path: "/api/app/generate-text/",
    midd: [],
    action: async (req: Request, res: Response) => {
      let requestId = "";
      const onClose = () => {
        if (!requestId) return;
        void cancelFlow2TextRequest(requestId, contextId).catch(() => undefined as void);
      };
      let contextId = "";

      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        contextId = context.id;

        const body = (req.body || {}) as GenerateTextBody;
        const params = parseGenerateTextParams(body);
        await checkRequestLimit(context.id);

        const flow2Params = {
          ...params,
          customerId: context.id,
          onRequestCreated: async (id: string) => {
            requestId = id;
          },
        };

        if (body.async === true) {
          const created = await createFlow2TextRequest(flow2Params);
          requestId = created.requestId;
          await incrementRequestCount(context.id);
          return res.status(202).json({
            success: true,
            requestId: created.requestId,
            status: "queued",
            type: "gen_text",
            message: "Đã tạo request. Poll GET /api/app/generate-text/:id/ đến khi status=done.",
          });
        }

        req.on("close", onClose);
        const { requestId: createdId, result } = await generateTextWithFlow2(flow2Params);
        requestId = createdId;
        req.off("close", onClose);

        await incrementRequestCount(context.id);
        res.json({
          success: true,
          requestId: createdId,
          status: "done",
          type: "gen_text",
          data: serializeFlow2TextClientResult(result),
        });
      } catch (err: any) {
        req.off("close", onClose);
        logger.error(`[generate-text] Lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/generate-text/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const id = asTrimmed(req.params.id);
        if (!id) return res.status(400).json({ message: "Thiếu request id" });

        const statusData = await getFlow2TextRequestStatus(id, context.id);
        res.json({ success: true, data: sanitizeFlow2TextStatus(statusData) });
      } catch (err: any) {
        logger.error(`[generate-text] Poll lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "delete",
    path: "/api/app/generate-text/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const id = asTrimmed(req.params.id);
        if (!id) return res.status(400).json({ message: "Thiếu request id" });

        const cancelled = await cancelFlow2TextRequest(id, context.id);
        res.json({
          success: true,
          cancelled,
          message: cancelled
            ? "Đã gửi yêu cầu hủy task"
            : "Không hủy được (task có thể đã xong hoặc không còn queued/running)",
        });
      } catch (err: any) {
        logger.error(`[generate-text] Hủy lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
];
