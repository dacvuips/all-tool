import { Dictionary, get } from "lodash";

import { PostModel } from "./post.model";
import { TopicModel } from "../../../graphql/modules/post/topic/topic.model";
import { CRUDService } from "../../../base/crudService";
import { waitForMainConnection } from "../../../helpers/mongo";
import logger from "../../../helpers/logger";

class PostService extends CRUDService(PostModel) {
  private _topics: Dictionary<string> = {};
  constructor() {
    super();
    void this.loadTopics();
  }

  private async loadTopics() {
    try {
      await waitForMainConnection();
      const topics = await TopicModel.find();
      topics.forEach((t) => (this._topics[t.slug] = t._id));
    } catch (err: any) {
      logger.error(`[PostService] load topics lỗi: ${err?.message || err}`);
    }
  }

  async getTopicIdBySlug(slug: string) {
    if (!this._topics[slug]) {
      this._topics[slug] = await TopicModel.findOne({ slug }).then((res) => get(res, "_id"));
    }
    return this._topics[slug];
  }
}

const postService = new PostService();

export { postService };
