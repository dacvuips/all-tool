import { set } from "lodash";
import moment from "moment-timezone";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Scope } from "../../../libs/dal/authority";
import { BankModel, PaymentMethodEnum } from "../../../libs/dal/bank";
import { cartService } from "../../../libs/dal/cart";
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
    const customerId = context.isCustomer ? context.customerId : null;
    const sessionId = data.sessionId || context.req.cookies?.cartSessionId;

    // Mặc định lấy đơn hàng từ thời điểm hiện tại đến 30 phút trước
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const existingOrder = await orderService.findOne({
      ...(customerId ? { customerId } : { sessionId }),

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
    // Load product to get delivery information
    const product = await ProductLoader.load(data.productId);

    // Calculate subtotal from items
    const subtotal = data.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    // Add subtotal and delivery info for each item
    // Add subtotal for each item
    const items = data.items.map((item: any) => ({
      ...item,
      subtotal: item.price * item.quantity,
    }));

    // Calculate total
    const shippingFee = data.shippingFee || 0;
    const tax = data.tax || 0;
    const discount = data.discount || 0;
    const totalAmount = subtotal + shippingFee + tax - discount;

    // Get IP address
    const ipAddress =
      context.req.headers["x-forwarded-for"] || context.req.connection.remoteAddress || "127.0.0.1";

    // Generate order number

    const orderNumber = OrderCode.generate();
    const defaultBank = await BankModel.findOne({ status: true });
    // Map ATM to BANK since ATM is no longer a valid enum value
    let paymentMethod: any = defaultBank?.method || PaymentMethodEnum.BANK;
    if (paymentMethod === "ATM") {
      paymentMethod = PaymentMethodEnum.BANK;
    }
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
      sessionId,
      productId: data.productId,
      items,
      subtotal,
      shippingFee,
      tax,
      discount,
      totalAmount,
      shippingAddress: data.shippingAddress,
      paymentMethod: data.paymentMethod,
      paymentInfo,
      orderNumber,
      paymentStatus:
        data.paymentMethod === PaymentMethodEnum.COD
          ? PaymentStatus.PAYMENT_UNPAID
          : PaymentStatus.PAYMENT_PENDING,
      status:
        data.paymentMethod === PaymentMethodEnum.COD
          ? OrderStatusEnum.CONFIRMED
          : OrderStatusEnum.CREATED,
      customerNote: data.customerNote,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      userAgent: context.req.headers["user-agent"],
      orderLogs: [
        {
          status:
            data.paymentMethod === PaymentMethodEnum.COD
              ? OrderStatusEnum.CONFIRMED
              : OrderStatusEnum.CREATED,
          des:
            data.paymentMethod === PaymentMethodEnum.COD
              ? "Đơn hàng đã được tạo (COD)"
              : "Chờ xác nhận",
          createdAt: new Date(),
          creatorId: customerId,
        },
      ],
      paymentLogs: [
        {
          status:
            data.paymentMethod === PaymentMethodEnum.COD
              ? PaymentStatus.PAYMENT_UNPAID
              : PaymentStatus.PAYMENT_PENDING,
          des:
            data.paymentMethod === PaymentMethodEnum.COD
              ? "Thanh toán khi nhận hàng (COD)"
              : "Chờ thanh toán",
          createdAt: new Date(),
        },
      ],
    };
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    const order = await orderService.create(orderData);
    // set cookie phone and email for guest checkout
    if (!customerId && data.shippingAddress) {
      if (order.shippingAddress?.phone) {
        context.res.cookie(CONSTANTS.CookiesName.guestPhone, order.shippingAddress.phone, {
          maxAge,
        });
      }
      if (order.shippingAddress?.email) {
        context.res.cookie(CONSTANTS.CookiesName.guestEmail, order.shippingAddress.email, {
          maxAge,
        });
      }
      if (order.shippingAddress?.address) {
        context.res.cookie(CONSTANTS.CookiesName.guestAddress, order.shippingAddress.address, {
          maxAge,
        });
        context.res.cookie(
          CONSTANTS.CookiesName.guestProvince,
          order.shippingAddress.province || "",
          {
            maxAge,
          }
        );
        context.res.cookie(
          CONSTANTS.CookiesName.guestDistrict,
          order.shippingAddress.district || "",
          {
            maxAge,
          }
        );
        context.res.cookie(CONSTANTS.CookiesName.guestWard, order.shippingAddress.ward || "", {
          maxAge,
        });
      }
      if (order.shippingAddress?.recipientName) {
        context.res.cookie(CONSTANTS.CookiesName.guestName, order.shippingAddress.recipientName, {
          maxAge,
        });
      }
    }
    // Clear cart items if cartIds provided
    if (data.cartIds && data.cartIds.length > 0) {
      await cartService.model.deleteMany({
        _id: { $in: data.cartIds },
        ...(customerId ? { customerId } : { sessionId }),
      });
    }
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
