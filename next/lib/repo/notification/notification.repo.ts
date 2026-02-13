import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions } from "../crud.repo";
import { User } from "../general";

export type Notification = BaseModel & {
  id: string;
  createdAt: string;
  updatedAt: string;
  target: string; //Gửi tới MEMBER,STAFF,CUSTOMER
  shopId: string;
  userId: string;
  customerId: string;
  title: string; //Tiêu đề thông báo
  body: string; //Nội dung thông báo
  type: "MESSAGE" | "ORDER" | "PRODUCT" | "WEBSITE" | "SUPPORT_TICKET" | "TRANSACT" | "WALLET"; //Loại thông báo MESSAGE,ORDER,PRODUCT,WEBSITE
  seen; //Đã xem
  seenAt: string; //Ngày xem
  image: string;
  sentAt: string; //Ngày gửi
  orderId: string;
  productId: string;
  gameOrderId: string; //Mã đơn sản phẩm
  link: string; //Link website
  user: User;

  transactLink: string;
};
export const NOTIFY_FRAGMENT = "id createdAt title body seen type  link  transactLink walletLink";
export class NotificationRepository extends CrudRepository<Notification> {
  apiName: string = "Notification";
  displayName: string = t("thông báo");
  shortFragment: string = `
        id createdAt updatedAt target shopId userId customerId title body type seen seenAt image sentAt orderId productId gameOrderId link transactLink walletLink
        shop {id }
        user{id  name}
        customer  {id  name}
        order {id code status}
        product {id}
       
      `;
  fullFragment: string = `
        id createdAt updatedAt target shopId userId customerId title body type seen seenAt image sentAt orderId productId gameOrderId link transactLink walletLink
        shop { id }
        user{id  name}
        customer  { id  name}
        order { id code status}
        product { id}
        
      `;
  async readNotification(id: string): Promise<any> {
    return await this.mutate({
      mutation: `readNotification(notificationId: "${id}") {
            ${this.fullFragment}
          }`,
    }).then((res) => {
      return res.data["g0"];
    });
  }
  async readAllNotification(): Promise<boolean> {
    return await this.mutate({
      mutation: `readAllNotification`,
      clearStore: true,
    }).then((res) => {
      return res.data["g0"];
    });
  }

  async getCustomerNotification(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getAllCustomerNotify",
    });
  }
  async getShopNotification(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getAllShopNotify",
    });
  }
  async getUserNotification(options: GetAllOptions) {
    return this.getAll({
      ...options,
      apiName: "getAllUserNotify",
    });
  }
}

export const NotificationService = new NotificationRepository();
