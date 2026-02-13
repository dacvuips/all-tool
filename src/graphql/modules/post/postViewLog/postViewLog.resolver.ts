import { TOKEN_ROLES } from "../../../../constants/role.const";
import { Context } from "../../../../libs/graphql";
import { postViewLogService } from "./postViewLog.service";

const Query = {
  getAllPostViewLog: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF);
    return postViewLogService.fetch(args.q);
  },
};

const PostViewLog = {};

export default {
  Query,
  PostViewLog,
};
