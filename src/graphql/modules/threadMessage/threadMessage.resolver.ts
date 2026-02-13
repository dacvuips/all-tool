import _ from "lodash";
import { ErrorHelper } from "../../../base/error";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { notFoundHandler } from "../../../helpers/common";
import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../../libs/core";
import { ThreadLoader, ThreadStatus } from "../../../libs/dal/thread";
import {
  IThreadMessage,
  ThreadMessageModel,
  threadMessageService,
} from "../../../libs/dal/threadMessage";
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";

const Query = {
  getAllThreadMessage: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    return threadMessageService.fetch(args.q);
  },
  getOneThreadMessage: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await threadMessageService.findOne({ _id: id });
  },
};

const Mutation = {
  createThreadMessage: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { data } = args;
    const { threadId, text } = data;

    const thread = notFoundHandler(await ThreadLoader.load(threadId));
    if (thread.status == ThreadStatus.closed) {
      new ForbiddenError(t("Nhóm trò chuyện này đã đóng"));
      return;
    }
    if (context.isShop) {
      if (thread.shopId.toString() != context.id) throw ErrorHelper.permissionDeny();
      thread.seenStaff = false;
      thread.seenCustomer = false;
      data.sender = { role: TOKEN_ROLES.SHOP, shopId: context.id };
    }
    if (context.isCustomer) {
      if (thread.customerId.toString() != context.id) throw ErrorHelper.permissionDeny();
      thread.seenStaff = false;
      thread.seenShop = false;
      data.sender = { role: TOKEN_ROLES.CUSTOMER, customerId: context.id };
    }
    if (context.isAdmin || context.isStaff || context.isPartner) {
      if (thread.staffId.toString() != context.id) throw ErrorHelper.permissionDeny();
      thread.staffId = context.id;
      thread.seenCustomer = false;
      thread.seenShop = false;
      data.sender = { role: context.token.role, staffId: context.id };
    }

    const message: IThreadMessage = await threadMessageService.create(data);

    thread.snippet = _.truncate(text || `Đính kèm...`, { length: 30 });
    thread.lastMessageAt = message.createdAt;
    thread.messageId = message._id;

    await thread.save();

    pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.THREAD_MESSAGE, {
      event: "message",
      threadId: thread._id,
      data: message,
    });

    return message;
  },
  unsendMessage: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
    const { id } = args;
    const threadMessage = (await notFoundHandler(await ThreadMessageModel.findById(id))) as any;
    await checkOwner(threadMessage, context);
    threadMessage.isUnsend = true;
    return await threadMessage.save();
  },
  // updateThreadMessage: async (root: any, args: any, context: Context) => {
  // await context.auth(TOKEN_ROLES.ADMIN_STAFF);
  //   const { id, data } = args;
  //   return await threadMessageService.updateOne(id, data);
  // },
  // deleteOneThreadMessage: async (root: any, args: any, context: Context) => {
  // await context.auth(TOKEN_ROLES.ADMIN_STAFF);
  //   const { id } = args;
  //   return await threadMessageService.deleteOne(id);
  // },
};

const ThreadMessage = {};

export default {
  Query,
  Mutation,
  ThreadMessage,
};

async function checkOwner(thread: IThreadMessage, context: Context) {
  if (thread?.sender?.role) {
    switch (thread.sender.role) {
      case TOKEN_ROLES.ADMIN || TOKEN_ROLES.STAFF || TOKEN_ROLES.PARTNER:
        if (thread.sender.staffId.toString() !== context.id.toString())
          throw ErrorHelper.permissionDeny();
        break;
      case TOKEN_ROLES.SHOP:
      case TOKEN_ROLES.SHOP_STAFF:
        if (thread.sender.shopId.toString() !== context.id.toString())
          throw ErrorHelper.permissionDeny();
        break;
      case TOKEN_ROLES.CUSTOMER:
        if (thread.sender.customerId.toString() !== context.id.toString())
          throw ErrorHelper.permissionDeny();
        break;
      default:
        throw ErrorHelper.permissionDeny();
    }
    return true;
  }
  return false;
}
