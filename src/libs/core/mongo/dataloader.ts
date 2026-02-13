import DataLoader from "dataloader";
import _ from "lodash";
import { Model } from "mongoose";

import { LRUCacheMap } from "../../../packages/lru-cache-map";
import { BaseEntity } from "./entity";
import { Doc } from "./schema";

export function ModelLoader<T extends BaseEntity>(model: Model<T>) {
  let loader: DataLoader<string, Doc<T>>;
  const batchFunction = (ids: string[]) => {
    return model.find({ _id: { $in: ids } } as any).then((list: any[]) => {
      const listByKey = _.keyBy(list, "_id");
      return ids.map((id) => _.get(listByKey, id, undefined));
    });
  };
  const cacheMap = LRUCacheMap({ maxItems: 10000, maxAge: 10 });
  loader = new DataLoader<string, Doc<T>>(
    batchFunction,
    { cacheMap: cacheMap, cache: true } // Giới hạn chỉ cache 100 item sử dụng nhiêu nhất.
  );

  return loader;
}
