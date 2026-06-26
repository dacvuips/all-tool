import config from "config";
import { set } from "lodash";
import moment from "moment-timezone";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { BankModel, PaymentMethodEnum } from "../../../libs/dal/bank";
import { SubscriptionPlanEnum } from "../../../libs/dal/customer";
import {
  OrderStatusEnum,
  OrderTypeEnum,
  PaymentStatus,
} from "../../../libs/dal/order/order.interface";
import orderService from "../../../libs/dal/order/order.service";
import { settingService } from "../../../libs/dal/setting";
import { Context } from "../../../libs/graphql";
import { ObjectId } from "../../../packages/object-id";
import ProcessExpiredOrderJob from "../../../scheduler/jobs/processExpiredOrder.job";
import { sePayPGService } from "../../../services/sepayPG/sepayPG.service";

const Query = {
  getAllOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
    return orderService.fetch(args.q);
  },
  getOneOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-20-1"]]);
    const { id } = args;
    const order = await orderService.findOne({ _id: id });

    if (!order) {
      throw new Error("Order not found");
    }

    // Check permission
    if (context.isCustomer && order.customerId?.toString() !== context.customerId) {
      throw new Error("Unauthorized");
    } else if (!context.isCustomer && !context.isAdmin && !context.isStaff) {
      throw new Error("Unauthorized");
    }

    return order;
  },
  getOrderByNumber: async (root: any, args: any, context: Context) => {
    const { orderNumber } = args;
    const order = await orderService.getOrderByNumber(orderNumber);

    if (!order) {
      throw new Error("Order not found");
    }

    // Check permission
    if (context.isCustomer && order.customerId?.toString() !== context.customerId) {
      throw new Error("Unauthorized");
    } else if (!context.isCustomer && !context.isAdmin && !context.isStaff) {
      throw new Error("Unauthorized");
    }

    return order;
  },
  getMyOrders: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const { limit = 20 } = args;
    return orderService.getCustomerOrders(context.customerId, limit);
  },
  getMyOrderStats: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    return orderService.getOrderStats(context.customerId);
  },
  getOneOrderByGuest: async (root: any, args: any, context: Context) => {
    const result = await orderService.findPendingOrder(context.customerId);
    return result?.order ?? null;
  },
  getPendingNormalOrder: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    return orderService.findPendingNormalOrder(context.customerId);
  },
  // Lấy danh sách đơn hàng của khách vãng lai với param lọc theo shippingAddress phone, email.
  getOrdersByGuest: async (root: any, args: any, context: Context) => {
    const sessionId = context.req.cookies?.cartSessionId || null;
    const customerId = context.customerId || null;
    if (context.isCustomer) {
      set(args, "q.filter.customerId", customerId);
    } else {
      set(args, "q.filter.sessionId", sessionId);
    }

    return await orderService.fetch(args.q);
  },
};

