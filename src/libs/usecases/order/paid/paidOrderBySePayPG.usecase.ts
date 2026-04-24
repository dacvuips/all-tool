import { IsNotEmpty } from "class-validator";
import crypto from "crypto";
import { CONSTANTS } from "../../../../constants/constant.const";
import { increaseCustomerTryOnLimit } from "../../../../graphql/modules/guest/guest.helper";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { OrderChangeEventEnum } from "../../../../graphql/modules/order/orderChangeStream.graphql";
import { t } from "../../../../helpers/functions/string";
import logger from "../../../../helpers/logger";
import { MainConnection } from "../../../../helpers/mongo";
import {
  SePayPGIPNPayload,
  SePayPGNotificationType,
  SePayPGOrderStatus,
} from "../../../../services/sepayPG/sepayPG.service";
import { BaseCommand, BaseUsecase } from "../../../core";
import { ForbiddenError } from "../../../core/errors";
import { CustomerModel, SubscriptionPlanEnum } from "../../../dal/customer";
import { IntroduceModel } from "../../../dal/introduce";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { OrderStatusEnum, OrderTypeEnum, PaymentStatus } from "../../../dal/order/order.interface";
import { OrderModel } from "../../../dal/order/order.model";
import {
  PackageTransactionSnapshot,
  PackageTransactionTypeEnum,
} from "../../../dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../../dal/packageTransaction/package-transaction.model";
import { RecaptchaSubscriptionPlanEnum, recaptchaTokenService } from "../../../dal/recaptchaToken";
import {
  ApiMediaSubscriptionPlanEnum,
  apiMediaTokenService,
} from "../../../dal/apiMediaToken";
import { SettingModel } from "../../../dal/setting/setting.model";
import { walletService } from "../../../dal/wallet";
import { pubsub } from "../../../graphql/pub-sub";
import { GetWalletInfo } from "../../wallet";
import { WalletTransactionBuilder } from "../../wallet/wallet-transaction.builder";

/**
 * Command chứa payload IPN từ SePay PG
 */
export class PaidOrderBySePayPGCommand extends BaseCommand {
  @IsNotEmpty()
  timestamp: number; // Unix timestamp khi SePay gửi thông báo

  @IsNotEmpty()
  notification_type: SePayPGNotificationType;

  @IsNotEmpty()
  order: SePayPGIPNPayload["order"]; // Thông tin đơn hàng từ SePay

  @IsNotEmpty()
  transaction: SePayPGIPNPayload["transaction"]; // Thông tin giao dịch từ SePay

  customer: SePayPGIPNPayload["customer"]; // Thông tin khách hàng (có thể null)
}

type PaidOrderBySePayPGResponse = {
  success: boolean;
};

/**
 * UseCase xử lý IPN (Instant Payment Notification) từ SePay Payment Gateway.
 *
 * Hỗ trợ 2 loại thông báo:
 *  - ORDER_PAID       : Thanh toán thành công → cập nhật đơn + cộng credit
 *  - TRANSACTION_VOID : Huỷ giao dịch        → cập nhật đơn + thu hồi credit nếu đã cộng
 */
