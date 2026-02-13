import DataLoader from "dataloader";
import _ from "lodash";
import { Model, Document } from "mongoose";
import { BaseEntity } from "../../libs/core";
import { LRUCacheMap } from "../lru-cache-map";

type LeanDataLoaderOption = {
  select?: string;
  key?: string;
  maxSize?: number;
  maxAge?: number;
};

export class DataLoaderFactory {
  static lean<T extends BaseEntity>(model: Model<T>, options: LeanDataLoaderOption = {}) {
    options = _.defaultsDeep(options, {
      select: "_id code name",
      key: "_id",
      maxSize: 10000,
      maxAge: 30, // 30s
    });
    const loader = new DataLoader<string, T>(
      (ids: string[]) => {
        // logger.debug(`Model Clean Loader [${model.modelName}] load more: ` + ids.length);
        return model
          .find({ [options.key]: { $in: ids } } as any)
          .select(options.select)
          .lean()
          .exec()
          .then((res: any[]) => {
            const keyById = _.keyBy(res, options.key);
            return ids.map((id) => keyById[id]);
          });
      },
      { cache: true, cacheMap: LRUCacheMap({ maxItems: options.maxSize, maxAge: options.maxAge }) }
    );
    return loader;
  }
}
