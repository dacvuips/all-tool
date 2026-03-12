import { set } from "lodash";
import moment from "moment-timezone";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { BankModel, PaymentMethodEnum } from "../../../libs/dal/bank";
import { OrderStatusEnum, PaymentStatus } from "../../../libs/dal/order/order.interface";
import { OrderModel } from "../../../libs/dal/order/order.model";
import orderService from "../../../libs/dal/order/order.service";
import { ProductLoader } from "../../../libs/dal/product";
import { Context } from "../../../libs/graphql";
import { ObjectId } from "../../../packages/object-id";
import { OrderCode } from "../../../packages/order-code";
import ProcessExpiredOrderJob from "../../../scheduler/jobs/processExpiredOrder.job";

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
    // Mặc định lấy đơn hàng từ thời điểm hiện tại đến 30 phút trước
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = context.isCustomer
      ? undefined
      : context.req.cookies?.cartSessionId || undefined;

    const filter: any = {
      ...(customerId ? { customerId: ObjectId(customerId) } : sessionId ? { sessionId } : {}),
      status: { $in: [OrderStatusEnum.CONFIRMED, OrderStatusEnum.CREATED] },
      paymentStatus: { $in: [PaymentStatus.PAYMENT_PENDING] },
      createdAt: {
        $gte: thirtyMinutesAgo,
        $lte: now,
      },
    };
    return await OrderModel.findOne(filter).select(
      "orderNumber status paymentStatus totalAmount createdAt shippingAddress paymentMethod subtotal shippingFee tax discount paymentInfo"
    );
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
    const { data } = args;
    const customerId = context.customerId;

    // Mặc định lấy đơn hàng từ thời điểm hiện tại đến 30 phút trước
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const existingOrder = await orderService.findOne({
      customerId,

      status: { $in: [OrderStatusEnum.CREATED, OrderStatusEnum.CONFIRMED] },
      paymentStatus: { $in: [PaymentStatus.PAYMENT_PENDING] },
      createdAt: {
        $gte: thirtyMinutesAgo,
        $lte: now,
      },
    });
    if (existingOrder) {
      throw new Error(
        "Bạn có đơn hàng đang chờ thanh toán. Vui lòng hoàn tất hoặc hủy đơn hàng trước khi tạo đơn mới."
      );
    }

    // Generate order number

    const orderNumber = OrderCode.generate();
    const defaultBank = await BankModel.findOne({ status: true });
    // Map ATM to BANK since ATM is no longer a valid enum value
    let paymentMethod = defaultBank?.method || PaymentMethodEnum.BANK;

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
      customerId,
      paymentMethod: data.paymentMethod,
      paymentInfo,
      orderNumber,
      paymentStatus: PaymentStatus.PAYMENT_PENDING,
      status: OrderStatusEnum.CREATED,
      customerNote: data.customerNote,
      totalAmount: data.totalAmount,
      creditAmount: data.creditAmount,
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
          des: "Chờ thanh toán",
          createdAt: new Date(),
        },
      ],
    };

    const order = await orderService.create(orderData);

    // set Agenda job to process expired order
    const timeoutAt = moment().add(30, "minutes").toDate(); // 30 minutes from now
    await ProcessExpiredOrderJob.create({ orderId: order._id }).schedule(timeoutAt).save();

    return {
      order,
    };
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

const Order = {
  product: async (root: any, args: any, context: Context) => {
    return await ProductLoader.load(root.productId);
  },
};

export default {
  Query,
  Mutation,
  Order,
};
