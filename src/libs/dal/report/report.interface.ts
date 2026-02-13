import { TimestampEntity } from "../../core";

export type IReport = TimestampEntity & {
  customerId?: string;
  shopId?: string;
  productId?: string;
  threadId?: string;
  orderId?: string;
  type: ReportTypeEnum;
  content: {
    title: string;
    description: string;
    imageUrls: string[];
  };
  status: ReportStatusEnum;
  times: {
    processingAt?: Date;
    doneAt?: Date;
  };
  note?: string;
};

export enum ReportStatusEnum {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  DONE = "DONE",
}

export enum ReportTypeEnum {
  PRODUCT = "PRODUCT",
  THREAD = "THREAD",
  ORDER = "ORDER",
}
