import mongoose from "mongoose";

import { MainConnection } from "../../../helpers/mongo";
import { ModelLoader } from "../../core";
import { IIntroduce } from "./introduce.interface";

const Schema = mongoose.Schema;

const introduceSchema = new Schema(
  {
    /** ID người được giới thiệu */
    referrerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    /** ID người giới thiệu (người nhập mã giới thiệu) */
    refereeId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    /** Trạng thái khoá */
    blocked: { type: Boolean, default: false },
    /** Danh sách đơn mà người được bạn giới thiệu nạp và giá chiếc khấu */
    orders: {
      type: [
        {
          orderId: { type: Schema.Types.ObjectId, ref: "Order" },
          discountPrice: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Đảm bảo 1 người chỉ được giới thiệu 1 lần
introduceSchema.index({ refereeId: 1 }, { unique: true });
// Index tìm theo người giới thiệu
introduceSchema.index({ referrerId: 1, createdAt: -1 });

export const IntroduceModel = MainConnection.model<IIntroduce>("Introduce", introduceSchema);

export const IntroduceLoader = ModelLoader(IntroduceModel);
