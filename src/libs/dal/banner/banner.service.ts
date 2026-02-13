import { CRUDService } from "../../../base/crudService";
import { BannerModel } from "./banner.model";
class BannerService extends CRUDService(BannerModel) {}

const bannerService = new BannerService();

export { bannerService };
