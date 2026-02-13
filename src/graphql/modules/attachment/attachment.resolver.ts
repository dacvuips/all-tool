import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Doc } from "../../../libs/core";
import { attachmentService, IAttachment } from "../../../libs/dal/attachment";
import { Context } from "../../../libs/graphql";

const Query = {
  getAllAttachment: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return attachmentService.fetch(args.q);
  },
  getOneAttachment: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await attachmentService.findOne({ _id: id });
  },
};

const Mutation = {
  deleteOneAttachment: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    const { id } = args;
    return await attachmentService.deleteAttachtment(id);
  },
};

const Attachment = {
  downloadUrl: async (root: Doc<IAttachment>, args: any, context: Context) => {
    try {
      return await attachmentService.getDownloadUrl(root.path);
    } catch (err) {
      logger.error(`Error when get download url for attachment ${root._id}`);
      return "";
    }
  },
};

export default {
  Query,
  Mutation,
  Attachment,
};
