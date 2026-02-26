import { Types } from "mongoose";
import { TimestampEntity } from "../../core";

export type ICart = TimestampEntity & {
  customerId?: Types.ObjectId | string;
  sessionId?: string;

  productId: Types.ObjectId | string;

  productName: string;

  thumbnail?: string;

  price: number;
  originalPrice?: number;
  promotion?: {
    promotionType?: string;
    discountAmount?: number;
    startTime?: Date;
    endTime?: Date;
  };

  quantity: number;

  isSelected: boolean;
  isValid: boolean;

  stockCheckedAt?: Date;
  priceCheckedAt?: Date;
};
