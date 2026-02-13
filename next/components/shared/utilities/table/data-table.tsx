import cloneDeep from "lodash/cloneDeep";
import isEqual from "lodash/isEqual";
import {
  createContext,
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useTranslation } from "react-i18next";
import { useInterval } from "../../../../lib/hooks/useInterval";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { BaseModel, CrudRepository, Pagination, QueryInput } from "../../../../lib/repo/crud.repo";
import { Table } from "./table";
import { TableForm } from "./table-form";
import { TableHeader } from "./table-header";
import { TablePagination } from "./table-pagination";
import { TableToolbar } from "./table-toolbar";

interface DataTableProps<T extends BaseModel> extends ReactProps {
  title?: string;
  itemName?: string;
  fragment?: string;
  formFragment?: string;
  apiName?: string;
  limit?: number;
  filter?: any;
  order?: any;
  multiSelection?: boolean;
  createItem?: () => any;
  createItemHref?: () => string;
  updateItem?: (item: Partial<T>) => any;
  updateItemHref?: (item: Partial<T>) => string;
  postProcessItem?: (item: Partial<T>) => Partial<T>;
  crudService?: CrudRepository<Partial<T>>;
  extraParams?: object;
  autoRefresh?: number;
  onSelectItems?: (items: Partial<T>[]) => any;
  // fetching only when condition is met
  fetchingCondition?: () => boolean;
}
export function DataTable<T extends BaseModel>({
  crudService,
  limit = 10,
  order = { _id: -1 },
  multiSelection = false,
  ...props
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [loadDone, setLoadDone] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingItem, setLoadingItem] = useState<string>("");
  let [filter, setFilter] = useState({});
  const [search, setSearch] = useState("");
  const [currentOrder, setCurrentOrder] =
    useState<{ property: string; type: "asc" | "desc" }>(null);
  const [items, setItems] = useState<Partial<T>[]>(null);
  const [selectedItems, setSelectedItems] = useState<Partial<T>[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    total: 0,
    limit: limit,
  });
  const [formItem, setFormItem] = useState(null);
  let [queryNumber] = useState(0);
  let [isLoading] = useState(false);
  const toast = useToast();
  const alert = useAlert();
  const itemName = useMemo(
    () => props.itemName || `${crudService.displayName.toLowerCase()}`,
    [props.itemName, crudService]
  );
  const title = useMemo(
    () => props.title || `${t("Danh sách")} ${t(itemName)}`,
    [props.title, itemName]
  );
  useEffect(() => {
    if (props.onSelectItems) {
      props.onSelectItems(selectedItems);
    }
  }, [selectedItems]);

  useEffect(() => {
    setLoadDone(true);
  }, []);

  useInterval(async () => {
    if (!isLoading && !refreshing) {
      await loadAll(true, false);
    }
  }, props.autoRefresh);

  useEffect(() => {
    if (loadDone) {
      loadAll();
    }
  }, [
    loadDone,
    search,
    filter,
    props.filter,
    currentOrder,
    pagination.page,
    pagination.limit,
    props.extraParams,
  ]);

  const waitUntil = (condition) => {
    return new Promise((resolve) => {
      let interval = setInterval(() => {
        if (!condition()) {
          return;
        }

        clearInterval(interval);
        resolve(true);
      }, 100);
    });
  };

  const changeRowData = async (item: T, property: string, value: any) => {
    let newItems = cloneDeep(items);
    const row = newItems.find((x) => x.id == item.id);
    if (row) {
      (row as any)[property] = value;
      setItems([...newItems]);
    }
  };

  const loadAll = async (refresh = false, showLoading: boolean = true) => {
    if (props.fetchingCondition && !props.fetchingCondition()) {
      return;
    }
    if (refreshing) {
      await waitUntil(() => !refreshing);
    }
    if (showLoading) {
      setLoadingItems(true);
    }
    isLoading = true;
    if (refresh) {
      await crudService.clearStore();
      setSelectedItems([]);
    }
    const currentQueryNumber = queryNumber + 1;
    queryNumber = currentQueryNumber;
    let query: QueryInput = {
      limit: pagination.limit,
      page: pagination.page,
      filter: { ...filter, ...props.filter },
      order: {
        ...(currentOrder ? { [currentOrder.property]: currentOrder.type == "asc" ? 1 : -1 } : {}),
        ...order,
      },
      search,
    };
    await crudService
      .getAll({
        query,
        fragment: props.fragment,
        apiName: props.apiName,
        extraParams: props.extraParams,
        toast,
      })
      .then((res) => {
        if (currentQueryNumber != queryNumber) return;
        setItems(
          res.data?.map((x) => (props.postProcessItem ? props.postProcessItem(x) : x)) || []
        );
        if (showLoading) {
          setLoadingItems(false);
        }
        setPagination({ ...pagination, ...res.pagination });
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        isLoading = false;
      });
  };

  const onFilterChange = (registeredFilter: any) => {
    let newFilter = { ...filter, ...registeredFilter };
    newFilter = Object.keys(newFilter)
      .filter(
        (key) => newFilter[key] !== "" && newFilter[key] !== undefined && newFilter[key] !== null
      )
      .reduce((obj, key) => {
        obj[key] = newFilter[key];
        return obj;
      }, {});
    if (!isEqual(filter, newFilter)) {
      filter = newFilter;
      setFilter(newFilter);
    }
  };

  const onSearchChange = (search: string) => {
    setSearch(search);
  };

  const onCreateItem = async () => {
    if (props.createItem || props.createItemHref) {
      if (props.createItem) await props.createItem();
    } else {
      setFormItem({});
    }
  };

  const onUpdateItem = async (item: Partial<T>) => {
    if (props.updateItem || props.updateItemHref) {
      if (props.updateItem) await props.updateItem(item);
    } else {
      setLoadingItem(item.id);
      try {
        let res = await crudService.getOne({
          id: item.id,
          toast,
          fragment: props.formFragment || crudService.fullFragment,
        });
        setFormItem(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingItem("");
      }
    }
  };

  const onDeleteItem = async (item: Partial<T>) => {
    let name: string = item.name || item.title || item.code;
    if (name && name.length > 25) {
      name = name.slice(0, 22) + "...";
    }
    if (
      !(await alert.danger(
        `${t("Xoá")} ${t(itemName)}`,
        `${t("Bạn có chắn chắn muốn xoá")} ${t(itemName)} ${name ? `'${name}'` : t("này")} ${t(
          "không"
        )}?`
      ))
    )
      return;

    try {
      await crudService.delete({ id: item.id, toast });
      await loadAll();
    } catch (err) {}
  };

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await loadAll(true);
    } finally {
      setRefreshing(false);
    }
  };

  const saveItem = async (data: Partial<T>) => {
    try {
      let item = await crudService.createOrUpdate({ id: formItem.id, data, toast });
      setFormItem(null);
      return item;
    } catch (err) {
      console.error("error272", t(err.message));
      throw err;
    }
  };

  return (
    <DataTableContext.Provider
      value={{
        crudService,
        title,
        itemName,
        pagination,
        setPagination,
        items,
        loadingItems,

        loadingItem,
        search,
        onSearchChange,
        filter,
        onFilterChange,
        refreshing,
        onRefresh,
        multiSelection,
        selectedItems,
        setSelectedItems,
        formItem,
        setFormItem,
        currentOrder,
        setCurrentOrder,
        createItemHref: props.createItemHref,
        updateItemHref: props.updateItemHref,
        onCreateItem,
        onUpdateItem,
        onDeleteItem,
        saveItem,
        loadAll,
        changeRowData,
      }}
    >
      {props.children}
    </DataTableContext.Provider>
  );
}

