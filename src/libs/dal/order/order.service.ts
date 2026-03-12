import { CrudService } from "../../../base/crudService";
import { IOrder, ORDER_STATUS_OPTIONS, OrderStatusEnum, PaymentStatus } from "./order.interface";
import { OrderModel } from "./order.model";

class OrderService extends CrudService<IOrder> {
  constructor() {
    super(OrderModel);
  }

  async getOrderByNumber(orderNumber: string): Promise<IOrder | null> {
    return await this.model.findOne({ orderNumber });
  }

  async getCustomerOrders(customerId: string, limit: number = 20): Promise<IOrder[]> {
    return await this.model.find({ customerId }).sort({ createdAt: -1 }).limit(limit);
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatusEnum,
    creatorId?: string
  ): Promise<IOrder | null> {
    const updateData: any = { status };
    const logEntry: any = {
      status: OrderStatusEnum.STATUS_CHANGED,
      des: `Trạng thái đơn hàng đã thay đổi thành ${status}`,
      createdAt: new Date(),
    };

    if (creatorId) {
      logEntry.creatorId = creatorId;
    }

    switch (status) {
      case OrderStatusEnum.SHIPPING_STARTED:
        updateData.shippedAt = new Date();
        logEntry.type = OrderStatusEnum.SHIPPING_STARTED;
        logEntry.des = "Đơn hàng đang được vận chuyển";
        break;
      case OrderStatusEnum.DELIVERED:
        updateData.deliveredAt = new Date();
        logEntry.type = OrderStatusEnum.DELIVERED;
        logEntry.des = "Đơn hàng đã được giao thành công";
        break;
      case OrderStatusEnum.CANCELLED:
        updateData.cancelledAt = new Date();
        logEntry.type = OrderStatusEnum.CANCELLED;
        logEntry.des = "Đơn hàng đã bị hủy";
        break;
      case OrderStatusEnum.CONFIRMED:
        logEntry.type = OrderStatusEnum.CONFIRMED;
        logEntry.des = "Đơn hàng đã được xác nhận";
        break;
      case OrderStatusEnum.PROCESSING:
        logEntry.type = OrderStatusEnum.PROCESSING;
        logEntry.des = "Đơn hàng đang được xử lý";
        break;
    }

    return await this.model.findByIdAndUpdate(
      orderId,
      {
        ...updateData,
        $push: { logs: logEntry },
      },
      { new: true }
    );
  }

  async updatePaymentStatus(
    orderId: string,
    paymentStatus: PaymentStatus,
    paymentInfo?: any,
    creatorId?: string
  ): Promise<IOrder | null> {
    const updateData: any = { paymentStatus };
    const logEntry: any = {
      type: OrderStatusEnum.PAYMENT_UPDATED,
      des: `Trạng thái thanh toán: ${paymentStatus}`,
      createdAt: new Date(),
    };

    if (creatorId) {
      logEntry.creatorId = creatorId;
    }

    if (paymentStatus === PaymentStatus.PAYMENT_SUCCESS) {
      updateData.paidAt = new Date();
      updateData.status = OrderStatusEnum.CONFIRMED;
      logEntry.type = OrderStatusEnum.PAYMENT_CONFIRMED;
      logEntry.des = "Chuyển khoản ngân hàng";
      const order = await this.model.findById(orderId);
      logEntry.note = `Khách hàng đã thanh toán ${order?.totalAmount?.toLocaleString()} đ`;
    }

    if (paymentInfo) {
      updateData.paymentInfo = paymentInfo;
    }

    return await this.model.findByIdAndUpdate(
      orderId,
      {
        ...updateData,
        $push: { logs: logEntry },
      },
      { new: true }
    );
  }

  async cancelOrder(orderId: string, reason?: string, creatorId?: string): Promise<IOrder | null> {
    const logEntry: any = {
      type: OrderStatusEnum.CANCELLED,
      des: "Đơn hàng đã bị hủy",
      note: reason,
      createdAt: new Date(),
    };

    if (creatorId) {
      logEntry.creatorId = creatorId;
    }

    return await this.model.findByIdAndUpdate(
      { _id: orderId },
      {
        status: OrderStatusEnum.CANCELLED,
        cancelledAt: new Date(),
        adminNote: reason,
        $push: { logs: logEntry },
      },
      { new: true }
    );
  }

  async getOrderStats(customerId: string) {
    const orders = (await this.model.find({ customerId }).lean()) as IOrder[];

    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === OrderStatusEnum.CREATED).length,
      confirmed: orders.filter((o) => o.status === OrderStatusEnum.CONFIRMED).length,
      shipping: orders.filter((o) => o.status === OrderStatusEnum.SHIPPING_STARTED).length,
      delivered: orders.filter((o) => o.status === OrderStatusEnum.DELIVERED).length,
      cancelled: orders.filter((o) => o.status === OrderStatusEnum.CANCELLED).length,
      totalSpent: orders
        .filter((o) => o.paymentStatus === PaymentStatus.PAYMENT_SUCCESS)
        .reduce((sum, o) => sum + o.totalAmount, 0),
    };
  }

  async updateOrder(
    orderId: string,
    data: Partial<IOrder>,
    creatorId?: string
  ): Promise<IOrder | null> {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const updateData: any = { ...data };
    const changes: string[] = [];
    let statusChanged = false;

    // Kiểm tra các trường thay đổi
    if (data.status && data.status !== order.status) {
      const statusOption = ORDER_STATUS_OPTIONS.find((opt) => opt.value === data.status);
      changes.push(`Trạng thái: ${statusOption?.label || data.status}`);
      statusChanged = true;
    }

    if (data.paymentStatus && data.paymentStatus !== order.paymentStatus) {
      changes.push(`Trạng thái thanh toán: ${data.paymentStatus}`);
    }

    if (data.totalAmount !== undefined && data.totalAmount !== order.totalAmount) {
      changes.push(`Tổng tiền: ${data.totalAmount.toLocaleString()} đ`);
    }

    // Chỉ thêm log nếu có thay đổi
    if (changes.length > 0) {
      const logEntry: any = {
        status: statusChanged ? data.status : OrderStatusEnum.ORDER_UPDATED,
        type: OrderStatusEnum.ORDER_UPDATED,
        des: changes.join(", "),
        createdAt: new Date(),
      };

      if (creatorId) {
        logEntry.creatorId = creatorId;
      }

      // Thêm ghi chú nếu có
      if (data.adminNote) {
        logEntry.note = data.adminNote;
      }

      updateData.$push = { orderLogs: logEntry };
    } else {
      // Không có thay đổi, không cần update
      return order;
    }

    return await this.model.findByIdAndUpdate(orderId, updateData, { new: true });
  }

  async createShopeExpressShipping(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // TODO: Implement ShopeExpress API integration
    // This is a placeholder implementation
    return {
      success: true,
      message: "Shipping order created successfully with ShopeExpress",
      trackingNumber: `SPX${Date.now()}`,
      shippingLabel: null as string | null,
    };
  }

  async createGiaoHangNhanhShipping(orderId: string) {
    const order = await this.model.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    // TODO: Implement GiaoHangNhanh API integration
    // This is a placeholder implementation
    return {
      success: true,
      message: "Shipping order created successfully with GiaoHangNhanh",
      trackingNumber: `GHN${Date.now()}`,
      shippingLabel: null as string | null,
    };
  }
}

const orderService = new OrderService();

export default orderService;
