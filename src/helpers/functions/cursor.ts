import { reject } from "lodash";
import { Cursor } from "mongoose";
import { BatchAsync } from "throttle-batch-size";

export function waitForCursor(cursor: Cursor<any>) {
  return new Promise((resolve) => {
    cursor.on("end", () => {
      resolve(true);
    });

    cursor.on("error", (err) => {
      reject(err);
      cursor.close();
    });
  });
}

export function batchToPromise<T>(batch: BatchAsync<T>) {
  let batchResolver: () => void, batchRejector: (err: Error) => void;
  const batchPromise = new Promise<void>((resolve, reject) => {
    batchResolver = resolve;
    batchRejector = reject;
  });

  batch.on("completed", batchResolver);
  batch.on("error", batchRejector);
  return batchPromise;
}
