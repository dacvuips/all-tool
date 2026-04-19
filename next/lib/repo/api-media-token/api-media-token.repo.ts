import { BaseModel, CrudRepository } from "../crud.repo";

export enum ApiMediaSubscriptionPlanEnum {
  FREE = "free",
  BASIC = "basic",
  STANDARD = "standard",
  PROFESSIONAL = "professional",
  UNLIMITED = "unlimited",
}
export interface ApiMediaToken extends BaseModel {
  key?: string;
  requestQuantity?: number;
  expiredDate?: string;
  customerId?: string;
  active?: boolean;
  usedQuantity?: number;
  subscriptionPlan?: ApiMediaSubscriptionPlanEnum;
}

export class ApiMediaTokenRepository extends CrudRepository<ApiMediaToken> {
  apiName: string = "ApiMediaToken";
  displayName: string = "Api Media Token";
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

  async getMyApiMediaTokens({
    query = { limit: 10 },
    cache = false,
  }: {
    query?: any;
    cache?: boolean;
  } = {}) {
    return this.getAll({
      query,
      cache,
      apiName: "getMyApiMediaTokens",
    });
  }

  async createMyApiMediaToken(): Promise<ApiMediaToken> {
    const result = await this.apollo.mutate({
      mutation: this.gql`mutation { g0: createMyApiMediaToken { ${this.fullFragment} } }`,
      fetchPolicy: "no-cache",
    });
    await this.clearStore();
    return result.data["g0"] as ApiMediaToken;
  }

  async toggleMyApiMediaTokenActive(id: string): Promise<ApiMediaToken> {
    const result = await this.apollo.mutate({
      mutation: this.gql`mutation toggleMyApiMediaTokenActive($id: ID!) {
        g0: toggleMyApiMediaTokenActive(id: $id) { ${this.fullFragment} }
      }`,
      variables: { id },
      fetchPolicy: "no-cache",
    });
    await this.clearStore();
    return result.data["g0"] as ApiMediaToken;
  }
}

export const apiMediaTokenService = new ApiMediaTokenRepository();
