import { ObjectId } from "../../../packages/object-id";
import { IWallet } from "../../dal/wallet";
import {
  IWalletTransaction,
  WalletInfoKeyEnum,
  WalletTransactionModel,
  WalletTransactionSideEnum,
  WalletTransactionTypeEnum,
  WalletTranscationStatusEnum,
} from "../../dal/walletTransaction";

export class WalletTransactionBuilder {
  private _doc: IWalletTransaction;

  constructor(private wallet: IWallet) {
    this._doc = new WalletTransactionModel({
      code: ObjectId().toString(),
      walletId: wallet._id,
      ownerId: wallet.ownerId,
      status: WalletTranscationStatusEnum.SUCCESS,
      specificInfo: [],
    });
  }

  exchangeFee(input: { amount: number; orderId: string; orderCode: string }) {
    const { amount, orderId, orderCode } = input;
    this._doc.type = WalletTransactionTypeEnum.EXCHANGE_FEE;
    this._doc.description = `Phí giao dịch đơn hàng ${orderCode}`;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setOrderId(orderId);
  }

  manageCost(input: { amount: number; orderId: string; orderCode: string }) {
    const { amount, orderId, orderCode } = input;
    this._doc.type = WalletTransactionTypeEnum.MANAGE_COST;
    this._doc.description = `Phí quản lý đơn hàng ${orderCode}`;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setOrderId(orderId);
  }

  manageCommission(input: {
    amount: number;
    orderId: string;
    orderCode: string;
    fromUserId: string;
  }) {
    const { amount, orderId, orderCode, fromUserId } = input;
    this._doc.type = WalletTransactionTypeEnum.MANAGE_COMMISSION;
    this._doc.description = `Hoa hồng quản lý đơn hàng ${orderCode}`;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setOrderId(orderId)
      .setFromTransferUserId(fromUserId);
  }

  withdraw(input: { amount: number; userId: string; description: string }) {
    const { amount, userId, description } = input;
    this._doc.type = WalletTransactionTypeEnum.WITHDRAW;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setWithdrawUserId(userId);
  }