class PaidOrderBySePayPGUsecase extends BaseUsecase {
  async execute(command: PaidOrderBySePayPGCommand): Promise<PaidOrderBySePayPGResponse> {
    // ── Audit log ────────────────────────────────────────────────────────
    await MainConnection.collection("sepay_pg_transactions").insertOne({
      ...command,
      processedAt: new Date(),
    });

    const { notification_type } = command;

    if (notification_type === SePayPGNotificationType.ORDER_PAID) {
      return this._handleOrderPaid(command);
    }

    // Loại thông báo không xử lý → bỏ qua, trả về 200 để SePay không retry
    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ORDER_PAID: Thanh toán thành công
  // ─────────────────────────────────────────────────────────────────────────
  private async _handleOrderPaid(
    command: PaidOrderBySePayPGCommand
  ): Promise<PaidOrderBySePayPGResponse> {
    const { order_invoice_number, order_status } = command.order;
    const { transaction_id, transaction_amount, payment_method } = command.transaction;

    // Validate: SePay phải báo trạng thái CAPTURED
    if (order_status !== SePayPGOrderStatus.CAPTURED) {
      throw new ForbiddenError(
        t(`ORDER_PAID nhưng order_status không phải CAPTURED: ${order_status}`)
      );
    }

    // Tìm đơn hàng theo orderNumber (= order_invoice_number)
    const order = await OrderModel.findOne({ orderNumber: order_invoice_number }).orFail(
      new ForbiddenError(t(`Không tìm thấy đơn hàng với invoice number: ${order_invoice_number}`))
    );

    // Idempotency: đã thanh toán thành công trước đó → bỏ qua, không xử lý lại
    if (order.paymentStatus === PaymentStatus.PAYMENT_SUCCESS) {
      return { success: true };
    }

    // Validate: đơn phải đang ở trạng thái chờ thanh toán
    if (order.paymentStatus !== PaymentStatus.PAYMENT_PENDING) {
      throw new ForbiddenError(
        t(`Đơn hàng không ở trạng thái PAYMENT_PENDING (hiện tại: ${order.paymentStatus})`)
      );
    }

    // Validate: số tiền thanh toán phải >= tổng đơn hàng
    const sePayAmount = Number(transaction_amount);
    if (sePayAmount < order.totalAmount) {
      throw new ForbiddenError(
        t(`Số tiền thanh toán (${sePayAmount}) không đủ so với đơn hàng (${order.totalAmount})`)
      );
    }

    // ── Cập nhật đơn hàng: thanh toán thành công ─────────────────────────
    const orderUpdated = await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          status: OrderStatusEnum.PAYMENT_UPDATED,
          paymentStatus: PaymentStatus.PAYMENT_SUCCESS,
          paidAt: new Date(),
          "paymentInfo.metaData": {
            sePayOrderId: command.order.order_id,
            orderInvoiceNumber: order_invoice_number,
            orderStatus: order_status,
            transactionId: transaction_id,
            transactionDate: command.transaction.transaction_date,
            transactionStatus: command.transaction.transaction_status,
            transactionAmount: transaction_amount,
            paymentMethod: payment_method,
            cardNumber: command.transaction.card_number,
            cardHolderName: command.transaction.card_holder_name,
            cardBrand: command.transaction.card_brand,
            ipnTimestamp: command.timestamp,
          },
        },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PAYMENT_CONFIRMED,
            des: "Đơn hàng đã được thanh toán",
            createdAt: new Date(),
          } as any,
          paymentLogs: {
            status: PaymentStatus.PAYMENT_SUCCESS,
            des: `Thanh toán thành công - ${payment_method}`,
            amount: sePayAmount,
            transactionId: transaction_id,
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // Chuyển trạng thái đơn sang PROCESSING
    await OrderModel.findOneAndUpdate(
      { _id: order._id },
      {
        $set: { status: OrderStatusEnum.PROCESSING },
        $push: {
          orderLogs: {
            status: OrderStatusEnum.PROCESSING,
            des: "Đơn hàng đang được xử lý",
            createdAt: new Date(),
          } as any,
        },
      },
      { new: true }
    );

    // ── Kích hoạt gói subscription cho khách hàng ──────────────────────────
    const subscriptionPlan = (order as any).subscriptionPlan;
    const orderType = (order as any).type;

    if (order.customerId && subscriptionPlan) {
      if (orderType === OrderTypeEnum.RECAPTCHA) {
        // RECAPTCHA: Tạo recaptcha token key theo gói cụ thể
        await this._activateRecaptchaSubscription(
          order.customerId.toString(),
          subscriptionPlan,
          order._id.toString(),
          order.orderNumber
        );
      } else if (orderType === OrderTypeEnum.API_MEDIA) {
        // API_MEDIA: Tạo api media token key theo gói cụ thể
        await this._activateApiMediaSubscription(
          order.customerId.toString(),
          subscriptionPlan,
          order._id.toString(),
          order.orderNumber
        );
      } else {
        // TOOL (default): Cập nhật googlePackage cho Customer
        await this._activateSubscription(
          order.customerId.toString(),
          subscriptionPlan,
          order._id.toString(),
          order.orderNumber
        );
      }
    }

    // === Hoa hồng giới thiệu: cộng 10% giá đơn cho người giới thiệu ===
    if (!!order.customerId && order.totalAmount > 0) {
      try {
        // Tìm bản ghi giới thiệu: người nạp đơn là refereeId
        const introduce = await IntroduceModel.findOne({
          refereeId: order.customerId,
          blocked: false,
        });

        if (introduce) {
          const referralBonus = Math.round(order.totalAmount * 0.1); // 10%
          const referrerId = introduce.referrerId.toString();

          // Cộng wallet cho người giới thiệu
          const referrerWallet = await GetWalletInfo.usecase.execute({
            ownerId: referrerId,
          });
          const referralSession = await MainConnection.startSession();
          try {
            await referralSession.withTransaction(async () => {
              await walletService.createTransaction({
                transaction: new WalletTransactionBuilder(referrerWallet)
                  .introduceReward({
                    amount: referralBonus,
                    description: `Hoa hồng giới thiệu ${referralBonus} (10% đơn hàng ${order.orderNumber})`,
                    orderId: order._id.toString(),
                    orderCode: order.orderNumber,
                  })
                  .build(),
                session: referralSession,
              });
            });
          } finally {
            await referralSession.endSession();
          }

          // Thông báo cho người giới thiệu
          const referrerNotify = new NotificationBuilder(
            "Hoa hồng giới thiệu",
            `Bạn nhận được ${referralBonus} credit hoa hồng từ đơn hàng của người bạn giới thiệu`
          )
            .sendTo(NotificationTarget.CUSTOMER, referrerId)
            .build();
          InsertNotification([referrerNotify]);

          // Ghi thông tin đơn vào Introduce
          await IntroduceModel.findByIdAndUpdate(introduce._id, {
            $push: {
              orders: {
                orderId: order._id,
                discountPrice: referralBonus,
              },
            },
          });

          logger.info(`Đã cộng hoa hồng giới thiệu`, {
            referrerId,
            refereeId: order.customerId.toString(),
            orderId: order._id.toString(),
            referralBonus,
          });
        }
      } catch (err) {
        // Không để lỗi hoa hồng ảnh hưởng tới luồng thanh toán chính
        logger.error(`Lỗi khi xử lý hoa hồng giới thiệu`, {
          err,
          orderId: order._id.toString(),
          customerId: order.customerId.toString(),
        });
      }
    }
    // ── Thông báo & real-time event ───────────────────────────────────────
    if (order.customerId) {
      const customerNotify = new NotificationBuilder(
        "Thanh toán thành công",
        `Hệ thống đã nhận được thanh toán cho đơn hàng ${order.orderNumber}`
      )
        .sendTo(NotificationTarget.CUSTOMER, order.customerId.toString())
        .order(order._id.toString())
        .build();
      InsertNotification([customerNotify]);
      await increaseCustomerTryOnLimit(order.customerId.toString(), 15);
    }

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.ORDER, {
      event: OrderChangeEventEnum.PAYMENT_CHANGED,
      orderId: order._id,
      data: { paymentStatus: orderUpdated?.paymentStatus },
    });

