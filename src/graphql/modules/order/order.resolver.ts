import config from "config";
import { set } from "lodash";
import moment from "moment-timezone";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { BankModel, PaymentMethodEnum } from "../../../libs/dal/bank";
import { OrderStatusEnum, PaymentStatus } from "../../../libs/dal/order/order.interface";
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
  // lấy 1 đơn hàng với param lọc theo shippingAddress phone, email , trạng thái đơn hàng status pending, confirmed, và trạng thái thanh toán paymentStatus unpaid và theo khoảng thời gian từ dateFrom đến dateTo
  getOneOrderByGuest: async (root: any, args: any, context: Context) => {
    const result = await orderService.findOrCreatePendingOrder(context.customerId);
    return result?.order ?? null;
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
    const customerId = context.customerId;
    const { creditAmount, orderId } = args;

    const now = new Date();
    // const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const filterExisting: any = {
      _id: ObjectId(orderId),
      customerId: ObjectId(customerId),
      paymentStatus: { $in: [PaymentStatus.PAYMENT_PENDING, PaymentStatus.PAYMENT_INITIATED] },
      // createdAt: { $gte: thirtyMinutesAgo, $lte: now },
    };
    if (!creditAmount) {
      throw new Error("Số tiền credit không hợp lệ");
    }

    const existingOrder = await orderService.findOne(filterExisting);
    if (!existingOrder || existingOrder.paymentStatus !== PaymentStatus.PAYMENT_INITIATED) {
      throw new Error("Đơn hàng không khả dụng");
    }
    const defaultBank = await BankModel.findOne({ status: true });
    if (!defaultBank) {
      throw new Error("Hệ thống không tìm thấy ngân hàng");
    }

    const creditAmountSetting = await settingService.findOne({
      key: "wa-mpoint-change-credit-balance",
    });
    // Map ATM to BANK since ATM is no longer a valid enum value
    let paymentMethod = defaultBank?.method || PaymentMethodEnum.BANK;
    const totalAmount = creditAmountSetting.value * creditAmount;
    const paymentInfo = {
      method: paymentMethod,
      bankImage: defaultBank?.bankImage || "",
      bankCode: defaultBank?.bankCode || "",
      bankName: defaultBank?.bankName || "",
      accountNumber: defaultBank?.accountNumber || "",
      accountName: defaultBank?.accountName || "",
      bin: defaultBank?.bin || "",
    };

    // Create order
    const orderData = {
      paymentInfo,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
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
          status: PaymentStatus.PAYMENT_INITIATED,
          des: "Đơn hàng đã được tạo",
          createdAt: new Date(),
          creatorId: customerId,
        },
      ],
    };

    const order = await orderService.updateOne(orderId, orderData);
    const timeoutAt = moment().add(30, "minutes").toDate();
    await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();
    return { order };
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
   * Tạo form thanh toán qua cổng SePay PG
   * 1. Xác thực và cập nhật đơn hàng với số tiền và phương thức SEPAY_PG
   * 2. Sinh chữ ký HMAC-SHA256 cho form
   * 3. Trả về dữ liệu để frontend auto-submit form POST tới SePay
   */
  createSePayPGCheckout: async (root: any, args: any, context: Context) => {
    await context.auth([TOKEN_ROLES.CUSTOMER]);
    const customerId = context.customerId;
    const { creditAmount, orderId } = args;

    if (!creditAmount || creditAmount <= 0) {
      throw new Error("Số credit không hợp lệ");
    }

    // Kiểm tra đơn hàng hợp lệ và thuộc khách hàng hiện tại
    const filterExisting: any = {
      _id: ObjectId(orderId),
      customerId: ObjectId(customerId),
      paymentStatus: { $in: [PaymentStatus.PAYMENT_PENDING, PaymentStatus.PAYMENT_INITIATED] },
    };

    const existingOrder = await orderService.findOne(filterExisting);
    if (!existingOrder || existingOrder.paymentStatus !== PaymentStatus.PAYMENT_INITIATED) {
      throw new Error("Đơn hàng không khả dụng");
    }

    // Lấy hệ số quy đổi credit → VND
    const creditAmountSetting = await settingService.findOne({
      key: "wa-mpoint-change-credit-balance",
    });
    const totalAmount = creditAmountSetting.value * creditAmount;

    // Cập nhật đơn hàng với phương thức SEPAY_PG
    const order = await orderService.updateOne(orderId, {
      paymentInfo: { method: PaymentMethodEnum.SEPAY_PG },
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      totalAmount,
      creditAmount,
      orderLogs: [
        {
          status: OrderStatusEnum.CREATED,
          des: "Đơn hàng được tạo với phương thức SePay PG",
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
    });

    // Tạo job hủy đơn tự động sau 30 phút nếu chưa thanh toán
    const timeoutAt = moment().add(30, "minutes").toDate();
    await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();

    // Lấy domain từ config để tạo callback URL
    const domain = config.get<string>("domain");
    const orderNumber = order.orderNumber;

    // Sinh dữ liệu form thanh toán SePay PG với chữ ký
    const checkoutData = sePayPGService.createCheckoutFormData({
      orderInvoiceNumber: orderNumber,
      orderAmount: totalAmount,
      orderDescription: `Thanh toán đơn hàng ${orderNumber}`,
      customerId: customerId,
      successUrl: `${domain}/api/payment/sepay-pg/success?order_invoice_number=${orderNumber}`,
      errorUrl: `${domain}/api/payment/sepay-pg/error?order_invoice_number=${orderNumber}`,
      cancelUrl: `${domain}/api/payment/sepay-pg/cancel?order_invoice_number=${orderNumber}`,
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
