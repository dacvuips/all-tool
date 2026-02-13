import config from "config";
import mime from "mime-types";
import { Client } from "minio";
import logger from "./logger";

export type MinioUploadOptions = {
  isPublic?: boolean;
};
type MinioUploadResult = {
  etag: string;
  name: string;
  size: number;
  mimetype: string;
  bucket: string;
  link: string;
};

const MINIO_CONFIG = config.get<{
  endpoint: string;
  port: number;
  accessKey: string;
  secretKey: string;
  bucket: string;
}>("minio");

class Minio {
  private logger = logger.child({ _reqId: this.constructor.name });
  client: Client;
  constructor() {
    this.init();
  }
  private async init() {
    try {
      this.client = new Client({
        endPoint: new URL(MINIO_CONFIG.endpoint).host,
        port: Number(MINIO_CONFIG.port),
        useSSL: new URL(this.endpoint).protocol == "https:",
        accessKey: MINIO_CONFIG.accessKey,
        secretKey: MINIO_CONFIG.secretKey,
      });
      this.setupBucketPolicy(this.bucket).catch((err) => {
        this.logger.warn(`Cannot setup bucket policy for bucket ${this.bucket}: ${err.message}`);
      });
    } catch (err) {
      this.logger.warn(`Cannot initialize Minio client: ${err.message}`);
    }
  }

  getConnector(endpoint: string) {
    if (endpoint.includes("googleapis.com")) {
      return "google";
    }
    if (endpoint.includes("amazonaws.com")) {
      return "aws";
    }
    return "minio";
  }

  setupBucketPolicy(bucket: string) {
    const connector = this.getConnector(this.endpoint);
    if (connector == "aws") {
      return this.setupBucketPolicyAWS(bucket);
    } else if (connector == "google") {
      return this.setupBucketPolicyGoogle(bucket);
    } else {
      return this.setupBucketPolicyMinio(bucket);
    }
  }
  setupBucketPolicyMinio(bucket: string) {
    return this.setupBucketPolicyAWS(bucket);
  }
  setupBucketPolicyGoogle(bucket: string): Promise<boolean> {
    // make allow public read for folder /images
    throw new Error("Not implemented");
  }
  setupBucketPolicyAWS(bucket: string) {
    // make allow public read for folder /images
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicReadGetObject",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/images/*`],
        },
      ],
    };
    return new Promise((resolve, reject) => {
      this.client.setBucketPolicy(bucket, JSON.stringify(policy), (err: Error) => {
        if (err) {
          return reject(err);
        }
        resolve(true);
      });
    });
  }

  get bucket() {
    return MINIO_CONFIG.bucket;
  }
  get endpoint() {
    return MINIO_CONFIG.endpoint;
  }

  upload(
    fileName: string,
    file: Express.Multer.File,
    options: MinioUploadOptions = {}
  ): Promise<MinioUploadResult> {
    const headers: any = {
      "Content-Type": file.mimetype,
    };
    if (options.isPublic) {
      // aws s3 public header
      headers["x-amz-acl"] = "public-read";
      // google cloud storage public header
      headers["x-goog-acl"] = "public-read";
    }
    return new Promise((resolve, reject) => {
      if (!file.path) {
        this.client.putObject(
          this.bucket,
          fileName,
          file.buffer,
          file.size,
          headers,
          (err: Error, result: any) => {
            if (err) {
              return reject(err.message);
            }
            resolve({
              etag: result.etag,
              name: fileName,
              size: file.size,
              mimetype: file.mimetype,
              bucket: this.bucket,
              link: `${this.endpoint}/${this.bucket}/${fileName}`,
            });
          }
        );
      } else {
        this.client.fPutObject(
          this.bucket,
          fileName,
          file.path,
          {
            "Content-Type": file.mimetype,
          },
          (err: Error, result: any) => {
            if (err) {
              return reject(err.message);
            }
            resolve({
              etag: result.etag,
              name: fileName,
              size: file.size,
              mimetype: file.mimetype,
              bucket: this.bucket,
              link: `${this.endpoint}/${this.bucket}/${fileName}`,
            });
          }
        );
      }
    });
  }
  uploadFS(fileName: string, fsPath: string) {
    return this.client
      .fPutObject(this.bucket, fileName, fsPath, {
        "Content-Type": mime.contentType(fsPath),
      })
      .then(() => `${this.endpoint}/${this.bucket}/${fileName}`);
  }

  getListObjects(prefix?: string, recursive?: boolean) {
    return new Promise((resolve, reject) => {
      var stream = this.client.listObjects(this.bucket, prefix, recursive);
      stream.on("data", function (obj: any) {
        resolve(obj);
      });
      stream.on("error", function (err: Error) {
        reject(err);
      });
    });
  }
  async getOneObject(fileName: string, fsPath: string) {
    await this.client.fGetObject(this.bucket, fileName, fsPath);
  }
}

export default new Minio();
