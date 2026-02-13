import { MutationOptions, QueryOptions } from "@apollo/client/core";
import cloneDeep from "lodash/cloneDeep";

import { i18n } from "next-i18next";
import { omitDeep, parseQuery } from "../helpers/parser";
import { GraphRepository } from "./graph.repo";

export interface Pagination {
  limit?: number;
  offset?: number;
  page?: number;
  total?: number;
}

export class QueryInput {
  limit?: number;
  page?: number;
  offset?: number;
  search?: string;
  order?: any;
  filter?: any;
}

export interface GetListData<T> {
  data: T[];
  total: number;
  pagination: Pagination;
}

export interface BaseModel {
  id?: string;
  updatedAt?: string;
  createdAt?: string;
  [x: string]: any;
}

export type GetAllOptions = {
  fragment?: string;
  query?: QueryInput;
  cache?: boolean;
  apiName?: string;
  extraParams?: object;
  toast?: any;
};

export abstract class CrudRepository<T extends BaseModel> extends GraphRepository {
  abstract apiName: string;
  abstract displayName: string;
  abstract shortFragment: string;
  abstract fullFragment: string;

  getAllQuery(
    {
      query = { limit: 10 },
      fragment = this.shortFragment,
      apiName,
      extraParams,
    }: {
      query: QueryInput | string;
      fragment?: string;
      apiName?: string;
      extraParams?: object;
    } = {
      query: { limit: 10 },
      extraParams: null,
    }
  ): string {
    if ((query as QueryInput).limit == 0) {
      (query as QueryInput).limit = 1000;
    }

    const api = apiName || `getAll${this.apiName}`;
    return `${api}(${extraParams ? `${parseQuery(extraParams)}, ` : ""}q: ${parseQuery(query, {
      hasBraces: true,
    })}) { data { ${fragment} } total pagination { limit page total } }`;
  }

  async getAll({
    query = { limit: 10 },
    fragment = this.shortFragment,
    cache = true,
    apiName,
    extraParams,
    toast,
  }: GetAllOptions = {}): Promise<GetListData<T>> {
    if ((query as QueryInput).limit == 0) {
      (query as QueryInput).limit = 1000;
    }

    const options = {
      query: this.gql`${this.generateGQL(
        "query",
        `${this.getAllQuery({ query: "$q", fragment, apiName, extraParams })}`,
        `($q: QueryGetListInput!)`
      )}`,
      variables: { q: query },
      fetchPolicy: cache ? "cache-first" : "network-only",
    } as QueryOptions;

    try {
      const result = await this.apollo.query<any>(options);
      this.handleError(result);
      console.log("getAll" + this.apiName, result.data["g0"].data);
      return {
        data: result.data["g0"].data as T[],
        total: result.data["g0"].total,
        pagination: result.data["g0"].pagination,
      };
    } catch (err) {
      if (toast)
        toast.error(
          `${i18n.t("Lấy danh sách")} ${i18n.t(this.displayName) || ""} ${i18n.t(
            "thất bại"
          )}. ${i18n.t(err.message)}`.trim()
        );
      throw err;
    }
  }

  getOneQuery({
    id,
    fragment = this.fullFragment,
    apiName,
  }: {
    id: string;
    fragment?: string;
    apiName?: string;
  }): string {
    const api = apiName || `getOne${this.apiName}`;
    return `${api}(id: "${id}") { ${fragment} }`;
  }

  async getOne({
    id,
    fragment = this.fullFragment,
    cache = true,
    apiName,
    toast,
  }: {
    id: string;
    fragment?: string;
    cache?: boolean;
    apiName?: string;
    toast?: any;
  }) {
    const options = {
      query: this.gql`${this.generateGQL(
        "query",
        `${this.getOneQuery({ id, fragment, apiName })}`
      )}`,
      fetchPolicy: cache ? "cache-first" : "network-only",
    } as QueryOptions;

    try {
      const result = await this.apollo.query(options);
      this.handleError(result);
      console.log("getOne" + this.apiName, result.data["g0"]);
      return result.data["g0"] as T;
    } catch (err) {
      if (toast)
        toast.error(
          `${i18n.t("Lấy dữ liệu")} ${i18n.t(this.displayName) || ""} ${i18n.t(
            "thất bại"
          )}. ${i18n.t(err.message)}`.trim()
        );
      throw err;
    }
  }

