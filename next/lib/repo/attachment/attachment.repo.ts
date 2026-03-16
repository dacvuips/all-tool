import axios from "axios";
import getConfig from "next/config";
import { t } from "../../functions/i18n";
import { GetUserToken } from "../../graphql";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Attachment extends BaseModel {
  name: string;
  mimetype: string;
  size: number;
  etag: string;
  path: string;
  downloadUrl: string;
  bucket: string;
  processing?: boolean;
}

const {
  publicRuntimeConfig: { upload = {} },
} = getConfig();
const DEFAULT_UPLOAD_ENDPOINT = "/api/file/upload";

export class AttachmentRepository extends CrudRepository<Attachment> {
  apiName: string = "Attachment";
  displayName: string = t("dữ liệu");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    mimetype: String
    size: Int
    downloadUrl: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    mimetype: String
    size: Int
    etag: String
    path: String
    downloadUrl: String
  `);
  async uploadFile(files: File, type: "image" | "video" | "file" = "file") {
    const uploadEndpoint = DEFAULT_UPLOAD_ENDPOINT;
    const uploadFieldName = type === "image" ? "image" : type === "video" ? "video" : "file";
    const formData = new FormData();
    formData.append(uploadFieldName, files);
    return (
      await axios.post(uploadEndpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-token": GetUserToken(),
        },
      })
    ).data;
  }
  async getFilesPromise(ids: string[]) {
    return await this.getAll({ query: { limit: 1000, filter: { _id: { __in: ids } } } }).then(
      (res) => {
        return res.data;
      }
    );
  }
}

export const AttachmentService = new AttachmentRepository();
