import DataLoader from "dataloader";
import _, { Dictionary } from "lodash";
import { Model, Types } from "mongoose";
import LRU from "pixl-cache";

import logger from "../logger";

export const BulkUpdateBatcher = (model: Model<any>) =>
  new DataLoader<
    { _id: string; data: any; type?: "set" | "aggregate" | "custom" },
    { err?: string }
  >(async (ids) => {
    // logger.info(`Batch Update Insert Status: ${ids.length}`);
    const bulk = model.collection.initializeUnorderedBulkOp();
    for (const { _id, data, type = "set" } of ids) {
      switch (type) {
        case "custom":
          bulk.find({ _id: new Types.ObjectId(_id) }).updateOne(data);
          break;
        case "set":
          bulk.find({ _id: new Types.ObjectId(_id) }).updateOne({ $set: data });
          break;
        case "aggregate":
          bulk.find({ _id: new Types.ObjectId(_id) }).update(data);
          break;
      }
    }
    const bulkWriteResult = await bulk.execute().catch((err) => err.result);
    const writeErrors: any = _.keyBy(bulkWriteResult.getWriteErrors(), "index");
    return ids.map(({ _id }, index) => {
      if (writeErrors[index]) {
        return { err: writeErrors[index].errmsg };
      }
      return { err: null };
    });
  });

export const BulkUpsertBatcher = (model: Model<any>) =>
  new DataLoader<{ filter: any; data: any }, { err?: string }>(async (ids) => {
    // logger.info(`Batch Update Insert Status: ${ids.length}`);
    const bulk = model.collection.initializeUnorderedBulkOp();
    for (const { filter, data } of ids) {
      bulk.find(filter).upsert().updateOne(data);
    }
    const bulkWriteResult = await bulk.execute().catch((err) => err.result);
    const writeErrors: any = _.keyBy(bulkWriteResult.getWriteErrors(), "index");
    return ids.map((__, index) => {
      if (writeErrors[index]) {
        return { err: writeErrors[index].errmsg };
      }
      return { err: null };
    });
  });

export function findAndKeyBy<T>(
  model: any,
  options: {
    select?: string;
    key?: string;
    filter?: any;
    lean?: boolean;
  } = {}
): Promise<Dictionary<T>> {
  const { select = "_id code name", key = "_id", filter = {}, lean = true } = options;
  const query = model.find(filter).select(select);
  if (lean) {
    query.lean();
  }
  return query.then((res: any) => _.keyBy(res, key));
}

export function getModelLeanDataLoader(
  model: any,
  options: { select?: string; key?: string; maxSize?: number; maxAge?: number } = {}
) {
  options = _.defaultsDeep(options, {
    select: "_id code name",
    key: "_id",
    maxSize: 10000,
    maxAge: 30, // 30s
  });

  const loader = new DataLoader(
    (ids: string[]) => {
      logger.debug(`Model Clean Loader [${model.modelName}] load more: ` + ids.length);
      return model
        .find({ [options.key]: { $in: ids } })
        .select(options.select)
        .lean()
        .exec()
        .then((res: any[]) => {
          const keyById = _.keyBy(res, options.key);
          return ids.map((id) => keyById[id]);
        });
    },
    { cache: true, cacheMap: new LRU({ maxItems: options.maxSize, maxAge: options.maxAge }) }
  );
  return loader;
}