  createQuery({
    data,
    fragment = this.fullFragment,
    apiName,
  }: {
    data: Partial<T> | string;
    fragment?: string;
    apiName?: string;
  }): string {
    const api = apiName || `create${this.apiName}`;
    return `${api}(data: ${parseQuery(data, { hasBraces: true })}) { ${fragment} }`;
  }

  async create({
    data,
    fragment = this.fullFragment,
    apiName,
    clearStore = true,
    toast,
  }: {
    data: Partial<T>;
    fragment?: string;
    apiName?: string;
    clearStore?: boolean;
    toast?: any;
  }) {
    try {
      let newData = cloneDeep(data);
      delete newData.id;
      newData = omitDeep(newData, ["__typename", "createdAt", "updatedAt"]);
      const options = {
        mutation: this.gql`${this.generateGQL(
          "mutation",
          `${this.createQuery({ data: "$data", fragment, apiName })}`,
          `($data: Create${this.apiName}Input!)`,
          newData
        )}`,
        variables: { data: newData },
        fetchPolicy: "no-cache",
      } as MutationOptions;

      const result = await this.apollo.mutate(options);
      if (clearStore) {
        await this.clearStore();
      }

      this.handleError(result);
      if (toast)
        toast.success(
          `${i18n.t("Tạo")} ${i18n.t(this.displayName) || ""} ${i18n.t("thành công")}`.trim()
        );
      return result.data["g0"] as T;
    } catch (err) {
      if (toast)
        toast.error(
          `${i18n.t("Tạo")} ${i18n.t(this.displayName) || ""} ${i18n.t("thất bại")}. ${i18n.t(
            err.message
          )}`.trim()
        );
      throw err;
    }
  }

  updateQuery({
    id,
    data,
    fragment = this.fullFragment,
    apiName,
  }: {
    id: string;
    data: Partial<T> | string;
    fragment?: string;
    apiName?: string;
  }): string {
    const api = apiName || `update${this.apiName}`;
    return `${api}(id: "${id}", data: ${parseQuery(data, { hasBraces: true })}) { ${fragment} }`;
  }

  async update({
    id,
    data,
    fragment = this.fullFragment,
    apiName,
    toast,
  }: {
    id: string;
    data: Partial<T>;
    fragment?: string;
    apiName?: string;
    toast?: any;
  }) {
    try {
      let newData = cloneDeep(data);
      delete newData.id;
      newData = omitDeep(newData, ["__typename", "createdAt", "updatedAt"]);
      const options = {
        mutation: this.gql`${this.generateGQL(
          "mutation",
          `${this.updateQuery({ id, data: "$data", fragment, apiName })}`,
          `($data: Update${this.apiName}Input!)`,
          newData
        )}`,
        variables: { data: newData },
        fetchPolicy: "no-cache",
      } as MutationOptions;

      const result = await this.apollo.mutate(options);
      await this.clearStore();
      this.handleError(result);
      if (toast)
        toast.success(
          `${i18n.t("Cập nhật")} ${i18n.t(this.displayName) || ""} ${i18n.t("thành công")}`.trim()
        );
      return result.data["g0"] as T;
    } catch (err) {
      if (toast)
        toast.error(
          `${i18n.t("Cập nhật")} ${i18n.t(this.displayName) || ""} ${i18n.t("thất bại")}. ${i18n.t(
            err.message
          )}`.trim()
        );
      throw err;
    }
  }

  createOrUpdate({
    id,
    data,
    fragment = this.fullFragment,
    createApiName,
    updateApiName,
    toast,
  }: {
    id?: string;
    data: Partial<T>;
    fragment?: string;
    createApiName?: string;
    updateApiName?: string;
    toast?: any;
  }) {
    if (id) {
      return this.update({ id, data, fragment, toast, apiName: createApiName });
    } else {
      return this.create({ data, fragment, toast, apiName: updateApiName });
    }
  }

  deleteQuery({
    id,
    fragment = "id",
    apiName,
    showToast,
  }: {
    id: string;
    fragment?: string;
    apiName?: string;
    showToast?: boolean;
  }): string {
    const api = apiName || `deleteOne${this.apiName}`;
    return `${api}(id: "${id}") { ${fragment} }`;
  }