  deposit(input: { amount: number; userId: string; description: string }) {
    const { amount, userId, description } = input;
    this._doc.type = WalletTransactionTypeEnum.DEPOSIT;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN).setDepositUserId(userId);
  }

  depositFromOrder(input: {
    amount: number;
    description: string;
    orderId: string;
    orderCode: string;
  }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.BUY_PACKAGE;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN).setOrderId(orderId);
  }
  depositReward(input: { amount: number; description: string }) {
    const { amount, description } = input;
    this._doc.type = WalletTransactionTypeEnum.DEPOSIT;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN);
  }
  introduceReward(input: {
    amount: number;
    description: string;
    orderId?: string;
    orderCode?: string;
  }) {
    const { amount, description, orderId, orderCode } = input;
    this._doc.type = WalletTransactionTypeEnum.INTRODUCE;
    this._doc.description = description;
    const builder = this.setAmount(amount, WalletTransactionSideEnum.IN);
    if (orderId) builder.setOrderId(orderId);
    return builder;
  }

  buyUtilitesCustomer(input: { amount: number; customerId: string; description: string }) {
    const { amount, description, customerId } = input;
    this._doc.type = WalletTransactionTypeEnum.BUY_UTILITIES_CUSTOMER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setBuyUtilitesCustomerId(
      customerId
    );
  }
  buyUtilitesShop(input: { amount: number; shopId: string; description: string }) {
    const { amount, description, shopId } = input;
    this._doc.type = WalletTransactionTypeEnum.BUY_UTILITIES_SHOP;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setBuyUtilitesShopId(shopId);
  }
  exchangeGameCard(input: { amount: number; customerId: string; description: string }) {
    const { amount, description, customerId } = input;
    this._doc.type = WalletTransactionTypeEnum.EXCHANGE_GAME_CARD;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT).setExchangeGameCardCustomerId(
      customerId
    );
  }
  buyAffiliateServiceCustomer(input: { amount: number; description: string; orderId: string }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.AFFILIATE_ORDER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT)
      .setAffiliateOrderId(orderId)
      .setOrderId(orderId);
  }

  buyAffiliateAccountCustomer(input: { amount: number; description: string; orderId: string }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.AFFILIATE_ORDER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT)
      .setAffiliateOrderId(orderId)
      .setOrderId(orderId);
  }
  cancelAffiliateService(input: { amount: number; description: string; orderId: string }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.AFFILIATE_ORDER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setAffiliateOrderId(orderId)
      .setOrderId(orderId);
  }
  receiveAffiliateService(input: { amount: number; description: string; orderId: string }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.AFFILIATE_ORDER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setAffiliateOrderId(orderId)
      .setOrderId(orderId);
  }

  refundAffiliateOrder(input: { amount: number; description: string; orderId: string }) {
    const { amount, description, orderId } = input;
    this._doc.type = WalletTransactionTypeEnum.AFFILIATE_ORDER;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setAffiliateOrderId(orderId)
      .setOrderId(orderId);
  }

  /** Trừ mPoint khi customer mua trending / chatbot / app item */
  buyTrendingItem(input: {
    amount: number;
    description: string;
    trendingId: string;
    purchaseOrderId: string;
  }) {
    const { amount, description, trendingId, purchaseOrderId } = input;
    this._doc.type = WalletTransactionTypeEnum.BUY_TRENDING_ITEM;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.OUT)
      .setTrendingId(trendingId)
      .setTrendingPurchaseOrderId(purchaseOrderId);
  }

  /** Hoàn mPoint khi admin refund đơn mua trending item */
  refundTrendingItem(input: {
    amount: number;
    description: string;
    trendingId: string;
    purchaseOrderId: string;
  }) {
    const { amount, description, trendingId, purchaseOrderId } = input;
    this._doc.type = WalletTransactionTypeEnum.REFUND_TRENDING_ITEM;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setTrendingId(trendingId)
      .setTrendingPurchaseOrderId(purchaseOrderId);
  }

  depositWithPaypal(input: {
    amount: number;
    description: string;
    paypalOrderId: string;
    paypalTransactionId: string;
  }) {
    const { amount, description, paypalOrderId, paypalTransactionId } = input;
    this._doc.type = WalletTransactionTypeEnum.DEPOSIT_WITH_PAYPAL;
    this._doc.description = description;
    return this.setAmount(amount, WalletTransactionSideEnum.IN)
      .setPayPalOrderId(paypalOrderId)
      .setPayPalTransactionId(paypalTransactionId);
  }

  private setAmount(amount: number, side: WalletTransactionSideEnum) {
    const parsedAmount = Math.abs(amount);
    if (side === WalletTransactionSideEnum.OUT) {
      this._doc.amount = -parsedAmount;
    } else {
      this._doc.amount = parsedAmount;
    }
    this._doc.side = side;
    return this;
  }

  private setOrderId(orderId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.EXCHANGE_ORDER_ID, value: orderId });
    return this;
  }

  private setFromTransferUserId(userId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.FROM_TRANSFER_USER_ID, value: userId });
    return this;
  }

  private setWithdrawUserId(userId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.WITHDRAW_USER_ID, value: userId });
    return this;
  }

  private setDepositUserId(userId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.DEPOSIT_USER_ID, value: userId });
    return this;
  }
  private setBuyUtilitesCustomerId(userId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.BUY_UTILITIES_CUSTOMER_ID,
      value: userId,
    });
    return this;
  }

  private setBuyUtilitesShopId(userId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.BUY_UTILITIES_SHOP_ID,
      value: userId,
    });
    return this;
  }
  private setExchangeGameCardCustomerId(userId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.EXCHANGE_GAME_CARD_CUSTOMER_ID,
      value: userId,
    });
    return this;
  }

  private setAffiliateOrderId(orderId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.AFFILIATE_ORDER_ID, value: orderId });
    return this;
  }
  private setPayPalOrderId(orderId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.DEPOSIT_WITH_PAYPAL_ORDER_ID,
      value: orderId,
    });
    return this;
  }
  private setPayPalTransactionId(orderId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.PAYPAL_TRANSACTION_ID,
      value: orderId,
    });
    return this;
  }

  private setTrendingId(trendingId: string) {
    this._doc.specificInfo.push({ key: WalletInfoKeyEnum.TRENDING_ID, value: trendingId });
    return this;
  }

  private setTrendingPurchaseOrderId(purchaseOrderId: string) {
    this._doc.specificInfo.push({
      key: WalletInfoKeyEnum.TRENDING_PURCHASE_ORDER_ID,
      value: purchaseOrderId,
    });
    return this;
  }

  build() {
    return this._doc;
  }
}
