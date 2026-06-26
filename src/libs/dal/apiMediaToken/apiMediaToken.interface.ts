import { TimestampEntity } from "../../core";

export enum ApiMediaSubscriptionPlanEnum {
  FREE = "free",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  UNLIMITED = "unlimited",
}
export type IApiMediaToken = TimestampEntity & {
  key?: string;
  requestQuantity?: number;
  expiredDate?: Date;
  customerId?: string;
  active?: boolean;
  usedQuantity?: number;
  subscriptionPlan?: ApiMediaSubscriptionPlanEnum;
  /** Số luồng request đồng thời (-1 = không giới hạn) */
  streamCount?: number;
};
