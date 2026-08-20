import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface TextCreditUsage extends BaseModel {
  customerId?: string;
  customerCode?: string;
  jobId?: string;
  tool?: string;
  amount?: number;
  microxAmount?: number;
  textCreditCountAfter?: number;
  textCreditLimit?: number;
  description?: string;
}

export type MicroxVoiceAccount = {
  credits?: number | null;
  email?: string | null;
  name?: string | null;
};

export class TextCreditUsageRepository extends CrudRepository<TextCreditUsage> {
  apiName: string = "TextCreditUsage";
  displayName: string = t("sử dụng text credit");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    customerId: String
    customerCode: String
    jobId: String
    tool: String
    amount: Int
    microxAmount: Float
    textCreditCountAfter: Int
    textCreditLimit: Int
    description: String
  `);
  fullFragment: string = this.shortFragment;

  async getMicroxVoiceAccount(): Promise<MicroxVoiceAccount> {
    return this.query({
      query: `getMicroxVoiceAccount { credits email name }`,
    }).then((res) => res.data.g0);
  }
}

export const TextCreditUsageService = new TextCreditUsageRepository();
