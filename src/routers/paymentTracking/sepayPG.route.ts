import config from "config";
import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { MainConnection } from "../../helpers/mongo";
import {
  PaidOrderBySePayPGCommand,
  paidOrderBySePayPGUsecase,
} from "../../libs/usecases/order/paid/paidOrderBySePayPG.usecase";
import {
  SePayPGIPNPayload,
  SePayPGNotificationType,
} from "../../services/sepayPG/sepayPG.service";
/**
 * Lấy domain của frontend từ config (dùng để redirect sau thanh toán)
 */
const getFrontendDomain = (): string => {
  return config.get<string>("domain");
};

export default [
  /**
   * IPN Endpoint - Nhận thông báo giao dịch từ SePay PG
   * POST /api/payment/sepay-pg/ipn
   *
   * SePay PG sẽ gọi endpoint này sau mỗi giao dịch thành công/thất bại.
   * Endpoint phải trả về HTTP 200 để xác nhận đã nhận, tránh bị SePay retry.
   *
   * Bảo mật: Kiểm tra header X-Secret-Key khớp với secretKey đã cấu hình.
   */
  {
    method: "post",
    path: "/api/payment/sepay-pg/ipn",
    midd: [],
    action: async (req: Request, res: Response) => {
      logger.info("Nhận IPN từ SePay PG", { body: req.body });

      // ── 1. Xác thực X-Secret-Key ────────────────────────────────────────
      // Theo doc SePay: X-Secret-Key chỉ được gửi khi merchant cấu hình
      // auth type = SECRET_KEY tại: Cổng thanh toán → Cấu hình → IPN.
      // Key này (ipnSecretKey) độc lập với secretKey dùng để gọi API SePay PG (SDK).
      // → Chỉ validate khi SEPAY_PG_IPN_SECRET_KEY được cấu hình trong .env.
      const ipnSecretKey = config.get<string>("sepayPG.ipnSecretKey");

      if (ipnSecretKey) {
        const incomingKey = req.headers["x-secret-key"] as string;
        if (!incomingKey || incomingKey !== ipnSecretKey) {
          logger.warn("SePay PG IPN: X-Secret-Key không hợp lệ", { incomingKey });
          return res.status(200).json({ success: false, message: "Invalid secret key" });
        }
      }

      const payload = req.body as SePayPGIPNPayload;

      // ── 2. Validate các trường bắt buộc theo IPN spec ───────────────────
      if (!payload.timestamp) {
        logger.warn("SePay PG IPN: Thiếu timestamp");
        return res.status(200).json({ success: false, message: "Missing timestamp" });
      }

      const VALID_NOTIFICATION_TYPES = Object.values(SePayPGNotificationType);
      if (!payload.notification_type || !VALID_NOTIFICATION_TYPES.includes(payload.notification_type)) {
        logger.warn("SePay PG IPN: notification_type không hợp lệ", {
          notification_type: payload.notification_type,
        });
        return res.status(200).json({ success: false, message: "Invalid notification_type" });
      }

      if (!payload.order || !payload.order.order_invoice_number) {
        logger.warn("SePay PG IPN: Thiếu order.order_invoice_number");
        return res.status(200).json({ success: false, message: "Missing order_invoice_number" });
      }

      if (!payload.transaction || !payload.transaction.transaction_id) {
        logger.warn("SePay PG IPN: Thiếu transaction.transaction_id");
        return res.status(200).json({ success: false, message: "Missing transaction_id" });
      }

      // ── 3. Lưu raw payload để audit / debug ─────────────────────────────
      await MainConnection.collection("sepay_pg_webhook_logs").insertOne({
        ...req.body,
        receivedAt: new Date(),
        ipAddress: req.ip,
      });

      logger.info("SePay PG IPN: Bắt đầu xử lý", {
        notification_type: payload.notification_type,
        order_invoice_number: payload.order.order_invoice_number,
        transaction_id: payload.transaction.transaction_id,
      });

      // ── 4. Xử lý nghiệp vụ ──────────────────────────────────────────────
      try {
        await paidOrderBySePayPGUsecase
          .execute(
            PaidOrderBySePayPGCommand.create({
              timestamp: payload.timestamp,
              notification_type: payload.notification_type,
              order: payload.order,
              transaction: payload.transaction,
              customer: payload.customer,
            })
          )
          .catch((err) => {
            logger.error("Xử lý IPN SePay PG thất bại", {
              err: err.message,
              notification_type: payload.notification_type,
              orderInvoiceNumber: payload.order?.order_invoice_number,
              transactionId: payload.transaction?.transaction_id,
            });
          });

        return res.status(200).json({ success: true });
      } catch (err) {
        logger.error("Lỗi nghiêm trọng khi xử lý IPN SePay PG", { err });
        return res.status(200).json({ success: false });
      }
    },
  },

  /**
   * Callback thành công - SePay redirect sau khi thanh toán thành công
   * GET /api/payment/sepay-pg/success/:orderNumber
   * GET /api/payment/sepay-pg/success  (fallback dùng query param)
   *
   * Redirect khách hàng về trang checkout của frontend kèm thông tin kết quả
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/success/:orderNumber?",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const orderNumber = (req.params.orderNumber || req.query.order_invoice_number || "") as string;

      logger.info("SePay PG: Thanh toán thành công", { orderNumber, query: req.query });

      const redirectUrl = `${domain}/checkout?payment=success&orderNumber=${orderNumber}`;
      return res.redirect(redirectUrl);
    },
  },

  /**
   * Callback lỗi - SePay redirect khi thanh toán thất bại
   * GET /api/payment/sepay-pg/error/:orderNumber
   * GET /api/payment/sepay-pg/error  (fallback dùng query param)
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/error/:orderNumber?",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const orderNumber = (req.params.orderNumber || req.query.order_invoice_number || "") as string;

      logger.info("SePay PG: Thanh toán thất bại", { orderNumber, query: req.query });

      const redirectUrl = `${domain}/checkout?payment=error&orderNumber=${orderNumber}`;
      return res.redirect(redirectUrl);
    },
  },

  /**
   * Callback hủy - SePay redirect khi khách hàng hủy hoặc nhấn Trở về
   * GET /api/payment/sepay-pg/cancel/:orderNumber
   * GET /api/payment/sepay-pg/cancel  (fallback dùng query param)
   *
   * Chỉ redirect về frontend để hiển thị UI — không cập nhật DB.
   * Trạng thái đơn hàng do IPN quyết định, không phải redirect URL.
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/cancel/:orderNumber?",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const orderNumber = (req.params.orderNumber || req.query.order_invoice_number || "") as string;

      logger.info("SePay PG: Khách hàng hủy hoặc nhấn Trở về từ cổng thanh toán", { orderNumber, query: req.query });

      const redirectUrl = `${domain}/checkout?payment=cancel&orderNumber=${orderNumber}`;
      return res.redirect(redirectUrl);
    },
  },
];
