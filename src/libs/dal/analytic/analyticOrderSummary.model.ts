import { Schema } from "mongoose";

import { MainConnection } from "../../../helpers/mongo";

const schema = new Schema({
  when: { type: String, validator: /\d{4}-\d{2}-\d{2}/, required: true },
  time: { type: Date, required: true },
  total: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  newOrder: { type: Number, default: 0 },
  newAmount: { type: Number, default: 0 },
  status: [
    {
      status: { type: String, required: true },
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
  ],
  products: [
    {
      productId: { type: Schema.Types.ObjectId, required: true },
      productName: { type: String, required: true },
      orderCount: { type: Number, default: 0 },
      qty: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
  ],
  suppliers: [
    {
      supplierName: { type: String, required: true },
      count: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
    },
  ],
});

export const AnalyticOrderSummaryModel = MainConnection.model(
  "AnalyticOrderSummary",
  schema,
  "analytic_order_summary"
);