  async delete({
    id,
    ids,
    fragment = this.shortFragment,
    apiName,
    toast,
  }: {
    id?: string;
    ids?: string[];
    fragment?: string;
    apiName?: string;
    toast?: any;
  }) {
    if (id) {
      const options = {
        mutation: this.gql`${this.generateGQL(
          "mutation",
          `${this.deleteQuery({ id, fragment, apiName })}`
        )}`,
        fetchPolicy: "no-cache",
      } as MutationOptions;

      try {
        const result = await this.apollo.mutate(options);
        await this.clearStore();
        this.handleError(result);
        if (toast)
          toast.success(
            `${i18n.t("Xoá")} ${i18n.t(this.displayName) || ""} ${i18n.t("thành công")}`.trim()
          );
        return result.data["g0"] as T;
      } catch (err) {
        if (toast)
          toast.error(
            `${i18n.t("Xoá")} ${i18n.t(this.displayName) || ""} ${i18n.t("thất bại")}. ${i18n.t(
              err.message
            )}`.trim()
          );
        throw err;
      }
    } else if (ids && ids.length) {
      const options = {
        mutation: this.gql`${this.generateGQL(
          "mutation",
          ids.map((id) => `${this.deleteQuery({ id, fragment })}`)
        )}`,
        fetchPolicy: "no-cache",
      } as MutationOptions;

      try {
        const result = await this.apollo.mutate(options);
        await this.clearStore();
        this.handleError(result);
        if (toast)
          toast.success(
            `${i18n.t("Xoá")} ${i18n.t(this.displayName) || ""} ${i18n.t("thành công")} `.trim()
          );
        return result.data;
      } catch (err) {
        if (toast)
          toast.error(
            `${i18n.t("Xoá")} ${i18n.t(this.displayName) || ""} ${i18n.t("thất bại")} . ${i18n.t(
              err.message
            )}`.trim()
          );
        throw err;
      }
    } else return;
  }

  async getAllOptionsPromise(
    {
      fragment,
      parseOption,
      query,
    }: { fragment?: string; parseOption?: (data: Partial<T>) => Option; query?: QueryInput } = {
      fragment: this.shortFragment,
      parseOption: (data) => ({ value: data.id, label: data.name, data } as Option),
      query: {},
    }
  ) {
    const defaultParseOptions = (data) => ({ value: data.id, label: data.name, data } as Option);
    let res = await this.getAll({
      query: { limit: 0, ...(query || {}) },
      fragment: fragment || this.shortFragment,
    });
    return res.data.map((x) => (parseOption ? parseOption(x) : defaultParseOptions(x)));
  }

  async getAllAutocompletePromise(
    data: { id?: string | string[]; search?: string },
    options: {
      fragment?: string;
      parseOption?: (data: Partial<T>) => Option;
      query?: QueryInput;
      idProperty?: string;
    } = {}
  ) {
    const fragment = options.fragment || this.shortFragment;
    const parseOption =
      options.parseOption || ((data) => ({ value: data.id, label: data.name, data }));
    const query = options.query || {};
    if (data.id) {
      let ids = typeof data.id == "string" ? [data.id] : data.id;
      let res = await this.getAll({
        query: { limit: ids.length, filter: { [options.idProperty || "_id"]: { $in: ids } } },
        fragment,
      });
      return res.data.map((x) => parseOption(x));
    } else {
      let res = await this.getAll({
        query: { limit: 10, search: data.search || "", ...query },
        fragment,
      });
      const options = res.data.map((x) => parseOption(x));

      return options;
    }
  }
  async getAllCreatablePromise(
    {
      inputValue,
      fragment,
      parseOption,
      parseDataObject,
      query,
    }: {
      inputValue?: any;
      fragment?: string;
      parseOption?: (data: Partial<T>) => Option;
      parseDataObject?: (value) => Partial<T>;
      query?: QueryInput;
    } = {
      inputValue: "",
      fragment: this.shortFragment,
      parseOption: (data) => ({ value: data.id, label: data.name, data } as Option),
      parseDataObject: (value) => ({ name: value } as any),
      query: {},
    }
  ) {
    const defaultParseOptions = (data) => ({ value: data.id, label: data.name, data } as Option);
    const defaultParseDataObject = (value) => ({ name: value } as any);
    if (inputValue) {
      let res = await this.create({
        data: parseDataObject ? parseDataObject(inputValue) : defaultParseDataObject(inputValue),
        fragment: fragment || this.shortFragment,
      });
      return parseOption ? parseOption(res) : defaultParseOptions(res);
    } else {
      let res = await this.getAll({
        query: { limit: 0, ...(query || {}) },
        fragment: fragment || this.shortFragment,
      });
      return res.data.map((x) => (parseOption ? parseOption(x) : defaultParseOptions(x)));
    }
  }
}
