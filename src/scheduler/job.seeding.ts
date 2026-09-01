import { walkSyncFiles } from "../helpers/common";
import { Agenda } from "./agenda";
import path from "path";
import logger from "../helpers/logger";
import { InitRepeatJobs } from "./repeat";

function defineSchedulerJobs(): void {
  const JobFiles = walkSyncFiles(path.join(__dirname)).filter((f: string) =>
    /(.*).job.js$/.test(f)
  );
  for (const f of JobFiles) {
    const { default: job } = require(f);
    logger.info(`Define Job ${job.jobName}`);
    Agenda.define(job.jobName, { lockLifetime: job.lockLifetime || 10000 }, job.execute);
  }
}

/** Khởi động Agenda + cron (gọi từ server seeding). */
export default async function execute(): Promise<void> {
  logger.info("Seeding Job...");
  defineSchedulerJobs();
  await Agenda.start();
  logger.info("Agenda started");
  InitRepeatJobs();
}
