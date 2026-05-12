import { CRUDService } from "../../../base/crudService";
import { TrendingModel } from "./trending.model";
class TrendingService extends CRUDService(TrendingModel) {}

const trendingService = new TrendingService();

export { trendingService };
