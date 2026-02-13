import { CRUDService } from "../../../../base/crudService";
import { IPost } from "../../../../libs/dal/post";
import { Context } from "../../../../libs/graphql";

import { PostTagModel } from "../postTag/postTag.model";
import { PostViewLogModel } from "./postViewLog.model";
class PostViewLogService extends CRUDService(PostTagModel) {
  constructor() {
    super();
    this.on("user_view", (post: IPost, context: Context) => {
      PostViewLogModel.updateOne(
        { postId: post._id, userId: context.id },
        { $inc: { view: 1 } },
        { upsert: true }
      ).exec();
    });
  }
}

const postViewLogService = new PostViewLogService();

export { postViewLogService };
