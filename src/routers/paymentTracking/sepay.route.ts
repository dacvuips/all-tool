import config from "config";
import { Request, Response } from "express";
import { t } from "../../helpers/functions/string";
import logger from "../../helpers/logger";
import { MainConnection } from "../../helpers/mongo";
import { ForbiddenError } from "../../libs/core";
import {
  PaidOrderBySepayCommand,
  paidOrderBySepayUsecase,
} from "../../libs/usecases/order/paid/paidOrderBySepay.usecase";
import { OrderCode } from "../../packages/order-code";
export default [
  {
    method: "post",
    path: "/api/paymentTracking/sepay",
    midd: [],
    action: async (req: Request, res: Response) => {
      // Kiểm tra header Authorization
      logger.info(`Ghi nhận chuyển khoản từ SePay`, { transaction: req.body });

      const authorization = req.headers["authorization"];

      if (!authorization) throw new ForbiddenError(t("Không có Authorization header"));

      // Check authorization is valid (format: "SECRET")
      const sepayApiKey = config.get<string>("sepay.secret");
      const expectedAuth = `Apikey ${sepayApiKey}`;

      if (authorization !== expectedAuth) throw new ForbiddenError(t("Authorization không hợp lệ"));

      try {
        // Log webhook vào database
        await MainConnection.collection("sepay_webhook_logs").insertOne(req.body);

        const {
          id, // ID giao dịch trên SePay
          gateway, // Brand name của ngân hàng
          transactionDate, // Thời gian xảy ra giao dịch phía ngân hàng
          accountNumber, // Số tài khoản ngân hàng
          code, // Mã code thanh toán
          content, // Nội dung chuyển khoản
          transferType, // Loại giao dịch (in/out)
          transferAmount, // Số tiền giao dịch
          accumulated, // Số dư tài khoản (lũy kế)
          subAccount, // Tài khoản ngân hàng phụ
          referenceCode, // Mã tham chiếu của tin nhắn SMS
          description, // Toàn bộ nội dung tin nhắn SMS
        } = req.body;

        logger.info(`Xử lý giao dịch SePay`, { transaction: req.body });

        // Tìm mã đơn hàng từ nội dung chuyển khoản
        const orderCode = OrderCode.getOrderCodeFromText(content);
        if (orderCode) {
          await paidOrderBySepayUsecase
            .execute(
              PaidOrderBySepayCommand.create({
                id,
                gateway,
                transactionDate,
                accountNumber,
                code,
                content,
                transferType,
                transferAmount: Number(transferAmount),
                accumulated,
                subAccount,
                referenceCode,
                description,
              })
            )
            .catch((err) => {
              logger.error(`Ghi nhận chuyển khoản thất bại`, { err, transaction: req.body });
            });
        }

        // Luôn trả về 200 OK để Sepay không retry

        res.sendStatus(200);
      } catch (err) {
        console.log(err);
        logger.error("Lỗi xử lý webhook SePay", { err, body: req.body });
        res.sendStatus(500);
      }
    },
  },
];
