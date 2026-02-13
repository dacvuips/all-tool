import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository, GetAllOptions, GetListData } from "../crud.repo";
import { Customer } from "../customer/customer.repo";
import { User } from "../general";

import { ThreadMessage } from "./thread-message.repo";

export interface Thread extends BaseModel {
  channel?: "channel" | "customer" | "staff"; // Kênh trao đổi
  snippet?: string; // Tin nhắn gần nhất
  lastMessageAt?: Date; // Thời điểm tin nhắn gần nhất
  messageId?: string; // Mã tin nhắn gần nhất
  shopId?: string; // Mã chủ shop
  customerId?: string; // Mã khách hàng
  staffId?: string; // Mã nhân viên
  gameOrderId?: string; // Mã đơn giao dịch
  shopProductId?: string; // Mã sản phẩm
  status?: ThreadStatus; // Trạng thái trao đổi
  id?: string;
  seenCustomer?: boolean; // khách hàng đã xem
  seenShop?: boolean; // cửa hàng đã xem
  seenStaff?: boolean; // nhân viên đã xem
  createdAt?: string;
  updatedAt?: string;

  customer?: Customer;
  staff?: User;
  message?: ThreadMessage;

  meta?: any;
}
export class ThreadRepository extends CrudRepository<Thread> {
  apiName: string = "Thread";
  displayName: string = t("cuộc trò truyện");
  shortFragment: string = `
    id    
    createdAt
    updatedAt
    channel 
    snippet
    lastMessageAt
    messageId
    shopId
    customerId
    staffId
    shopProductId
    status
    seenCustomer
    seenShop
    seenStaff
    
    shopProduct{id imageUrls name}
    gameOrderId
    shop { 
      id code name info{logoUrl}
    }
   customer { 
      id avatarUrl name
    }
    staff { 
      id avatar name
    }
  `;
  fullFragment: string = `
    id    
    createdAt
    updatedAt
    channel 
    snippet
    lastMessageAt
    messageId
    shopId
    customerId
    staffId
    status
    seenCustomer
    seenShop
    seenStaff
    meta
    shopProductId
    shopProduct{id imageUrls name displayPrice gameProperties  game{name properties logoUrl midMans }}
    gameOrderId
    shop {
      id
      code
      name
      info{logoUrl}
    }
    customer { 
      id
      avatarUrl
      name
    }
    staff { 
      id
      
      name
      avatar
      position
    }
  `;
  async createThreadStaff(shopId: string, customerId: string) {
    return this.mutate({
      mutation: `createThreadStaff( ${!!shopId ? `shopId:"${shopId}"` : ""},${
        !!customerId ? `customerId:"${customerId}"` : ""
      })`,
    }).then((res) => res.data.g0);
  }
  async createThreadCustomerShop(shopId: string, customerId: string) {
    return this.mutate({
      mutation: `createThreadCustomerShop( ${!!shopId ? `shopId:"${shopId}"` : ""},${
        !!customerId ? `customerId:"${customerId}"` : ""
      })`,
    }).then((res) => res.data.g0);
  }
  async createThreadCustomerContactShop(customerId: string, productId: string) {
    return this.mutate({
      mutation: `createThreadCustomerContactShop( customerId:"${customerId}",productId:"${productId}")`,
    }).then((res) => res.data.g0);
  }
  async cancelThread(threadId: string) {
    return this.mutate({
      mutation: `cancelThread(threadId: "${threadId}")`,
    }).then((res) => res.data.g0);
  }
  async closeThread(threadId: string, status: string) {
    return this.mutate({
      mutation: `closeThread(threadId: "${threadId}",status:"${status}")`,
    }).then((res) => res.data.g0);
  }
  async getAllThreadCustomer(options: GetAllOptions): Promise<GetListData<Thread>> {
    return this.getAll({
      ...options,
      apiName: "getAllThreadCustomer",
    });
  }
  async getAllThreadShop(options: GetAllOptions): Promise<GetListData<Thread>> {
    return this.getAll({
      ...options,
      apiName: "getAllThreadShop",
    });
  }
  async getAllThreadStaff(options: GetAllOptions): Promise<GetListData<Thread>> {
    return this.getAll({
      ...options,
      apiName: "getAllThreadStaff",
    });
  }

  async getAllThreadGameOrder(gameOrderId: string, options: GetAllOptions) {
    return this.query({
      query: `getAllThreadGameOrder(gameOrderId: $gameOrderId ,q: $q){data{${this.fullFragment}} pagination{ limit page total}}`,
      variablesParams: `($gameOrderId: String!,$q: QueryGetListInput)`,
      options: {
        variables: { gameOrderId, q: options.query || {} },
        fetchPolicy: "no-cache",
      },
    }).then((res) => res.data.g0);
  }
  async getThreadSeen(role: "CUSTOMER" | "STAFF") {
    return this.query({
      query: `getThreadSeen(role:$role)`,
      variablesParams: `($role: String!)`,
      options: {
        variables: { role },
        fetchPolicy: "no-cache",
      },
    }).then((res) => res.data.g0);
  }

  subscribeThreadChanged() {
    // console.log("subscribe thread change");
    return this.subscribe({
      query: `threadChanged { threadId event data }`,
    }).map((res) => res.data.g0 as ThreadChange);
  }
}

export const ThreadService = new ThreadRepository();

export type ThreadChannel = "customer" | "staff";

export type ThreadStatus = "new" | "opening" | "closed";

export enum ThreadMessageType {
  general = "general", // Chung
}
export type ThreadRole = "ADMIN" | "CUSTOMER" | "STAFF" | "PARTNER";

export type ThreadChange = {
  threadId: string;
  event: "message" | "seen" | "typing" | "close" | "cancel";
  data: any;
};
