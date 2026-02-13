import { walkSyncFiles } from "../helpers/common";
import { Agenda } from "./agenda";
import path from "path";
import config from "config";
import logger from "../helpers/logger";
import { InitRepeatJobs } from "./repeat";

export default function execute() {
  logger.info("Seeding Job...");
  Agenda.on("ready", () => {
    logger.info("Agenda Ready");
    Agenda.start().then(async () => {
      logger.info("Agenda started");
      const JobFiles = walkSyncFiles(path.join(__dirname));
      JobFiles.filter((f: any) => /(.*).job.js$/.test(f)).map((f: any) => {
        const { default: job } = require(f);
        logger.info("Define Job " + job.jobName);
        Agenda.define(job.jobName, { lockLifetime: job.lockLifetime || 10000 }, job.execute);
      });
      InitRepeatJobs();
    });
  });

  // async function graceful() {
  //   await Agenda.stop();
  //   process.exit(0);
  // }

  // process.on("SIGTERM", graceful);
  // process.on("SIGINT", graceful);
}
