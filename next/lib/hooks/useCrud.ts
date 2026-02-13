import cloneDeep from "lodash/cloneDeep";
import { useEffect, useState } from "react";

import { useToast } from "../providers/toast-provider";
import { BaseModel, CrudRepository, Pagination, QueryInput } from "../repo/crud.repo";
import { useMemoCompare } from "./useMemoCompare";

export interface CrudProps<T extends BaseModel> extends ReactProps {
  items?: T[];
  pagination?: Pagination;
  setPagination?: (pagination: Pagination) => any;
  page?: number;
  setPage?: (page: number) => any;
  query: QueryInput;
  loading?: boolean;
  loadAll?: (refresh: boolean) => Promise<T[]>;
  loadMore?: () => Promise<T[]>;
  create?: (data: Partial<T>) => Promise<Partial<T>>;
  update?: (id: string, data: Partial<T>) => Promise<Partial<T>>;
  deleteOne?: (id: string) => Promise<any>;
  updateItem?: ({ id, data }: { id: string; data: Partial<T> }) => any;
}
export function useCrud<T>(
  service: CrudRepository<T>,
  query: QueryInput = {},
  fragment?: string,
  fetchingCondition?: any
) {
  const [items, setItems] = useState<T[]>();
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    page: query.page || 1,
    limit: query.limit || 10,
  });
  const toast = useToast();
  const newQuery = useMemoCompare(query);

  const loadAll = (refresh: boolean = false) => {
    setLoading(true);
    return service
      .getAll({
        query: { ...newQuery, limit: pagination.limit, page: pagination.page },
        fragment,
        toast,
        cache: !refresh,
      })
      .then((res) => {
        setItems(cloneDeep(res.data));
        setPagination(res.pagination);
        return res.data;
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const loadMore = () => {
    setLoading(true);
    return service
      .getAll({
        query: {
          ...newQuery,
          limit: pagination.limit,
          page: pagination.page,
          offset: items.length,
        },
        fragment,
        toast,
      })
      .then((res) => {
        setItems([...items, ...cloneDeep(res.data)]);
        setPagination(res.pagination);
        return res.data;
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const create = async (data: T) =>
    await service.create({ data, toast }).then((res) => {
      loadAll();
      return res;
    });

  const deleteOne = async (id: string) =>
    await service.delete({ id, toast }).then((res) => {
      loadAll();
      return res;
    });
  const update = async (id: string, data: T) =>
    await service.update({ id, data, toast }).then((res) => {
      loadAll();
      return res;
    });

  useEffect(() => {
    loadAll();
  }, [newQuery, pagination.page]);

  const setPage = (page: number) => {
    setPagination({ ...pagination, page });
  };

  const updateItem = ({ id, data }: { id: string; data: Partial<T> }) => {
    const item = items.find((x) => (x as any).id == id);
    if (item) {
      for (let key of Object.keys(data)) {
        item[key] = data[key];
      }
    }
    setItems([...items]);
  };

  useEffect(() => {
    if (fetchingCondition === undefined || fetchingCondition) {
      loadAll();
    } else {
      setItems(null);
      setLoading(false);
    }
  }, [newQuery, pagination.page, fetchingCondition]);

  return {
    items,
    pagination,
    setPagination,
    page: pagination.page,
    setPage,
    query: newQuery,
    loading,
    loadAll,
    loadMore,
    deleteOne,
    create,
    update,
    updateItem,
  };
}
