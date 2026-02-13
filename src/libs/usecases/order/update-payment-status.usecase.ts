import { IsNotEmpty, IsOptional, IsString } from "class-validator";
 
import { t } from "../../../helpers/functions/string";
import { BaseCommand, BaseUsecase } from "../../core";
import { OrderStatusEnum, PaymentStatus } from "../../dal/order/order.interface";
import { OrderModel } from "../../dal/order/order.model";

 

/**
 * Usecase: Cập nhật trạng thái thanh toán
 */
export namespace UpdatePaymentStatus {
  /**
   * Command input cho usecase
   */
  export class Command extends BaseCommand {
    @IsNotEmpty({ message: t("orderId không được để trống") })
    @IsString({ message: t("orderId phải là string") })
    orderId: string;

    @IsNotEmpty({ message: t("status không được để trống") })
    @IsString({ message: t("status phải là string") })
    status: PaymentStatus;

    @IsOptional()
    @IsString({ message: t("reason phải là string") })
    reason?: string;

    @IsOptional()
    creatorId?: string;
  }

  /**
   * Usecase implementation
   */
  class UpdatePaymentStatusUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { orderId, status, reason, creatorId } = cmd;

      if (!Object.values(PaymentStatus).includes(status)) {
        throw new Error(t("Trạng thái thanh toán không hợp lệ"));
      }

      const order = await OrderModel.findById(orderId);
      if (!order) {
        throw new Error(t("Đơn hàng không tìm thấy"));
      }

      const updateData: any = {status:OrderStatusEnum.PAYMENT_UPDATED, paymentStatus: status };
      const baseDes = t("Cập nhật trạng thái thanh toán");
      const baseNote = reason;

      let paymentLogEntry: any = {
        status: status,
        des: baseDes,
        note: baseNote,
        createdAt: new Date(),
        creatorId: creatorId,
      };

      let orderLogEntry: any = {
        status: OrderStatusEnum.PAYMENT_UPDATED,
        des: baseDes,
        note: baseNote,
        createdAt: new Date(),
        creatorId: creatorId,
      };

      switch (status) {
        case PaymentStatus.PAYMENT_PENDING:
          paymentLogEntry.des = t("Đơn hàng đang chờ thanh toán");
          orderLogEntry.des = t("Cập nhật trạng thái thanh toán về chờ xử lý");
          updateData.status = OrderStatusEnum.CREATED;
          break;
        case PaymentStatus.PAYMENT_SUCCESS:
          paymentLogEntry.des = t("Thanh toán thành công");
          orderLogEntry.des = t("Đơn hàng đã được thanh toán");
          updateData.status = OrderStatusEnum.PAYMENT_CONFIRMED;
          break;
        case PaymentStatus.PAYMENT_FAILED:
          paymentLogEntry.des = t("Thanh toán thất bại");
          orderLogEntry.des = t("Giao dịch thanh toán không thành công");
          updateData.status = OrderStatusEnum.CANCELLED;
          break;
        case PaymentStatus.PAYMENT_TIMEOUT:
          paymentLogEntry.des = t("Thanh toán hết hạn");
          orderLogEntry.des = t("Giao dịch thanh toán hết hạn");
          updateData.status = OrderStatusEnum.CANCELLED;
          break;
  
        default:
          break;
      }

      // Nếu thanh toán thành công, cập nhật ngày thanh toán và trạng thái đơn hàng nếu cần
      if (status === PaymentStatus.PAYMENT_SUCCESS && order.paymentStatus !== PaymentStatus.PAYMENT_SUCCESS) {
        updateData.paidAt = new Date();
      }

      await OrderModel.findByIdAndUpdate(
        orderId,
        {
          ...updateData,
          $push: { paymentLogs: paymentLogEntry, orderLogs: orderLogEntry }, // Lưu vào paymentLogs
        },
        { new: true }
      );

      return await OrderModel.findById(orderId);
    }
  }

  export const usecase = new UpdatePaymentStatusUsecase();
}
