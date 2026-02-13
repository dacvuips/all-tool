import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { User } from "../general";
import { WalletTimes } from "../types";

export interface Wallet extends BaseModel {
  ownerId?: string; // Mã tài khoản
  owner?: User; // Tài khoản
  balance?: number; // Số dư mPoint
  totalIn?: number; // Tổng mPoint đã nạp
  totalOut?: number; // Tổng mPoint đã rút
  times?: WalletTimes;
  isLocked?: boolean; // mPoint đã bị khóa
}
export class WalletRepository extends CrudRepository<Wallet> {
  apiName: string = "Wallet";
  displayName: string = t("mPoint");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    ownerId: ID
    owner{name role}:User
    balance: Float
    totalIn: Float
    totalOut: Float
    times: Mixed
    isLocked: Boolean
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime

    ownerId: ID
    owner{name role}:User
    balance: Float
    totalIn: Float
    totalOut: Float
    times: Mixed
    isLocked: Boolean
  `);

  async getInfo(fragment: string = this.fullFragment) {
    return this.query({
      query: `getWalletInfo { ${fragment} }`,
    }).then((res) => res.data.g0 as Wallet);
  }

  async depositManual(input: { walletId: string; amount: number; description: string }) {
    return this.mutate({
      mutation: `depositWalletManual(input: $input)`,
      variablesParams: `($input: DepositWalletManualInput!)`,
      options: {
        variables: { input },
      },
    }).then((res) => res.data.g0);
  }
  async withdrawManual(input: { walletId: string; amount: number; description: string }) {
    return this.mutate({
      mutation: `withdrawWalletManual(input: $input)`,
      variablesParams: `($input: WithdrawWalletManualInput!)`,
      options: {
        variables: { input },
      },
    }).then((res) => res.data.g0);
  }

  async depositByCasso(amount: number) {
    return this.mutate({
      mutation: `depositWalletByCasso(amount: ${amount}) { id code }`,
    }).then((res) => res.data.g0 as { id: string; code: string });
  }
}

export const WalletService = new WalletRepository();
