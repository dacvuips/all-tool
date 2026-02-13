import DataLoader from "dataloader";
import _ from "lodash";
import LRUMap from "pixl-cache";

import { AddressModel, IAddress } from "../../libs/dal/address";
import { DataLoaderFactory } from "../../packages/dataloader-factory";
import { WalletModel } from "../../libs/dal/wallet";

function createLRUCache({
  maxItems = 10000,
  maxAge = 30,
}: { maxItems?: number; maxAge?: number } = {}) {
  return new LRUMap({ maxItems, maxAge });
}

export const ModelDataLoader = {
  address: {
    province: new DataLoader<string, IAddress>(
      (ids: string[]) => {
        return AddressModel.aggregate([
          { $match: { provinceId: { $in: ids } } },
          { $group: { _id: "$provinceId", province: { $first: "$province" } } },
        ]).then((res) => {
          const keyByIds = _.keyBy(res, "_id");
          return ids.map((id) => keyByIds[id]);
        });
      },
      { cache: true, cacheMap: createLRUCache() }
    ),
    district: new DataLoader<string, IAddress>(
      (ids: string[]) => {
        return AddressModel.aggregate([
          { $match: { districtId: { $in: ids } } },
          {
            $group: {
              _id: "$districtId",
              district: { $first: "$district" },
              provinceId: { $first: "$provinceId" },
            },
          },
        ]).then((res) => {
          const keyByIds = _.keyBy(res, "_id");
          return ids.map((id) => keyByIds[id]);
        });
      },
      { cache: true, cacheMap: createLRUCache() }
    ),
    ward: new DataLoader<string, IAddress>(
      (ids: string[]) => {
        return AddressModel.find({ wardId: { $in: ids } }).then((res) => {
          const keyByIds = _.keyBy(res, "wardId");
          return ids.map((id) => keyByIds[id]);
        });
      },
      { cache: true, cacheMap: createLRUCache() }
    ),
    districts: new DataLoader<string, { id: string; district: string }[]>(
      (ids: string[]) => {
        return AddressModel.aggregate([
          {
            $match: { provinceId: { $in: ids }, districtId: { $ne: null }, wardId: { $eq: null } },
          },
          {
            $group: {
              _id: "$provinceId",
              districts: { $push: { id: "$districtId", district: "$district" } },
            },
          },
        ]).then((res) => {
          const keyByIds = _.keyBy(res, "_id");
          return ids.map((id) => _.sortBy(_.get(keyByIds, id + ".districts", []), ["district"]));
        });
      },
      { cache: true, cacheMap: createLRUCache() }
    ),
    wards: new DataLoader<string, { id: string; ward: string }[]>((ids: string[]) => {
      return AddressModel.aggregate([
        {
          $match: { districtId: { $in: ids }, wardId: { $ne: null } },
        },
        {
          $group: {
            _id: "$districtId",
            wards: { $push: { id: "$wardId", ward: "$ward" } },
          },
        },
      ]).then((res) => {
        const keyByIds = _.keyBy(res, "_id");
        return ids.map((id) => _.sortBy(_.get(keyByIds, id + ".wards", []), ["ward"]));
      });
    }),
  },
  wallet: {
    ownerId: DataLoaderFactory.lean(WalletModel, {
      key: "ownerId",
      select: "_id ownerId balance totalIn totalOut times isLocked transactionNoun",
    }),
  },
};
