import { CRUDService } from "../../../base/crudService";
import { CustomerGenerationMediaModel } from "./customer-generation-media.model";
import type { ICustomerGenerationMedia } from "./customer-generation-media.interface";

/**
 * Service CRUD cho CustomerGenerationMedia.
 * Lưu từng output (ảnh/video) của customer từ AI generation để query nhanh theo customer.
 */
class CustomerGenerationMediaService extends CRUDService(CustomerGenerationMediaModel) {}

export const customerGenerationMediaService = new CustomerGenerationMediaService();