const Mutation = {
  createOrder: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.customerId;
    const { creditAmount } = args;

    if (!creditAmount || creditAmount <= 0) {
      throw new Error("Số tiền credit không hợp lệ");
    }

    const defaultBank = await BankModel.findOne({ status: true });
    if (!defaultBank) {
      throw new Error("Hệ thống không tìm thấy ngân hàng");
    }

    const creditAmountSetting = await settingService.findOne({
      key: "wa-mpoint-change-credit-balance",
    });
    const totalAmount = creditAmountSetting.value * creditAmount;
    const paymentInfo = {
      method: defaultBank.method || PaymentMethodEnum.BANK,
      bankImage: defaultBank.bankImage || "",
      bankCode: defaultBank.bankCode || "",
      bankName: defaultBank.bankName || "",
      accountNumber: defaultBank.accountNumber || "",
      accountName: defaultBank.accountName || "",
      bin: defaultBank.bin || "",
    };

    const order = await orderService.create({
      customerId: ObjectId(customerId),
      paymentMethod: paymentInfo.method,
      paymentInfo,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      status: OrderStatusEnum.CREATED,
      totalAmount,
      creditAmount,
      orderLogs: [
        {
          status: OrderStatusEnum.CREATED,
          des: "Đơn hàng đã được tạo",
          createdAt: new Date(),
          creatorId: customerId,
        },
      ],
      paymentLogs: [
        {
          status: PaymentStatus.PAYMENT_PENDING,
          des: "Chờ thanh toán qua chuyển khoản ngân hàng",
          createdAt: new Date(),
          creatorId: customerId,
        },
      ],
    } as any);

    const timeoutAt = moment().add(30, "minutes").toDate();
    await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();
    return { order };
  },

  createNormalSePayPGCheckout: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.customerId;
    const { amount, orderId } = args;

    const MIN_AMOUNT = 100_000;
    const MAX_AMOUNT = 50_000_000;

    if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      throw new Error(
        `Số tiền phải từ ${MIN_AMOUNT.toLocaleString("vi-VN")} đến ${MAX_AMOUNT.toLocaleString("vi-VN")} VNĐ`
      );
    }

    const creditRateSetting = await settingService.findOne({
      key: "wa-mpoint-change-credit-balance",
    });
    const rate = Number(creditRateSetting?.value) || 1;
    const creditAmount = Math.floor(amount / rate);

    if (creditAmount <= 0) {
      throw new Error("Số tiền không đủ để quy đổi mPoint");
    }

    let order: any;

    if (orderId) {
      const existing = await orderService.findOne({
        _id: ObjectId(orderId),
        customerId: ObjectId(customerId),
        type: OrderTypeEnum.NORMAL,
        paymentStatus: PaymentStatus.PAYMENT_PENDING,
        paymentMethod: PaymentMethodEnum.SEPAY_PG,
      });
      if (!existing) throw new Error("Đơn hàng không khả dụng để retry");
      order = existing;
    } else {
      const pendingNormal = await orderService.findPendingNormalOrder(customerId);
      if (pendingNormal) {
        throw new Error(
          "Bạn có đơn nạp tiền đang chờ thanh toán. Vui lòng hoàn tất hoặc hủy đơn trước khi tạo đơn mới."
        );
      }

      order = await orderService.create({
        customerId: ObjectId(customerId),
        type: OrderTypeEnum.NORMAL,
        paymentMethod: PaymentMethodEnum.SEPAY_PG,
        paymentInfo: { method: PaymentMethodEnum.SEPAY_PG },
        paymentStatus: PaymentStatus.PAYMENT_PENDING,
        status: OrderStatusEnum.CREATED,
        totalAmount: amount,
        creditAmount,
        orderLogs: [
          {
            status: OrderStatusEnum.CREATED,
            des: "Đơn nạp mPoint qua cổng SePay PG đã được tạo",
            createdAt: new Date(),
            creatorId: customerId,
          },
        ],
        paymentLogs: [
          {
            status: PaymentStatus.PAYMENT_PENDING,
            des: "Chờ thanh toán qua cổng SePay PG",
            createdAt: new Date(),
            creatorId: customerId,
          },
        ],
      } as any);

      const timeoutAt = moment().add(30, "minutes").toDate();
      await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();
    }

    const domain = config.get<string>("domain");
    const orderNumber = order.orderNumber;
    const finalAmount: number = order.totalAmount ?? amount;

    return sePayPGService.createCheckoutFormData({
      orderInvoiceNumber: orderNumber,
      orderAmount: finalAmount,
      orderDescription: `${orderNumber}`,
      customerId: customerId,
      successUrl: `${domain}/api/payment/sepay-pg/success/${orderNumber}`,
      errorUrl: `${domain}/api/payment/sepay-pg/error/${orderNumber}`,
      cancelUrl: `${domain}/api/payment/sepay-pg/cancel/${orderNumber}`,
    });
  },

  updateOrder: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { orderId, data } = args;
    const creatorId = context.id;
    return orderService.updateOrder(orderId, data, creatorId);
  },

  updateOrderStatus: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { orderId, status } = args;
    const creatorId = context.id;
    return orderService.updateOrderStatus(orderId, status, creatorId);
  },

  createShopeExpressShipping: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { orderId } = args;
    return orderService.createShopeExpressShipping(orderId);
  },

  createGiaoHangNhanhShipping: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { orderId } = args;
    return orderService.createGiaoHangNhanhShipping(orderId);
  },

  /**
   * Tạo form thanh toán qua cổng SePay PG cho gói subscription.
   * - Không truyền orderId → CREATE đơn mới + sinh form
   * - Truyền orderId (đơn PAYMENT_PENDING+SEPAY_PG) → chỉ tái tạo form (retry)
   */
  createSePayPGCheckout: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.customerId;
    const { subscriptionPlan, orderId, type } = args;

    if (!subscriptionPlan) {
      throw new Error("Vui lòng chọn gói subscription");
    }

    // Map plan value → setting key prefix (giống PLAN_KEY_MAP bên pricing-page)
    const PLAN_KEY_MAP: Record<string, string> = {
      [SubscriptionPlanEnum.TRIAL]: SubscriptionPlanEnum.TRIAL,
      [SubscriptionPlanEnum.BASIC]: SubscriptionPlanEnum.BASIC,
      [SubscriptionPlanEnum.STANDARD]: SubscriptionPlanEnum.STANDARD,
      [SubscriptionPlanEnum.PROFESSIONAL]: SubscriptionPlanEnum.PROFESSIONAL,
      [SubscriptionPlanEnum.ENTERPRISE]: SubscriptionPlanEnum.ENTERPRISE,
    };

    const planKey =
      type === "recaptcha" || type === "api-media"
        ? subscriptionPlan.toLowerCase()
        : PLAN_KEY_MAP[subscriptionPlan];
    if (!planKey) {
      throw new Error("Gói subscription không hợp lệ");
    }

    // Xác định setting prefix theo type: recaptcha → rpk, api-media → ampk, tool → pk
    const settingPrefix =
      type === "recaptcha" ? "rpk" : type === "api-media" ? "ampk" : "pk";

    // Lấy giá gói từ setting
    const priceSetting = await settingService.findOne({
      key: `${settingPrefix}-${planKey}-price`,
    });

    if (!priceSetting || !priceSetting.value || priceSetting.value <= 0) {
      throw new Error("Không tìm thấy giá cho gói subscription này");
    }
    const totalAmount = Number(priceSetting.value);

    let order: any;

    if (orderId) {
      // Retry: tái tạo form cho đơn PAYMENT_PENDING+SEPAY_PG đã có
      const existing = await orderService.findOne({
        _id: ObjectId(orderId),
        customerId: ObjectId(customerId),
        paymentStatus: PaymentStatus.PAYMENT_PENDING,
        "paymentInfo.method": PaymentMethodEnum.SEPAY_PG,
      });
      if (!existing) throw new Error("Đơn hàng không khả dụng để retry");
      order = existing;
    } else {
      // CREATE đơn mới với phương thức SEPAY_PG
      order = await orderService.create({
        customerId: ObjectId(customerId),
        paymentMethod: PaymentMethodEnum.SEPAY_PG,
        paymentInfo: { method: PaymentMethodEnum.SEPAY_PG },
        paymentStatus: PaymentStatus.PAYMENT_PENDING,
        status: OrderStatusEnum.CREATED,
        totalAmount,
        subscriptionPlan,
        type:
          type === "recaptcha"
            ? "RECAPTCHA"
            : type === "api-media"
              ? "API_MEDIA"
              : "TOOL",
        orderLogs: [
          {
            status: OrderStatusEnum.CREATED,
            des: `Đăng ký gói ${subscriptionPlan} qua cổng SePay PG`,
            createdAt: new Date(),
            creatorId: customerId,
          },
        ],
        paymentLogs: [
          {
            status: PaymentStatus.PAYMENT_PENDING,
            des: `Chờ thanh toán gói ${subscriptionPlan} qua cổng SePay PG`,
            createdAt: new Date(),
            creatorId: customerId,
          },
        ],
      } as any);

      const timeoutAt = moment().add(30, "minutes").toDate();
      await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();
    }

    const domain = config.get<string>("domain");
    const orderNumber = order.orderNumber;
    // Dùng totalAmount của đơn thực tế (đặc biệt quan trọng khi retry)
    const finalAmount: number = order.totalAmount ?? totalAmount;

    const checkoutData = sePayPGService.createCheckoutFormData({
      orderInvoiceNumber: orderNumber,
      orderAmount: finalAmount,
      orderDescription: `${orderNumber}`,
      customerId: customerId,
      successUrl: `${domain}/api/payment/sepay-pg/success/${orderNumber}`,
      errorUrl: `${domain}/api/payment/sepay-pg/error/${orderNumber}`,
      cancelUrl: `${domain}/api/payment/sepay-pg/cancel/${orderNumber}`,
    });

    return checkoutData;
  },

  cancelOrder: async (root: any, args: any, context: Context) => {
    const { orderId, reason } = args;

    const order = await orderService.findOne({ _id: orderId });

    if (!order) {
      throw new Error("Order not found");
    }

    // Check permission
    if (context.isCustomer) {
      if (order.customerId?.toString() !== context.customerId) {
        throw new Error("Unauthorized");
      }
      // Customer can only cancel pending orders
      if (order.status !== OrderStatusEnum.CONFIRMED && order.status !== OrderStatusEnum.CREATED) {
        throw new Error("Chỉ có thể hủy đơn hàng đang chờ xử lý");
      }
    } else {
      const sessionId = context.req.cookies?.cartSessionId || null;
      if (!sessionId) {
        throw new Error("Unauthorized");
      }

      if (order.sessionId !== sessionId) {
        throw new Error("Unauthorized");
      }
    }

    return orderService.cancelOrder(orderId, reason, context.customerId);
  },
};

const Order = {};

export default {
  Query,
  Mutation,
  Order,
};
