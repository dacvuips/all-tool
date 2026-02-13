import { CRUDService, CrudService } from "../../../../base/crudService";

import { TopicModel } from "./topic.model";

class TopicService extends CRUDService(TopicModel) {
  constructor() {
    super();
  }
}

const topicService = new TopicService();

export { topicService };
