import { CRUDService } from "../../../../base/crudService";
import { PostTagModel } from "./postTag.model";
class PostTagService extends CRUDService(PostTagModel) {
  constructor() {
    super();
  }
}

const postTagService = new PostTagService();

export { postTagService };
