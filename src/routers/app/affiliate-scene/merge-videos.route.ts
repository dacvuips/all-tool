/**
 * POST /api/app/merge-videos/
 * Nối nhiều video bằng ffmpeg, trả file MP4.
 * - JSON `{ urls: string[] }` — URL http(s) (video-affiliate-plus)
 * - multipart `videos` — file upload (affiliate-video batch nối file)
 * Không lưu MinIO — client tự tải / lưu IndexedDB.
 */
import { Request, Response } from "express";
import fs from "fs";
import multer from "multer";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { concatVideosToBuffer, isConcatUrlDownloadError } from "../../../helpers/ffmpeg";
import logger from "../../../helpers/logger";
import { id12 } from "../../../helpers/nanoid";
import { Context } from "../../../libs/graphql";

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const MAX_VIDEOS = 20;
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB / file

const multipartUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_VIDEOS },
}).array("videos", MAX_VIDEOS);

function parseMergeMiddleware(req: Request, res: Response, next: (err?: unknown) => void) {
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("multipart/form-data")) {
    return multipartUpload(req, res, next);
  }
  return next();
}

export default [
  {
    method: "post",
    path: "/api/app/merge-videos/",
    midd: [parseMergeMiddleware],
    action: async (req: Request, res: Response) => {
      const tempPaths: string[] = [];
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const urls = Array.isArray(req.body?.urls)
          ? (req.body.urls as unknown[]).map((u) => String(u || "").trim()).filter(Boolean)
          : [];

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        for (const file of files) {
          if (!file?.buffer?.length) continue;
          const tempPath = path.join(tmpdir(), `ff_upload_${id12()}.mp4`);
          await writeFile(tempPath, file.buffer);
          tempPaths.push(tempPath);
        }

        const inputs = [...urls, ...tempPaths];

        if (inputs.length < 2) {
          return res.status(400).json({
            message: "Cần ít nhất 2 video để nối (URL hoặc file upload)",
          });
        }
        if (inputs.length > MAX_VIDEOS) {
          return res.status(400).json({ message: `Tối đa ${MAX_VIDEOS} video mỗi lần nối` });
        }

        logger.info(
          `[merge-videos] Nối ${inputs.length} video (urls=${urls.length}, files=${tempPaths.length}, user ${context.id})`
        );
        const buffer = await concatVideosToBuffer(inputs);

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", String(buffer.length));
        res.setHeader("Content-Disposition", 'inline; filename="merged.mp4"');
        return res.status(200).send(buffer);
      } catch (err: any) {
        logger.error(`[merge-videos] ${err?.message || err}`);
        if (isConcatUrlDownloadError(err)) {
          return res.status(422).json({
            code: err.code,
            message: err.message,
          });
        }
        return res.status(500).json({
          message: err?.message || "Nối video thất bại",
        });
      } finally {
        await Promise.all(tempPaths.map((p) => unlink(p).catch((): void => undefined)));
      }
    },
  },
];
