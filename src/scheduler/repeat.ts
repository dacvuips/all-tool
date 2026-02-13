import config from "config";
import _ from "lodash";

import logger from "../helpers/logger";
import { Agenda } from "./agenda";

export function InitRepeatJobs() {
  logger.info("Generating Repeat Jobs");
  // const PreprocessGameCardOrderJob = "";
  const JOBS: {
    job: any;
    crontab: string;
    data?: any;
    option?: any;
  }[] = [
    // repeat every 30 minutes
    // { job: PreprocessGameCardOrderJob, crontab: "*/30 * * * *" },
    // repeat every day at 23:55
  ];

  for (const { job, crontab, data = {}, option = {} } of JOBS) {
    const defaultOption = _.defaultsDeep(option, {
      skipImmediate: true,
      timezone: config.get<string>("tz"),
    });
    job.create(data).repeatEvery(crontab, defaultOption).unique({ name: job.jobName }).save();
  }

  // remove duplicate jobs
  const removeDuplicateJobs = async () => {
    for (const { job } of JOBS) {
      const jobs = await Agenda.jobs({ name: job.jobName });
      if (jobs.length > 1) {
        logger.info(`Removing duplicate jobs for ${job.jobName}`);
        // remove all jobs except the first one
        jobs.slice(1).map((j) => j.remove());
      }
    }
  };

  removeDuplicateJobs();
}
