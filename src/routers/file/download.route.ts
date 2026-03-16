import Axios from "axios";
import { Request, Response } from "express";
import { attachmentService } from "../../libs/dal/attachment";

export default [
  {
    method: "get",
    path: "/api/file/download/:attachmentId/:fileName",
    midd: [],
    action: async (req: Request, res: Response) => {
      const { attachmentId, fileName } = req.params;
      const attachment = await attachmentService.findOne({ _id: attachmentId });

      if (!attachment?.path) {
        res.status(404).send("File not found");
        return;
      }

      const fileUrl = await attachmentService.getSignedDownloadUrl(attachment.path);
      return Axios({
        method: "get",
        url: fileUrl,
        responseType: "stream",
      }).then((response) => {
        //ensure that the user can call `then()` only when the file has
        //been downloaded entirely.

        return new Promise((resolve, reject) => {
          const contentType = response.headers["content-type"];
          if (contentType) {
            res.setHeader("Content-Type", contentType);
          }
          if (fileName) {
            res.setHeader(
              "Content-Disposition",
              `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`
            );
          }
          response.data.pipe(res);
          let error: any;
          res.on("error", (err) => {
            error = err;
            res.sendStatus(500);
            res.statusMessage = err.message;
            reject(err);
          });
          res.on("close", () => {
            if (!error) {
              resolve(true);
            }
          });
        });
      });
    },
  },
];
