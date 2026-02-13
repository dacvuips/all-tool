import _, { cloneDeep } from "lodash";
import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState } from "react";
import { ParamName } from "../../../../lib/constants/constants";
import { useQueryParams } from "../../../../lib/hooks/useQueryParams";
import { Category, CategoryService, Product, ProductService } from "../../../../lib/repo";
import { Pagination } from "../../../../lib/repo/crud.repo";
import { SortDirection } from "../../../../lib/repo/types";

export const HomeContext = createContext<
  Partial<{
    openHomePopupNotify: boolean;
    setOpenHomePopupNotify: (value: boolean) => void;
    queryParam: Record<string, any>;
    setQueryParam: (value: Record<string, any>) => void;
    loading: boolean;
    loadingMore: boolean;
    products: Product[];
    categories?: Category;
    setPagination: (value: Pagination) => void;
    selectCategory?: Category;
    queryProperty: any;
    loadMore?: () => void;
  }>
>({});

export function HomeProvider({ ...props }) {
  const router = useRouter();
  const [openHomePopupNotify, setOpenHomePopupNotify] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectCategory, setSelectCategory] = useState<Category>();
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 30 });
  const params = {
    [ParamName.categoryId]: "",
    [ParamName.search]: "",
    [ParamName.minPrice]: "",
    [ParamName.maxPrice]: "",
    [ParamName.sort]: "",
  };
  const transformedData = categories
    ?.map((property) => ({ [property.key]: "" }))
    ?.reduce((result, item) => {
      return _.merge(result, item);
    }, {});
  const paramMerge = _.merge(params, transformedData);
  const [queryParam, setQueryParam] = useQueryParams(paramMerge);
  const {
    [ParamName.categoryId]: categoryId,
    [ParamName.search]: search,
    [ParamName.type]: type,
    [ParamName.minPrice]: minPrice,
    [ParamName.maxPrice]: maxPrice,
    [ParamName.sort]: sort,
    ...queryProperty
  } = router.query;

  useEffect(() => {
    loadCategories();
  }, []);
  useEffect(() => {
    loadProducts();
  }, [queryParam]);

  useEffect(() => {
    categories?.map((item) => {
      if (item.id == categoryId) {
        setSelectCategory(item);
      }
    });
  }, [categoryId, categories]);

  const loadProducts = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const { categoryId, search, type, parseData, minPrice, maxPrice } = handleParseData();

      const page = isLoadMore ? pagination.page + 1 : 1;

      await ProductService.getActiveProducts({
        filter: {
          ...(parseData.length > 0 && { $or: parseData }),
          ...(categoryId && { categoryId }),
          ...(type && { type }),
          ...(minPrice || maxPrice
            ? {
                minPrice: {
                  $gte: +minPrice || 0,
                  $lte: +maxPrice || Number.MAX_SAFE_INTEGER,
                },
              }
            : {}),
        },
        limit: pagination.limit,
        order: sort ? { minPrice: sort === SortDirection.Asc ? 1 : -1 } : { createdAt: -1 },
        page: page,
        ...(search && { search: search as string }),
      }).then((res) => {
        setProducts(isLoadMore ? [...products, ...cloneDeep(res.data)] : cloneDeep(res.data));

        setPagination({
          ...pagination,
          total: res.total,
          page: res.pagination.page,
        });
      });
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };
  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await CategoryService.getActiveCategories();
      setCategories(res.data);
    } catch (error) {
      console.error("Failed to load categories:", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const date = new Date().getTime();
    const getStoragePopup = localStorage.getItem("home-popup-notify") || 0;
    if (+getStoragePopup < date) {
      setOpenHomePopupNotify(true);
    }
  }, []);

  const handleValue = (value: string) => {
    const numberValue = +value;
    return !isNaN(numberValue) ? numberValue : value;
  };

  const handleParseData = () => {
    const parseData = [];

    for (const prop in queryProperty) {
      if (queryProperty.hasOwnProperty(prop)) {
        const value = queryProperty[prop] as any;

        parseData.push({
          [`categoryProperties.${prop}`]: handleValue(value),
        });
      }
    }

    return { parseData, type, search, categoryId, minPrice, maxPrice };
  };

  return (
    <HomeContext.Provider
      value={{
        openHomePopupNotify,
        setOpenHomePopupNotify,
        queryParam,
        setQueryParam,
        loading,
        loadingMore,
        products,
        categories,
        setPagination,
        selectCategory,
        queryProperty,
        loadMore: () => loadProducts(true),
      }}
    >
      {props.children}
    </HomeContext.Provider>
  );
}

export const useHomeContext = () => useContext(HomeContext);
