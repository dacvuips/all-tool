import {
  INotification,
  NotificationModel,
  NotificationTarget,
  NotificationType,
} from "../../../libs/dal/notification";
import { Action, ActionType } from "../../../libs/shared";

export class NotificationBuilder {
  data: INotification;
  constructor(title: string, body: string) {
    this.data = new NotificationModel({ title, body, type: NotificationType.MESSAGE });
  }
  web(link: string) {
    this.data.type = NotificationType.WEBSITE;
    this.data.link = link;
    return this;
  }
  order(orderId: string) {
    this.data.type = NotificationType.ORDER;
    this.data.orderId = orderId;
    return this;
  }
  gameOrder(gameOrderId: string) {
    this.data.type = NotificationType.GAME_ORDER;
    this.data.gameOrderId = gameOrderId;
    return this;
  }
  affiliateOrder(affiliateOrderId: string) {
    this.data.type = NotificationType.AFFILIATE_ORDER;
    this.data.affiliateOrderId = affiliateOrderId;
    return this;
  }
  product(productId: string) {
    this.data.type = NotificationType.PRODUCT;
    this.data.productId = productId;
    return this;
  }

  supportTicket(ticketId: string) {
    this.data.type = NotificationType.SUPPORT_TICKET;
    this.data.ticketId = ticketId;
    return this;
  }

  account() {
    this.data.type = NotificationType.ACCOUNT;

    return this;
  }
  setting() {
    this.data.type = NotificationType.SETTING;

    return this;
  }
  gameCard() {
    this.data.type = NotificationType.SETTING;

    return this;
  }
  transact(transactLink: string) {
    this.data.type = NotificationType.TRANSACT;
    this.data.transactLink = transactLink;
    return this;
  }
  wallet(walletLink?: string) {
    this.data.type = NotificationType.WALLET;
    this.data.walletLink = walletLink;
    return this;
  }

  action(action: Action) {
    switch (action.type) {
      case ActionType.ORDER:
        this.order(action.orderId);
        break;
      case ActionType.PRODUCT:
        this.product(action.productId);
        break;
      case ActionType.SUPPORT_TICKET:
        this.supportTicket(action.ticketId);
        break;
      case ActionType.WEBSITE:
        this.web(action.link);
        break;
      case ActionType.TRANSACT:
        this.transact(action.transactLink);
        break;
      case ActionType.WALLET:
        this.transact(action.transactLink);
        break;
    }
    return this;
  }

  sendTo(target: NotificationTarget, id: string) {
    this.data.target = target;
    switch (target) {
      case NotificationTarget.CUSTOMER:
        this.data.customerId = id;
        break;
      case NotificationTarget.SHOP:
        this.data.shopId = id;
        break;
      case NotificationTarget.USER:
        this.data.userId = id;
        break;
    }
    return this;
  }
  build() {
    return this.data;
  }
}
