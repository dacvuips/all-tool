import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { Customer } from "../customer/customer.repo";

export interface IntroduceOrder {
  orderId: string;
  discountPrice: number;
}

export interface Introduce extends BaseModel {
  referrerId: string;
  refereeId: string;
  blocked: boolean;
  orders: IntroduceOrder[];
  referrer?: Customer;
  referee?: Customer;
}

export class IntroduceRepository extends CrudRepository<Introduce> {
  apiName: string = "Introduce";
  displayName: string = t("giới thiệu");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    referrerId: String
    refereeId: String
    blocked: Boolean
    orders {
      orderId: String
      discountPrice: Float
    }
    referee {
      id: String
      name: String
      email: String
      phoneNumber: String
      avatarUrl: String
      code: String
      createdAt: DateTime
    }
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    referrerId: String
    refereeId: String
    blocked: Boolean
    orders {
      orderId: String
      discountPrice: Float
    }
    referrer {
      id: String
      name: String
      email: String
      phoneNumber: String
      avatarUrl: String
      code: String
    }
    referee {
      id: String
      name: String
      email: String
      phoneNumber: String
      avatarUrl: String
      code: String
      createdAt: DateTime
    }
  `);

  async getMyIntroduces({
    query = { limit: 10 },
    cache = false,
  }: {
    query?: any;
    cache?: boolean;
  } = {}) {
    return this.getAll({
      query,
      cache,
      apiName: "getMyIntroduces",
    });
  }

  async getMyReferrer(): Promise<Introduce | null> {
    return this.query({
      query: `getMyReferrer { ${this.fullFragment} }`,
    }).then((res) => res.data.g0 as Introduce | null);
  }

  async updateMyReferrer(introduceCode: string): Promise<Introduce> {
    return this.mutate({
      mutation: `updateMyReferrer(introduceCode: "${introduceCode}") { ${this.fullFragment} }`,
    }).then((res) => res.data.g0 as Introduce);
  }
}

export const introduceService = new IntroduceRepository();
