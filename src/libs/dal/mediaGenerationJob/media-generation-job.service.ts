import { CRUDService } from "../../../base/crudService";
import { MediaGenerationJobModel } from "./media-generation-job.model";
import { IMediaGenerationJob } from "./media-generation-job.interface";

/**
 * Service CRUD cho `MediaGenerationJob`.
 *
 * Sử dụng `CRUDService` builder có sẵn để tương thích với mọi feature crud của framework
 * (findOne, find, update, paginate, ...). Tránh tự viết tay để giảm bề mặt lỗi.
 */
class MediaGenerationJobService extends CRUDService<IMediaGenerationJob>(
  MediaGenerationJobModel as any
) {}

export const mediaGenerationJobService = new MediaGenerationJobService();
