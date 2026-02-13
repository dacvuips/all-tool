import config from "config";
import { Request, Response } from "express";
import { t } from "../../helpers/functions/string";
import logger from "../../helpers/logger";
import { MainConnection } from "../../helpers/mongo";
import { ForbiddenError } from "../../libs/core";
// import { PaidOrderByCassoCommand, paidOrderByCassoUsecase } from "../../libs/usecases";
import {
  PaidOrderByCassoCommand,
  paidOrderByCassoUsecase,
} from "../../libs/usecases/order/paid/paidOrderByCasso.usecase";
import { OrderCode } from "../../packages/order-code";
export default [
  {
    method: "post",
    path: "/api/paymentTracking/casso",
    midd: [],
    action: async (req: Request, res: Response) => {
      // Kiểm tra header có chưa secret token không
      const secretToken = req.headers["secure-token"];
      if (!secretToken) throw new ForbiddenError(t("Không có secret token"));

      // Check secret is valid
      if (secretToken !== config.get<string>("casso.secret"))
        throw new ForbiddenError(t("Secret token không hợp lệ"));

      await MainConnection.collection("casso_webhook_logs").insertOne(req.body);

      res.sendStatus(200);

      try {
        for (const transcation of req.body.data) {
          let {
            id, // 6785,        //mã định danh duy nhất của giao dịch (Casso quy định)
            tid, // "BANK_REF_ID", //Mã giao dịch từ phía ngân hàng
            description, // "giao dich thu nghiem", // nội dung giao dịch
            amount, // 79000, // số tiền giao dịch
            cusum_balance, // 20079000,  // số tiền còn lại sau giao dịch
            when, // "2020-10-14 00:34:57",    // thời gian ghi có giao dịch ở ngân hàng
            bank_sub_acc_id, // "123456789",   // Mã tài khoản ngân hàng mà giao dịch thuộc về
            corresponsiveName,
            corresponsiveAccount,
            corresponsiveBankId,
            corresponsiveBankName,
            bankName,
            subAccId,
          } = transcation;

          amount = Number(amount);
          logger.info(`Ghi nhận chuyển khoản`, { transcation });

          // find transaction type by description
          const orderCode = OrderCode.getOrderCodeFromText(description);
          if (orderCode) {
            await paidOrderByCassoUsecase
              .execute(
                PaidOrderByCassoCommand.create({
                  cassoId: id,
                  bankId: bank_sub_acc_id,
                  bankTransId: tid,
                  amount: Number(amount),
                  description: description,
                  corresponsiveName: corresponsiveName,
                  corresponsiveAccount: corresponsiveAccount,
                  corresponsiveBankId: corresponsiveBankId,
                  corresponsiveBankName: corresponsiveBankName,
                  bankName: bankName,
                  subAccId: subAccId,
                })
              )
              .catch((err) => {
                logger.error(`Ghi nhận chuyển khoản thất bại`, { err, transcation });
              });
            return;
          }
        }
      } catch (err) {
        console.log(err);
        logger.error("Lỗi xử lý webhook casso", { err, body: req.body });
        // status request lỗi 500
        res.sendStatus(500);
      }
    },
  },
];
