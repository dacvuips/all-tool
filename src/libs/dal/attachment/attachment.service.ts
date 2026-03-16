import { CRUDService } from "../../../base/crudService";
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

  async getSignedDownloadUrl(path: string) {
    return await minio.client.presignedGetObject(minio.bucket, path, 60 * 60);
  }

  getPermanentDownloadUrl(
    attachment: Pick<IAttachment, "name"> & { _id: string | { toString(): string } },
    baseUrl?: string
  ) {
    const attachmentId = attachment?._id?.toString?.();
    const fileName = encodeURIComponent(attachment?.name || "file");
    const normalizedBaseUrl = baseUrl?.replace(/\/+$/g, "") || "";
    return `${normalizedBaseUrl}/api/file/download/${attachmentId}/${fileName}`;
  }

  async getDownloadUrl(path: string) {
    // Backward-compatible alias for old callers.
    return this.getSignedDownloadUrl(path);
  }
}

const attachmentService = new AttachmentService();

export { attachmentService };
