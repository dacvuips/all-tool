import { TimestampEntity } from "../../core";

export type TextCreditUsageTool = "tts" | "conversion" | "clone" | "stt" | "cleanup";

export type ITextCreditUsage = TimestampEntity & {
  customerId: string;
  customerCode?: string;
  jobId: string;
  tool: TextCreditUsageTool | string;
  amount: number;
  microxAmount?: number;
  textCreditCountAfter?: number;
  textCreditLimit?: number;
  description?: string;
};
