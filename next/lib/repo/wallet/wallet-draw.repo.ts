import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions } from "../crud.repo";

export type WalletDrawLog = {
  status: WalletDrawStatusEnum;
  createdAt: string;
  message: string;
  meta?: any;
};
export enum WalletDrawStatusEnum {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED",
}

export interface WalletDraw extends BaseModel {
  code?: string;
  ownerId?: string;
  walletId?: string;
  status?: WalletDrawStatusEnum;
  amount?: number;
  amountFee?: number;
  amountTotal?: number;
  amountOriginal?: number;
  note?: string;
  logs?: WalletDrawLog[];
}
const walletDrawShortFragment = `
  id 
  createdAt
  updatedAt

  code
  ownerId
  walletId
  status
  amount
  amountFee
  amountTotal
  amountOriginal
  note
  logs {
    status
    createdAt
    message
    meta
  }
  result{
  imgUrls note}
`;

export class WalletDrawRepository extends CrudRepository<WalletDraw> {
  apiName: string = "WalletDraw";
  displayName: string = t("lệnh rút mPoint");
  shortFragment: string = this.parseFragment(walletDrawShortFragment);
  fullFragment: string = this.parseFragment(walletDrawShortFragment);

  async getAllWalletDraw(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getAllWalletDraw",
    });
  }

  async getAllWalletDrawShop(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getAllWalletDrawShop",
    });
  }

  async walletDrawExchangeProcess(id: string) {
    return this.mutate({
      mutation: `walletDrawExchangeProcessing(id: $id){${walletDrawShortFragment}}`,
      variablesParams: `($id: ID!)`,
      options: {
        variables: { id },
      },
    }).then((res) => res.data.g0);
  }
  async walletDrawExchangeCompleted(id: string, imgUrls: string[], note: string) {
    return this.mutate({
      mutation: `walletDrawExchangeCompleted(id: $id, imgUrls:$imgUrls, note:$note){${walletDrawShortFragment}}`,
      variablesParams: `($id: ID!,$imgUrls: [String]!, $note: String!)`,
      options: {
        variables: { id, imgUrls, note },
      },
    }).then((res) => res.data.g0);
  }

  async walletDrawExchangeCanceled(id: string, imgUrls: string[], note: string) {
    return this.mutate({
      mutation: `walletDrawExchangeCanceled(id: $id, imgUrls:$imgUrls, note:$note){${walletDrawShortFragment}}`,
      variablesParams: `($id: ID!,$imgUrls: [String]!, $note: String!)`,
      options: {
        variables: { id, imgUrls, note },
      },
    }).then((res) => res.data.g0);
  }
}

export class WalletDrawShopRepository extends CrudRepository<WalletDraw> {
  apiName: string = "WalletDrawShop";
  displayName: string = t("lệnh rút mPoint");
  shortFragment: string = this.parseFragment(walletDrawShortFragment);
  fullFragment: string = this.parseFragment(walletDrawShortFragment);
}

export const WalletDrawService = new WalletDrawRepository();
export const WalletDrawShopService = new WalletDrawShopRepository();
