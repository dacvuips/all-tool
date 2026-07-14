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
  keyPrefix?: string;
  requestQuantity?: number;
  expiredDate?: string;
  customerId?: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
  active?: boolean;
  usedQuantity?: number;
  subscriptionPlan?: ApiMediaSubscriptionPlanEnum;
  /** Số luồng request đồng thời (-1 = không giới hạn) */
  streamCount?: number;
}

export class ApiMediaTokenRepository extends CrudRepository<ApiMediaToken> {
  apiName: string = "ApiMediaToken";
  displayName: string = "API Media";
  shortFragment: string = `
    ${this.parseFragment(`
      id: String
      createdAt: DateTime
      updatedAt: DateTime
      key: String
      keyPrefix: String
      requestQuantity: Int
      expiredDate: DateTime
      customerId: String
      active: Boolean
      usedQuantity: Int
      subscriptionPlan: String
      streamCount: Int
    `)}
    customer { id email name }
  `;
  fullFragment: string = `
    ${this.parseFragment(`
      id: String
      createdAt: DateTime
      updatedAt: DateTime
      key: String
      keyPrefix: String
      requestQuantity: Int
      expiredDate: DateTime
      customerId: String
      active: Boolean
      usedQuantity: Int
      subscriptionPlan: String
      streamCount: Int
    `)}
    customer { id email name }
  `;

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

  async rotateMyApiMediaToken(id: string): Promise<{ plainKey: string; token: ApiMediaToken }> {
    const result = await this.apollo.mutate({
      mutation: this.gql`mutation rotateMyApiMediaToken($id: ID!) {
        g0: rotateMyApiMediaToken(id: $id) {
          plainKey
          token { ${this.fullFragment} }
        }
      }`,
      variables: { id },
      fetchPolicy: "no-cache",
    });
    await this.clearStore();
    return result.data["g0"] as { plainKey: string; token: ApiMediaToken };
  }
}

export const apiMediaTokenService = new ApiMediaTokenRepository();
