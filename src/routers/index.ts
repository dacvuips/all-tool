import path from "path";
import express from "express";
import { walkSyncFiles } from "../helpers/common";
import { BaseError } from "../libs/core";
import logger from "../helpers/logger";

const router = express.Router() as any;
const RouterFiles = walkSyncFiles(path.join(__dirname));

RouterFiles.filter((f) => /(.*).route.js$/.test(f)).map((f) => {
  const { default: routes } = require(f);
  for (const route of routes) {
    router[route.method](route.path, route.midd, (req: express.Request, res: express.Response) =>
      route.action(req, res).catch((error: any) => {
        logger.error("API Request Error:::" + error.message, error);
        if (!(error instanceof BaseError)) {
          error = new BaseError("unknow_error", error.message, 500, false);
          res.status(500).json(error);
        } else {
          res.status(error.httpCode).json({
            error: error.name,
            message: error.description,
          });
        }
      })
    );
  }
});

export default router;
