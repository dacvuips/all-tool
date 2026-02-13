import { Types } from "mongoose";
import slugify from "slugify";
import { CRUDService } from "../../../base/crudService";
import cache from "../../../helpers/cache";
import logger from "../../../helpers/logger";
import minio from "../../../helpers/minio";
import { Doc } from "../../core";
import { IAttachment } from "./attachment.interface";
import { AttachmentModel } from "./attachment.model";

class AttachmentService extends CRUDService(AttachmentModel) {
  async deleteAttachtment(id: string) {
    const attachment: Doc<IAttachment> = await attachmentService.deleteOne(id);

    logger.info(`Xoá tập tin" ${attachment.path}`);
    // Xoá khỏi minio
    await this.deleteMinioFile(attachment.bucket, attachment.path);
    this.emit("delete", attachment);
    return attachment;
  }

  async deleteMinioFile(bucket: string, path: string) {
    try {
      return new Promise((resolve, reject) => {
        minio.client.removeObject(bucket, path, (error) => {
          if (error) return reject(error);
          return resolve(true);
        });
      });
    } catch (err) {
      logger.info(`Xoá File từ Minio có lỗi`, err);
    }
  }

  async getDownloadUrl(path: string) {
    const fileUrl = await minio.client.presignedGetObject(minio.bucket, path, 60);
    const token = new Types.ObjectId().toHexString();
    await cache.set("minio-tmp-file-url:" + token, fileUrl, 60 * 5);
    return `/api/file/download/${token}/${slugify(path.split("/").reverse()[0])}`;
  }
}

const attachmentService = new AttachmentService();

export { attachmentService };