    return { success: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TRANSACTION_VOID: Huỷ giao dịch
  // ─────────────────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Kích hoạt gói subscription cho khách hàng
  // ─────────────────────────────────────────────────────────────────────────

  /** Map SubscriptionPlanEnum → setting key prefix */
  private static PLAN_KEY_MAP: Record<string, string> = {
    [SubscriptionPlanEnum.TRIAL]: SubscriptionPlanEnum.TRIAL,
    [SubscriptionPlanEnum.BASIC]: SubscriptionPlanEnum.BASIC,
    [SubscriptionPlanEnum.STANDARD]: SubscriptionPlanEnum.STANDARD,
    [SubscriptionPlanEnum.PROFESSIONAL]: SubscriptionPlanEnum.PROFESSIONAL,
    [SubscriptionPlanEnum.UNLIMITED]: SubscriptionPlanEnum.UNLIMITED,
  };

  private async _activateSubscription(
    customerId: string,
    subscriptionPlan: string,
    orderId: string,
    orderNumber: string
  ): Promise<void> {
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      throw new ForbiddenError(t("Không tìm thấy khách hàng để kích hoạt gói"));
    }

    const pkg = (customer as any).googlePackage || {};

    // Snapshot BEFORE
    const beforeSnapshot: PackageTransactionSnapshot = {
      subscription: pkg.subscription,
      videoCount: pkg.videoCount,
      videoLimit: pkg.videoLimit,
      imageCount: pkg.imageCount,
      imageLimit: pkg.imageLimit,
      requestCount: pkg.requestCount,
      requestLimit: pkg.requestLimit,
      imageStreamCount: pkg.imageStreamCount,
      videoStreamCount: pkg.videoStreamCount,
      expiryPackageDate: pkg.expiryPackageDate,
    };

    // Lấy thông số gói từ Setting
    const planKey = PaidOrderBySePayPGUsecase.PLAN_KEY_MAP[subscriptionPlan];
    if (!planKey) {
      throw new ForbiddenError(t(`Gói subscription không hợp lệ: ${subscriptionPlan}`));
    }

    const prefix = `pk-${planKey}`;
    const settings = await SettingModel.find({
      key: { $regex: `^${prefix}-`, $options: "i" },
    }).lean();

    const getValue = (suffix: string): number => {
      const s = settings.find((x) => x.key === `${prefix}-${suffix}`);
      return s ? Number(s.value) : 0;
    };

    const packageConfig = {
      videoLimit: getValue("video-limit"),
      imageLimit: getValue("image-limit"),
      requestLimit: getValue("request-limit"),
      imageStreamCount: getValue("image-stream-count"),
      videoStreamCount: getValue("video-stream-count"),
    };

    // Tính expiryPackageDate
    const now = new Date();
    let expiryPackageDate: Date | null = null;
    if (subscriptionPlan === SubscriptionPlanEnum.TRIAL) {
      expiryPackageDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 giờ
    } else {
      const expiryDate = new Date(now);
      expiryDate.setMonth(expiryDate.getMonth() + 1); // 1 tháng
      expiryPackageDate = expiryDate;
    }

    // Cập nhật googlePackage
    const updatedCustomer = await CustomerModel.findByIdAndUpdate(
      customerId,
      {
        $set: {
          "googlePackage.subscription": subscriptionPlan,
          "googlePackage.videoLimit": packageConfig.videoLimit,
          "googlePackage.imageLimit": packageConfig.imageLimit,
          "googlePackage.requestLimit": packageConfig.requestLimit,
          "googlePackage.imageStreamCount": packageConfig.imageStreamCount,
          "googlePackage.videoStreamCount": packageConfig.videoStreamCount,
          "googlePackage.videoCount": 0,
          "googlePackage.imageCount": 0,
          "googlePackage.requestCount": 0,
          "googlePackage.expiryPackageDate": expiryPackageDate,
        },
      },
      { new: true }
    );

    const updatedPkg = (updatedCustomer as any)?.googlePackage || {};

    // Snapshot AFTER
    const afterSnapshot: PackageTransactionSnapshot = {
      subscription: updatedPkg.subscription,
      videoCount: updatedPkg.videoCount,
      videoLimit: updatedPkg.videoLimit,
      imageCount: updatedPkg.imageCount,
      imageLimit: updatedPkg.imageLimit,
      requestCount: updatedPkg.requestCount,
      requestLimit: updatedPkg.requestLimit,
      imageStreamCount: updatedPkg.imageStreamCount,
      videoStreamCount: updatedPkg.videoStreamCount,
      expiryPackageDate: updatedPkg.expiryPackageDate,
    };

    // Ghi log PackageTransaction
    await PackageTransactionModel.create({
      customerId,
      customerCode: (customer as any).code,
      type: PackageTransactionTypeEnum.PAYMENT,
      before: beforeSnapshot,
      after: afterSnapshot,
      description: `Kích hoạt gói ${subscriptionPlan} từ đơn hàng thanh toán`,
    });

    // Thông báo cho customer
    const notify = new NotificationBuilder(
      `Gói ${subscriptionPlan} đã được kích hoạt`,
      `Gói ${subscriptionPlan} đã được kích hoạt thành công.\nVideo: ${afterSnapshot.videoLimit}/ngày, Ảnh: ${afterSnapshot.imageLimit}/ngày.`
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .build();
    InsertNotification([notify]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Kích hoạt gói reCAPTCHA cho khách hàng
  // ─────────────────────────────────────────────────────────────────────────
  private async _activateRecaptchaSubscription(
    customerId: string,
    subscriptionPlan: string,
    orderId: string,
    orderNumber: string
  ): Promise<void> {
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      throw new ForbiddenError(t("Không tìm thấy khách hàng để kích hoạt gói"));
    }

    // Map subscriptionPlan → RecaptchaSubscriptionPlanEnum value (lowercase)
    const planKey = subscriptionPlan.toLowerCase();

    // Lấy số lượng request từ setting theo gói cụ thể (rpk-{plan}-request-quantity)
    const requestQuantitySetting = await SettingModel.findOne({
      key: `rpk-${planKey}-request-quantity`,
    }).lean();
    const requestQuantity = requestQuantitySetting?.value ?? 1000;

    // Generate a unique key
    const key = crypto.randomBytes(32).toString("hex");
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30); // 30 ngày

    // Tạo recaptcha token mới
    await recaptchaTokenService.create({
      key,
      requestQuantity: Number(requestQuantity),
      expiredDate,
      customerId,
      active: true,
      usedQuantity: 0,
      subscriptionPlan: planKey as RecaptchaSubscriptionPlanEnum,
    });

    // Thông báo cho customer
    const notify = new NotificationBuilder(
      `Gói reCAPTCHA ${subscriptionPlan} đã được kích hoạt`,
      `Gói reCAPTCHA ${subscriptionPlan} đã được kích hoạt thành công.\nSố lượng request: ${requestQuantity}. Hết hạn: ${expiredDate.toLocaleDateString(
        "vi-VN"
      )}.`
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .order(orderId)
      .build();
    InsertNotification([notify]);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: Kích hoạt gói API Media cho khách hàng
  // ─────────────────────────────────────────────────────────────────────────
  private async _activateApiMediaSubscription(
    customerId: string,
    subscriptionPlan: string,
    orderId: string,
    orderNumber: string
  ): Promise<void> {
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      throw new ForbiddenError(t("Không tìm thấy khách hàng để kích hoạt gói"));
    }

    // Map subscriptionPlan → ApiMediaSubscriptionPlanEnum value (lowercase)
    const planKey = subscriptionPlan.toLowerCase();

    // Lấy số lượng request từ setting theo gói cụ thể (ampk-{plan}-request-quantity)
    const requestQuantitySetting = await SettingModel.findOne({
      key: `ampk-${planKey}-request-quantity`,
    }).lean();
    const requestQuantity = requestQuantitySetting?.value ?? 1000;

    // Generate a unique key
    const key = crypto.randomBytes(32).toString("hex");
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + 30); // 30 ngày

    // Tạo api media token mới
    await apiMediaTokenService.create({
      key,
      requestQuantity: Number(requestQuantity),
      expiredDate,
      customerId,
      active: true,
      usedQuantity: 0,
      subscriptionPlan: planKey as ApiMediaSubscriptionPlanEnum,
    });

    // Thông báo cho customer
    const notify = new NotificationBuilder(
      `Gói API Media ${subscriptionPlan} đã được kích hoạt`,
      `Gói API Media ${subscriptionPlan} đã được kích hoạt thành công.\nSố lượng lượt tạo: ${requestQuantity}. Hết hạn: ${expiredDate.toLocaleDateString(
        "vi-VN"
      )}.`
    )
      .sendTo(NotificationTarget.CUSTOMER, customerId)
      .order(orderId)
      .build();
    InsertNotification([notify]);
  }
}

export const paidOrderBySePayPGUsecase = new PaidOrderBySePayPGUsecase();