interface DataTableContextProps<T extends BaseModel> extends ReactProps {
  crudService: CrudRepository<Partial<T>>;
  title: string;
  itemName: string;
  pagination: Pagination;
  setPagination: (val: Pagination) => any;
  items: T[];
  loadingItems: boolean;
  loadingItem: string;
  search: string;
  onSearchChange: (search: string) => any;
  filter: any;
  onFilterChange: (filter: any) => any;
  refreshing: boolean;
  onRefresh: () => any;
  multiSelection: boolean;
  selectedItems: T[];
  setSelectedItems: Dispatch<SetStateAction<Partial<T>[]>>;
  formItem: any;
  setFormItem: (val: boolean) => any;
  currentOrder: { property: string; type: "asc" | "desc" };
  setCurrentOrder: (val: { property: string; type: "asc" | "desc" }) => any;
  createItemHref: () => string;
  updateItemHref: (item: T) => string;
  onCreateItem: () => Promise<any>;
  onUpdateItem: (item: Partial<T>) => Promise<any>;
  onDeleteItem: (item: Partial<T>) => Promise<any>;
  saveItem: (data: Partial<T>) => Promise<Partial<T>>;
  loadAll: (refresh?: boolean) => Promise<any>;
  changeRowData: (item: T, property: string, value: any) => Promise<any>;
}
const DataTableContext = createContext<Partial<DataTableContextProps<BaseModel>>>({});
export const useDataTable = () => useContext(DataTableContext);

export const TableDivider = () => <hr className="my-3 border-0 border-t border-gray-200" />;

DataTable.Divider = TableDivider;

DataTable.Header = TableHeader;
DataTable.Title = TableHeader.Title;
DataTable.Buttons = TableHeader.Buttons;
DataTable.Button = TableHeader.Button;

DataTable.Toolbar = TableToolbar;
DataTable.Search = TableToolbar.Search;
DataTable.Filter = TableToolbar.Filter;

DataTable.Table = Table;
DataTable.Column = Table.Column;
DataTable.CellAction = Table.CellAction;
DataTable.CellButton = Table.CellButton;
DataTable.CellDate = Table.CellDate;
DataTable.CellImage = Table.CellImage;
DataTable.CellNumber = Table.CellNumber;
DataTable.CellBoolean = Table.CellBoolean;
DataTable.CellStatus = Table.CellStatus;
DataTable.CellText = Table.CellText;

DataTable.Pagination = TablePagination;
DataTable.Form = TableForm;

DataTable.Consumer = DataTableContext.Consumer;
