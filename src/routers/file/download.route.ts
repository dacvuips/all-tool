import Axios from "axios";
import { Request, Response } from "express";

import cache from "../../helpers/cache";

export default [
  {
    method: "get",
    path: "/api/file/download/:token/:fileName",
    midd: [],
    action: async (req: Request, res: Response) => {
      const token = req.params.token;
      const fileUrl = await cache.get("minio-tmp-file-url:" + token);

      if (!fileUrl) {
        res.status(404).send("File not found");
        return;
      }
      return Axios({
        method: "get",
        url: fileUrl,
        responseType: "stream",
      }).then((response) => {
        //ensure that the user can call `then()` only when the file has
        //been downloaded entirely.

        return new Promise((resolve, reject) => {
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
