import mongoose from "mongoose";
import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../../libs/core";
import { PaymentMethodEnum } from "../bank";
import { IOrder, OrderStatusEnum, PaymentStatus } from "./order.interface";

const Schema = mongoose.Schema;

const orderItemSchema = new Schema({
  variantId: { type: String },
  sku: { type: String },
  productName: { type: String, required: true },
  variantName: { type: String },
  thumbnail: { type: String },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  quantity: { type: Number, required: true },
  subtotal: { type: Number, required: true },
  weight: { type: Number },
  width: { type: Number },
  length: { type: Number },
  height: { type: Number },
});

const shippingAddressSchema = new Schema({
  recipientName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  ward: { type: String },
  district: { type: String },
  province: { type: String },
  country: { type: String, default: "Vietnam" },
  postalCode: { type: String },
  note: { type: String },
});

const paymentInfoSchema = new Schema({
  method: { type: String, enum: Object.values(PaymentMethodEnum), required: true },
  bankImage: { type: String },
  bankCode: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  accountName: { type: String },
  bin: { type: String },
  metaData: { type: Schema.Types.Mixed },
});

const orderLogSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(OrderStatusEnum),
    default: OrderStatusEnum.CREATED,
    required: true,
  },
  des: { type: String }, // Description with detailed information
  note: { type: String },
  meta: { type: Schema.Types.Mixed }, // Metadata for additional information
  createdAt: { type: Date, default: Date.now },
  creatorId: { type: Schema.Types.ObjectId },
});

const paymentLogSchema = new Schema({
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.PAYMENT_PENDING,
    required: true,
  },
  des: { type: String }, // Description with detailed information
  note: { type: String },
  meta: { type: Schema.Types.Mixed }, // Metadata for additional information (transaction ID, gateway response, etc.)
  createdAt: { type: Date, default: Date.now },
  creatorId: { type: Schema.Types.ObjectId },
  amount: { type: Number },
  transactionId: { type: String },
});

const shopAddressSchema = new Schema({
  name: { type: String },
  phone: { type: String },
  email: { type: String },
  address: { type: String },
  ward: { type: String },
  district: { type: String },
  province: { type: String },
  country: { type: String, default: "Vietnam" },
  postalCode: { type: String },
});

const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
    sessionId: { type: String },

    orderNumber: { type: String, unique: true },
    status: {
      type: String,
      enum: Object.values(OrderStatusEnum),
      default: OrderStatusEnum.CREATED,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    items: [orderItemSchema],

    subtotal: { type: Number, required: true },
    shippingFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    shippingAddress: { type: shippingAddressSchema, required: true },
    shopAddress: { type: shopAddressSchema },

    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethodEnum),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PAYMENT_PENDING,
    },
    paymentInfo: { type: paymentInfoSchema },

    paidAt: { type: Date },
    shippedAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },

    customerNote: { type: String },
    adminNote: { type: String },

    orderLogs: [orderLogSchema],
    paymentLogs: [paymentLogSchema],

    // Shipments (đơn vận chuyển)
    shipmentIds: [{ type: Schema.Types.ObjectId, ref: "Shipment" }],

    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

// Indexes for better query performance
orderSchema.index({ customerId: 1 });
orderSchema.index({ sessionId: 1 });
orderSchema.index({ orderNumber: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ orderNumber: "text" }, { weights: { orderNumber: 2 } } as any);


// Generate order number before save
orderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.orderNumber = `ORD${timestamp}${random}`;
  }
  next();
});

export const OrderModel = MainConnection.model<IOrder>("Order", orderSchema);

export const OrderLoader = ModelLoader(OrderModel);
