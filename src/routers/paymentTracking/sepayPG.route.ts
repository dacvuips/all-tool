import config from "config";
import { Request, Response } from "express";
import logger from "../../helpers/logger";
import { MainConnection } from "../../helpers/mongo";
import { ForbiddenError } from "../../libs/core";
import { t } from "../../helpers/functions/string";
import {
  PaidOrderBySePayPGCommand,
  paidOrderBySePayPGUsecase,
} from "../../libs/usecases/order/paid/paidOrderBySePayPG.usecase";
import { SePayPGIPNPayload } from "../../services/sepayPG/sepayPG.service";

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

      // Xác thực bằng X-Secret-Key header
      const secretKey = req.headers["x-secret-key"] as string;
      const expectedSecretKey = config.get<string>("sepayPG.secretKey");

      if (!secretKey || secretKey !== expectedSecretKey) {
        logger.warn("SePay PG IPN: X-Secret-Key không hợp lệ", { secretKey });
        // Vẫn trả về 200 để SePay không retry, nhưng không xử lý
        return res.status(200).json({ success: false, message: "Invalid secret key" });
      }

      // Lưu raw payload để audit và debug
      await MainConnection.collection("sepay_pg_webhook_logs").insertOne({
        ...req.body,
        receivedAt: new Date(),
        ipAddress: req.ip,
      });

      const payload = req.body as SePayPGIPNPayload;

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
              orderInvoiceNumber: payload.order?.order_invoice_number,
            });
          });

        // Luôn trả về 200 để SePay không retry
        return res.status(200).json({ success: true });
      } catch (err) {
        logger.error("Lỗi nghiêm trọng khi xử lý IPN SePay PG", { err });
        return res.status(200).json({ success: false });
      }
    },
  },

  /**
   * Callback thành công - SePay redirect sau khi thanh toán thành công
   * GET /api/payment/sepay-pg/success
   *
   * Redirect khách hàng về trang checkout của frontend kèm thông tin kết quả
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/success",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const { order_invoice_number } = req.query;

      logger.info("SePay PG: Thanh toán thành công", { order_invoice_number });

      // Redirect về checkout page kèm thông tin payment=success
      const redirectUrl = `${domain}/checkout?payment=success&orderNumber=${order_invoice_number || ""}`;
      return res.redirect(redirectUrl);
    },
  },

  /**
   * Callback lỗi - SePay redirect khi thanh toán thất bại
   * GET /api/payment/sepay-pg/error
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/error",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const { order_invoice_number } = req.query;

      logger.info("SePay PG: Thanh toán thất bại", { order_invoice_number, query: req.query });

      const redirectUrl = `${domain}/checkout?payment=error&orderNumber=${order_invoice_number || ""}`;
      return res.redirect(redirectUrl);
    },
  },

  /**
   * Callback hủy - SePay redirect khi khách hàng hủy thanh toán
   * GET /api/payment/sepay-pg/cancel
   */
  {
    method: "get",
    path: "/api/payment/sepay-pg/cancel",
    midd: [],
    action: (req: Request, res: Response) => {
      const domain = getFrontendDomain();
      const { order_invoice_number } = req.query;

      logger.info("SePay PG: Khách hàng hủy thanh toán", { order_invoice_number });

      const redirectUrl = `${domain}/checkout?payment=cancel&orderNumber=${order_invoice_number || ""}`;
      return res.redirect(redirectUrl);
    },
  },
];
