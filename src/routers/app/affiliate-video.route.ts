import { Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import { TOKEN_ROLES } from "../../constants/role.const";
import logger from "../../helpers/logger";
import minio from "../../helpers/minio";
import { AttachmentModel, attachmentService } from "../../libs/dal/attachment";
import { Context } from "../../libs/graphql";

export default [
  {
    method: "post",
    path: "/api/app/affiliate-video/",
    midd: [
      multer({ dest: "./uploads/", limits: { fileSize: 26214400 } }).fields([
        { name: "file", maxCount: 1 },
        { name: "image", maxCount: 1 },
        { name: "video", maxCount: 1 },
      ]),
    ], // 25mb limit
    action: async (req: Request, res: Response) => {
      let uploadedFile: Express.Multer.File | undefined;
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
        uploadedFile = files?.file?.[0] || files?.image?.[0] || files?.video?.[0];
        if (!uploadedFile) {
          return res.status(400).json({ message: "Không tìm thấy file upload" });
        }

        const attachment = new AttachmentModel({
          ownerId: context.id,
          name: uploadedFile.originalname,
          size: uploadedFile.size,
          mimetype: uploadedFile.mimetype,
          processing: false,
        });
        const fileName = `${context.id}/${attachment._id.toString()}-${uploadedFile.originalname}`;
        logger.info(`Tải lên tập tin ${fileName}`);
        const file = await minio.upload(fileName, uploadedFile);
        const { etag, link: directLink, bucket } = file;
        attachment.etag = etag;
        attachment.bucket = bucket;
        attachment.path = fileName;
        await attachment.save();
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const downloadUrl = attachmentService.getPermanentDownloadUrl(
          { _id: attachment._id, name: attachment.name },
          baseUrl
        );
        const json = attachment.toJSON();
        const response = {
          ...json,
          id: attachment._id.toString(),
          link: downloadUrl,
          downloadUrl,
          directLink,
        };
        await context.log(`Tải lên tập tin: ${attachment.name}`);
        res.json(response);
      } finally {
        if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
          fs.unlinkSync(uploadedFile.path);
        }
      }
    },
  },
];
