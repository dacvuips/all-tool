import { BaseModel, CrudRepository } from "../crud.repo";

export enum RecaptchaSubscriptionPlanEnum {
  FREE = "free",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  UNLIMITED = "unlimited",
}
export interface RecaptchaToken extends BaseModel {
  key?: string;
  requestQuantity?: number;
  expiredDate?: string;
  customerId?: string;
  active?: boolean;
  usedQuantity?: number;
  subscriptionPlan?: RecaptchaSubscriptionPlanEnum;
}

export class RecaptchaTokenRepository extends CrudRepository<RecaptchaToken> {
  apiName: string = "RecaptchaToken";
  displayName: string = "Recaptcha Token";
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    key: String
    requestQuantity: Int
    expiredDate: DateTime
    customerId: String
    active: Boolean
    usedQuantity: Int
    subscriptionPlan: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    key: String
    requestQuantity: Int
    expiredDate: DateTime
    customerId: String
    active: Boolean
    usedQuantity: Int
    subscriptionPlan: String
  `);

  async getMyRecaptchaTokens({
    query = { limit: 10 },
    cache = false,
  }: {
    query?: any;
    cache?: boolean;
  } = {}) {
    return this.getAll({
      query,
      cache,
      apiName: "getMyRecaptchaTokens",
    });
  }

  async createMyRecaptchaToken(): Promise<RecaptchaToken> {
    const result = await this.apollo.mutate({
      mutation: this.gql`mutation { g0: createMyRecaptchaToken { ${this.fullFragment} } }`,
      fetchPolicy: "no-cache",
    });
    await this.clearStore();
    return result.data["g0"] as RecaptchaToken;
  }
}

export const recaptchaTokenService = new RecaptchaTokenRepository();
