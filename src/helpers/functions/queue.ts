import { Job } from "bee-queue";

export function jobToPromise(job: Job<any>) {
  return new Promise((resolve, reject) => {
    job.on("succeeded", (data) => {
      resolve(data);
    });
    job.on("failed", (err) => {
      reject(err);
    });
  });
}
