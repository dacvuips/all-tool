import _ from "lodash";
import { Model, Types } from "mongoose";

import $ from "mongo-dot-notation";
import { IParseQuery } from "../helpers/parseQuery.helper";
import { BaseEntity, queryErrorNotFound } from "../libs/core";
import { BaseService } from "./service";

export interface IQueryInput {
  page?: number;
  limit?: number;
  offset?: number;
  order?: any;
  filter?: any;
  select?: any;
  search?: string;
}

export interface IPaginationResult<T> {
  data: T[];
  total: number;
  pagination: {
    page: number;
    limit: number;
    offset: number;
    total: number;
  };
}

export abstract class CrudService<T extends BaseEntity> extends BaseService {
  model: Model<T>;

  constructor(model: Model<T>) {
    super();
    this.model = model;
  }

  async fetch(
    queryInput: any,
    {
      onlyTextSearch = false,
      disableTextSearch = false,
      textSearchField = "name",
      select,
    }: {
      onlyTextSearch?: boolean;
      disableTextSearch?: boolean;
      textSearchField?: string;
      select?: string;
    } = {}
  ): Promise<IPaginationResult<T>> {
    queryInput = { ...queryInput };

    if (disableTextSearch && _.has(queryInput, "search")) {
      _.set(queryInput, "filter." + textSearchField, _.get(queryInput, "search"));
      delete queryInput.search;
      if (_.isEmpty(queryInput.filter[textSearchField])) {
        delete queryInput.filter[textSearchField];
      }
    }

    const limit = queryInput.limit || 10;
    let skip = queryInput.offset || (queryInput.page - 1) * limit || 0;
    if (skip < 0) skip = 0;
    const order = queryInput.order;
    const search = queryInput.search;
    const query = this.model.find();

    if (search) {
      if (search.includes(" ")) {
        _.set(queryInput, "filter.$text.$search", search);
        query.select({ _score: { $meta: "textScore" } });
        query.sort({ _score: { $meta: "textScore" } });
      } else {
        const textSearchIndex = this.model.schema
          .indexes()
          .filter((c: any) => _.values(c[0]!).some((d: any) => d == "text"));
        if (textSearchIndex.length > 0) {
          const or: any[] = [];
          /** Replace regular expression */
          const cleanSeach = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          textSearchIndex.forEach((index) => {
            Object.keys(index[0]!).forEach((key) => {
              or.push({ [key]: { $regex: cleanSeach, $options: "i" } });
            });
          });
          _.set(queryInput, "filter.$or", or);
        }
      }
    }

    if (order) {
      query.sort(order);
    }
    if (queryInput.filter) {
      const filter = JSON.parse(
        JSON.stringify(queryInput.filter).replace(/\"(\_\_)(\w+)\"\:/g, `"$$$2":`)
      );
      // reduce $oid to ObjectId
      _.forIn(filter, (value, key) => {
        if (_.has(value, "$oid")) {
          _.set(filter, key, new Types.ObjectId(value.$oid));
        }
      });
      query.setQuery({ ...filter });
    }
    const countQuery = this.model.find().merge(query);
    query.limit(limit);
    query.skip(skip);
    if (select) {
      query.select(select);
    }

    return await Promise.all([query.exec(), countQuery.count()]).then((res) => {
      return {
        data: res[0],
        total: res[1] >= 0 ? res[1] : 0,
        pagination: {
          page: queryInput.page || 1,
          limit: limit,
          offset: skip,
          total: res[1] >= 0 ? res[1] : 0,
        },
      };
    });
  }
  async findAll(options: IParseQuery) {
    const query = this.model.find(options.filter || {});
    if (options.select) {
      query.select(options.select);
    }
    if (options.order) {
      query.sort(options.order);
    }
    query.limit(options.limit || 10);
    if (options.offset) {
      query.skip(options.offset);
    }
    return await query.exec();
  }

  async findOne(filter: any) {
    return await this.model.findOne(filter);
  }

  async count(options: IParseQuery) {
    return await this.model.countDocuments(options.filter).then((res) => (res >= 0 ? res : 0));
  }

  async create(data: any) {
    const result = await this.model.create(data);
    await this.clearCache();
    return result;
  }

  async updateOne(
    id: string,
    data: any,
    options: {
      flatten?: boolean;
    } = {}
  ) {
    const { flatten = false } = options;
    const record = await this.model
      .findOneAndUpdate({ _id: id }, flatten ? $.flatten(data) : { $set: data }, { new: true })
      .orFail(queryErrorNotFound);
    await this.clearCache();
    return record;
  }

  async deleteOne(id: string) {
    let record = await this.model.findById(id).orFail(queryErrorNotFound);
    await record.deleteOne();
    await this.clearCache();
    return record;
  }

  async deleteMany(ids: string[]) {
    let result = await this.model.deleteMany({ _id: { $in: ids } });
    await this.clearCache();
    return result.deletedCount;
  }

  async clearCache() {}
}

export function CRUDService<T extends BaseEntity>(model: Model<T>) {
  abstract class CRUDServiceHost extends CrudService<T> {
    constructor() {
      super(model);
    }
  }

  return CRUDServiceHost;
}
