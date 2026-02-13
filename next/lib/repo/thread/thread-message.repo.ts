import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { Customer } from "../customer/customer.repo";
import { User } from "../general";
import { ThreadRole } from "./thread.repo";

export interface ThreadSender {
  role?: ThreadRole; // Loại người dùng
  staffId?: string; // Mã nhân viên
  shopId?: string; // Mã cửa hàng
  customerId?: string; // Mã khách hàng
  staff?: User;

  customer?: Customer;
}

export interface ThreadMessage extends BaseModel {
  threadId?: string; // Mã cuộc trao đổi
  type?: string; // Loại tin nhắn
  text?: string; // Tin nhắn
  attachment?: any; // Dữ liệu đính kèm
  sender?: ThreadSender; // Người gửi
  seen?: boolean; // Đã xem
  seenAt?: Date; // Ngày xem
  isActive?: boolean; //Trạng thái
}
export class ThreadMessageRepository extends CrudRepository<ThreadMessage> {
  apiName: string = "ThreadMessage";
  displayName: string = t("trò chuyện");
  shortFragment: string = `
    id    
    createdAt
    updatedAt
    threadId
    type
    text
    attachment
    sender { 
      role
      staff { id name avatar }
      shop { id code name info{logoUrl} }
      customer { id name avatarUrl}
    }
    seen
    seenAt
    isActive
  `;
  fullFragment: string = `
  id    
  createdAt
  updatedAt
  threadId
  type
  text
  attachment
  sender { 
    role
    staff { id name }
    shop { id code name }
    customer { id name }
  }
  seen
  seenAt
  isActive
  `;
  async retrieveThreadMessage(threadMessageId: string) {
    return this.mutate({
      mutation: `retrieveThreadMessage(threadMessageId: "${threadMessageId}")`,
    }).then((res) => res.data.g0);
  }
}

export const ThreadMessageService = new ThreadMessageRepository();
