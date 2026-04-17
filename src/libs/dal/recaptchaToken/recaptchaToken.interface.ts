import { TimestampEntity } from "../../core";

export enum RecaptchaSubscriptionPlanEnum {
  FREE = "free",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  UNLIMITED = "unlimited",
}
export type IRecaptchaToken = TimestampEntity & {
  key?: string;
  requestQuantity?: number;
  expiredDate?: Date;
  customerId?: string;
  active?: boolean;
  usedQuantity?: number;
  subscriptionPlan?: RecaptchaSubscriptionPlanEnum;
};
