/**
 * art-style-picker-dialog.tsx
 * Shared component: Field with button that opens a Dialog showing art style categories + items grid.
 * Similar pattern to ObjectPersonifyPickerDialog but with trending-category-list UI.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsMagic } from "react-icons/bs";
import { CgSpinner } from "react-icons/cg";
import {
  RiAddLine,
  RiDeleteBin6Line,
  RiEdit2Line,
  RiEyeLine,
  RiFileList3Line,
  RiFireFill,
  RiFireLine,
  RiRefreshLine,
  RiSearchLine,
  RiUserHeartFill,
} from "react-icons/ri";
import { parseNumber } from "../../../../lib/helpers/parser";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { ArtStyleCategoryService } from "../../../../lib/repo/list/artStyleCategory.repo";
import { NotifyText } from "../../../shared/common/notify-text";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Switch,
  Textarea,
} from "../../../shared/utilities/form";
import { Img } from "../../../shared/utilities/misc";
import { PaginationComponent } from "../../../shared/utilities/pagination/pagination-component";
import {
  ArtStyleCategoryPublicItem,
  ArtStylePublicItem,
  CustomerArtStyleInput,
  useAffiliateVideoApi,
} from "../hook/useAffiliateVideoApi";

const ITEMS_PER_PAGE = 42;
const ALL_CATEGORY_ID = "__all__";
const MY_ART_STYLE_ID = "__my__";

export interface ArtStylePickerDialogProps {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  onCodeChange?: (code: string) => void;
  label?: string;
  noError?: boolean;
}

// -- ArtStyleCard
const ArtStyleCard = ({
  item,
  onUse,
  onEdit,
  onDelete,
  onShowInfo,
}: {
  item: ArtStylePublicItem;
  onUse: (id: string, name: string) => void;
  onEdit?: (item: ArtStylePublicItem) => void;
  onDelete?: (item: ArtStylePublicItem) => void;
  onShowInfo?: (item: ArtStylePublicItem) => void;
}) => {
  const { t } = useTranslation();
  const img = item.imageUrls?.[0];
  return (
    <div className="group relative rounded-xl overflow-hidden bg-white p-1.5 gap-2 transition-all duration-300 border border-primary-dark flex flex-col hover:shadow-2xl cursor-pointer hover:shadow-primary-100 hover:border-success-dark hover:border-2">
      <div className="aspect-[4/3] overflow-hidden relative">
        <Img
          lazyload={false}
          showImageOnClick
          rounded
          src={img}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div
          className={`text-lg absolute -bottom-0.5 -left-0.5 p-1 bg-white rounded-l-none rounded-br-none rounded-tr-xl font-semibold ${
            item.price === 0 ? "text-success" : "text-red-500"
          }`}
        >
          {item.price === 0 ? t("Miễn phí") : parseNumber(item.price, "VND")}
        </div>
      </div>

      {/* Edit/Delete buttons for customer's own items */}
      {onEdit && onDelete && (
        <div className="absolute top-2 left-2 z-10 flex p-1 gap-2 opacity-100 transition-opacity border bg-white bg-opacity-80 rounded-lg border-white">
          <Button
            onClick={(e: any) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="px-0 h-7"
            tooltip={t("Sửa")}
            icon={<RiEdit2Line className="text-lg text-blue-500" />}
          />
          {!item.isActive && (
            <Button
              onClick={(e: any) => {
                e.stopPropagation();
                onDelete(item);
              }}
              className="px-0 h-7"
              tooltip={t("Xóa")}
              icon={<RiDeleteBin6Line className="text-lg text-red-500" />}
            />
          )}
        </div>
      )}

      <div className="flex items-start gap-2 w-full">
        <div className="flex items-center gap-1.5 justify-between min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Button
              onClick={(e: any) => {
                e.stopPropagation();
                onUse(item.id, item.name);
              }}
              outline
              info
              className="rounded-lg px-1 h-7 whitespace-nowrap font-normal text-10"
              text={t("Dùng ngay")}
              icon={<BsMagic className="text-14" />}
            />
            {(item.des || onShowInfo) && (
              <Button
                onClick={(e: any) => {
                  e.stopPropagation();
                  if (onShowInfo) onShowInfo(item);
                }}
                className="rounded-full p-0.5 h-7 w-7 border bg-white hover:bg-blue-50"
                tooltip={t("Xem hướng dẫn")}
                icon={<RiFileList3Line className="text-20 text-blue-400" />}
              />
            )}
          </div>
        </div>
      </div>
      <div className="flex-1 font-bold text-primary line-clamp-1 leading-snug m-0 items-center pl-1">
        {item.name}
      </div>
      {item.promptShort && (
        <div className="bg-white rounded-lg border border-gray-200 border-dashed">
          <p className="text-12 text-gray-400 leading-relaxed line-clamp-3 m-0 max-w-full overflow-ellipsis text-ellipsis-2 px-2">
            {item.promptShort}
          </p>
        </div>
      )}
      <div className="mt-auto flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiFireLine className="text-orange-400/70 text-xs" />
          {item.count || 0}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiEyeLine className="text-gray-500 text-xs" />0
        </span>
      </div>
    </div>
  );
};

// -- CategoryTabBar
const CategoryTabBar = ({
  categories,
  activeId,
  onSelect,
}: {
  categories: ArtStyleCategoryPublicItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) => {
  const { t } = useTranslation();
  const tabs = useMemo(() => {
    const allTab = { id: ALL_CATEGORY_ID, name: t("Tất cả"), isHot: false };
    const myTab = {
      id: MY_ART_STYLE_ID,
      name: (
        <div className="whitespace-nowrap gap-1 flex">
          <RiUserHeartFill />
          {t("Của tôi")}
        </div>
      ),
      isHot: false,
    };
    return [allTab, myTab, ...categories.map((c) => ({ id: c.id, name: c.name, isHot: c.isHot }))];
  }, [categories, t]);
  return (
    <div className="relative flex-shrink-0 flex flex-row gap-2 items-center">
      <div
        className="flex items-center gap-1.5 overflow-x-auto v-scrollbar py-1 w-full pb-2 no-scrollbar rounded-lg px-1.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs bg-white whitespace-nowrap font-semibold transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                  : "text-gray hover:text-gray-200 border border-gray-200"
              }`}
            >
              {tab.isHot && <RiFireFill className="text-orange text-12" />}
              {tab.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// -- DescriptionInfoDialog – Dialog hiển thị mô tả (des)
const DescriptionInfoDialog = ({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: ArtStylePublicItem | null;
}) => {
  const { t } = useTranslation();
  if (!item) return null;
  return (
    <Dialog
      slideFromBottom="none"
      isOpen={isOpen}
      onClose={onClose}
      title={item.name}
      width="480px"
      maxWidth="95vw"
    >
      <Dialog.Body>
        <div className="space-y-3 py-2">
          {item.des ? (
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {item.des}
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic">{t("Chưa có mô tả")}</div>
          )}
        </div>
      </Dialog.Body>
    </Dialog>
  );
};

// -- CreateEditArtStyleDialog – Dialog tạo/sửa art style
const CreateEditArtStyleDialog = ({
  isOpen,
  onClose,
  editItem,
  categories,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  editItem: ArtStylePublicItem | null;
  categories: ArtStyleCategoryPublicItem[];
  onSave: (data: CustomerArtStyleInput, id?: string) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [des, setDes] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [isPublish, setIsPublish] = useState(false);
  const [price, setPrice] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editItem) {
        setName(editItem.name || "");
        setPrompt(editItem.prompt || "");
        setDes(editItem.des || "");
        setImageUrls(editItem.imageUrls || []);
        setIsPublish(editItem.isPublish || false);
        setPrice(editItem.price || 0);
      } else {
        setName("");
        setPrompt("");
        setDes("");
        setImageUrls([]);
        setIsPublish(false);
        setPrice(0);
      }
    }
  }, [isOpen, editItem]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const data: CustomerArtStyleInput = {
        name: name.trim(),
        prompt: prompt.trim() || undefined,
        des: des.trim() || undefined,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        isPublish,
        price,
      };
      const ok = await onSave(data, editItem?.id);
      if (ok) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Form
      dialog
      isOpen={isOpen}
      onClose={onClose}
      title={editItem ? t("Sửa phong cách") : t("Tạo phong cách")}
      width="560px"
      maxWidth="95vw"
      onOverlayClick={() => {}}
    >
      <Dialog.Body>
        <div className="space-y-3 py-2">
          <NotifyText
            color="green"
            text={t(
              "Phong cách của bạn được nhiều người dùng và được lên top thì bạn sẽ được nâng cấp gói hoặc một khoản tiền thưởng tương ứng với giá trị."
            )}
          />
          <NotifyText
            color="indigo"
            text={t("Hãy đưa ra những phong cách hay, độc đáo để kiếm thêm thu nhập ngay bạn nhé!")}
          />
          <Field label={t("Danh sách ảnh")}>
            <ImageInput
              multi
              cover
              value={imageUrls}
              onChange={(v) => setImageUrls(v as string[])}
              cols={3}
            />
          </Field>
          <Field label={t("Tên phong cách")} required>
            <Input value={name} onChange={setName} placeholder={t("Nhập tên phong cách...")} />
          </Field>
          <Field label={t("Prompt")} required>
            <Textarea
              value={prompt}
              onChange={setPrompt}
              placeholder={t("Nhập prompt mô tả...")}
              maxRows={6}
            />
          </Field>
          <Field label={t("Hướng dẫn sử dụng")}>
            <Textarea
              value={des}
              onChange={setDes}
              placeholder={t("Nhập hướng dẫn chi tiết...")}
              maxRows={4}
            />
          </Field>
          <Field name="artStyleCategoryIds" label={t("Danh mục phong cách")} cols={12}>
            <Select
              multi
              autocompletePromise={(props) =>
                ArtStyleCategoryService.getAllAutocompletePromise(props, {
                  query: {
                    filter: {
                      isActive: true,
                    },
                  },
                  fragment: "id name",
                  parseOption: (data) => ({
                    value: data.id,
                    label: data.name,
                  }),
                })
              }
            />
          </Field>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">{t("Công khai")}</span>
            <Switch value={isPublish} onChange={setIsPublish} />
          </div>
          <NotifyText
            color="pink"
            text={`${t("Lưu ý")}: ${t(
              "Khi bạn chọn 'Công khai', Phong cách sẽ được công khai cho tất cả người dùng sử dụng sau khi admin duyệt"
            )}`}
          />
        </div>
        <div className="flex items-center justify-end gap-2 w-full">
          <Button text={t("Huỷ")} outline className="rounded-lg" onClick={onClose} />
          <Button
            primary
            text={editItem ? t("Cập nhật") : t("Tạo mới")}
            className="rounded-lg"
            onClick={handleSubmit}
            disabled={!name.trim() || !prompt.trim() || isSaving || !customer}
            isLoading={isSaving}
          />
        </div>
      </Dialog.Body>
    </Form>
  );
};

// -- CustomerArtStyleSection – danh sách art style của customer
const CustomerArtStyleSection = ({
  searchText,
  onUseArtStyle,
  categories,
}: {
  searchText?: string;
  onUseArtStyle: (artStyleId: string, name: string) => void;
  categories: ArtStyleCategoryPublicItem[];
}) => {
  const { t } = useTranslation();
  const Alert = useAlert();
  const toast = useToast();
  const {
    getCustomerArtStyleList,
    updateCustomerArtStyle,
    deleteCustomerArtStyle,
    createCustomerArtStyle,
  } = useAffiliateVideoApi();
  const { customer } = useAuth();
  const [items, setItems] = useState<ArtStylePublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ArtStylePublicItem | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<ArtStylePublicItem | null>(null);

  const loadItems = useCallback(
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result = await getCustomerArtStyleList(pageNum, ITEMS_PER_PAGE, search || undefined);
        setItems(result.data);
        setTotal(result.total);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [getCustomerArtStyleList]
  );

  useEffect(() => {
    setPage(1);
    setHasLoaded(false);
  }, [searchText]);

  useEffect(() => {
    if (!hasLoaded) {
      loadItems(1, searchText);
    }
  }, [hasLoaded, loadItems, searchText]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadItems(newPage, searchText);
    },
    [loadItems, searchText]
  );

  const handleEdit = (item: ArtStylePublicItem) => {
    setEditItem(item);
    setEditDialogOpen(true);
  };

  const handleDelete = async (item: ArtStylePublicItem) => {
    const confirmed = await Alert.danger(
      t("Xác nhận xoá"),
      t("Bạn có chắc muốn xoá phong cách này?")
    );
    if (!confirmed) return;
    const ok = await deleteCustomerArtStyle(item.id);
    if (ok) {
      toast.success(t("Đã xoá phong cách"));
      loadItems(page, searchText);
    }
  };

  const handleShowInfo = (item: ArtStylePublicItem) => {
    setInfoItem(item);
    setInfoDialogOpen(true);
  };

  const handleSave = async (data: CustomerArtStyleInput, id?: string): Promise<boolean> => {
    if (id) {
      const result = await updateCustomerArtStyle(id, data);
      if (result) {
        toast.success(t("Đã cập nhật phong cách"));
        loadItems(page, searchText);
        return true;
      }
      return false;
    } else {
      const result = await createCustomerArtStyle(data);
      if (result) {
        toast.success(t("Đã tạo phong cách mới"));
        loadItems(1, searchText);
        setPage(1);
        return true;
      }
      return false;
    }
  };

  return (
    <div className="rounded-xl overflow-hidden">
      {/* Header with Create button */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button
          onClick={() => loadItems(page, searchText)}
          className="px-3 transition-all cursor-pointer border rounded-full bg-white"
          tooltip={t("Làm mới")}
          icon={<RiRefreshLine className={`text-sm ${isLoading ? "animate-spin" : ""}`} />}
        />
        <Button
          primary
          onClick={() => {
            setEditItem(null);
            setEditDialogOpen(true);
          }}
          className="px-3 rounded-full"
          text={t("Tạo mới")}
          icon={<RiAddLine className="text-sm" />}
          disabled={!customer}
        />
      </div>

      {/* Loading */}
      {isLoading && !hasLoaded && (
        <div className="flex items-center justify-center py-6">
          <CgSpinner className="animate-spin text-xl text-blue-400 mr-2" />
          <span className="text-xs text-gray-500">{t("Đang tải...")}</span>
        </div>
      )}

      {/* Grid */}
      {hasLoaded && items.length > 0 && (
        <>
          <div
            className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {items.map((item) => (
              <ArtStyleCard
                key={item.id}
                item={item}
                onUse={onUseArtStyle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onShowInfo={handleShowInfo}
              />
            ))}
          </div>

          {total > ITEMS_PER_PAGE && (
            <div className="flex justify-center mt-3">
              <PaginationComponent
                limit={ITEMS_PER_PAGE}
                page={page}
                total={total}
                onPageChange={handlePageChange}
                visiblePageCount={5}
                hasDots
              />
            </div>
          )}
        </>
      )}

      {/* Empty */}
      {hasLoaded && !isLoading && items.length === 0 && (
        <div className="text-center py-10">
          <div className="text-gray-400 text-sm mb-3">{t("Bạn chưa tạo phong cách nào")}</div>
          <Button
            primary
            onClick={() => {
              setEditItem(null);
              setEditDialogOpen(true);
            }}
            text={t("Tạo phong cách đầu tiên")}
            icon={<RiAddLine />}
            className="rounded-lg"
            disabled={!customer}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <CreateEditArtStyleDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditItem(null);
        }}
        editItem={editItem}
        categories={categories}
        onSave={handleSave}
      />

      {/* Info Dialog */}
      <DescriptionInfoDialog
        isOpen={infoDialogOpen}
        onClose={() => {
          setInfoDialogOpen(false);
          setInfoItem(null);
        }}
        item={infoItem}
      />
    </div>
  );
};

// -- Main component
export function ArtStylePickerDialog({
  name,
  value,
  onChange,
  onCodeChange,
  label,
  noError = true,
}: ArtStylePickerDialogProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const { getActiveArtStyleCategoryList, getArtStylesByCategoryId, getArtStylePromptById } =
    useAffiliateVideoApi();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [categories, setCategories] = useState<ArtStyleCategoryPublicItem[]>([]);
  const [isLoadingCats, setIsLoadingCats] = useState(false);
  const [hasCatsLoaded, setHasCatsLoaded] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(ALL_CATEGORY_ID);

  const [items, setItems] = useState<ArtStylePublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [hasItemsLoaded, setHasItemsLoaded] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  const loadCategories = useCallback(async () => {
    setIsLoadingCats(true);
    try {
      const cats = await getActiveArtStyleCategoryList();
      setCategories(cats);
    } catch {
      setCategories([]);
    } finally {
      setIsLoadingCats(false);
      setHasCatsLoaded(true);
    }
  }, [getActiveArtStyleCategoryList]);

  const loadItems = useCallback(
    async (pageNum: number, search?: string, catId?: string) => {
      const cId = catId ?? activeCategoryId;
      if (cId === MY_ART_STYLE_ID) return; // CustomerArtStyleSection handles its own loading
      setIsLoadingItems(true);
      try {
        const effectiveCatId = cId === ALL_CATEGORY_ID ? undefined : cId;
        const result = await getArtStylesByCategoryId(
          effectiveCatId,
          pageNum,
          ITEMS_PER_PAGE,
          search || undefined
        );
        setItems(result.data);
        setTotal(result.total);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoadingItems(false);
        setHasItemsLoaded(true);
      }
    },
    [getArtStylesByCategoryId, activeCategoryId]
  );

  useEffect(() => {
    setPage(1);
    setHasItemsLoaded(false);
  }, [debouncedSearch, activeCategoryId]);
  useEffect(() => {
    if (isDialogOpen && !hasItemsLoaded) loadItems(1, debouncedSearch);
  }, [isDialogOpen, hasItemsLoaded, loadItems, debouncedSearch]);

  const openDialog = () => {
    setIsDialogOpen(true);
    setSearchInput("");
    setDebouncedSearch("");
    setActiveCategoryId(ALL_CATEGORY_ID);
    setHasItemsLoaded(false);
    if (!hasCatsLoaded) loadCategories();
  };

  const handleUse = useCallback(
    async (artStyleId: string, artStyleName: string) => {
      const prompt = await getArtStylePromptById(artStyleId);
      setSelectedName(artStyleName);
      if (onChange) onChange(artStyleName);
      if (onCodeChange) onCodeChange(artStyleId);
      setIsDialogOpen(false);
      if (prompt) toast.success(t("Ðã chọn phong cách hình ảnh"));
    },
    [onChange, onCodeChange]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      loadItems(newPage, debouncedSearch);
    },
    [loadItems, debouncedSearch]
  );

  return (
    <>
      <Field
        noError={noError}
        name={name}
        label={
          <span className="flex items-center gap-1.5 justify-between w-full">
            {label || t("Phong cách hình ảnh")}
            <Button
              outline
              info
              onClick={openDialog}
              className="px-1 h-6"
              text={t("Mẫu")}
              icon={<RiEdit2Line className="text-sm" />}
            />
          </span>
        }
      >
        <Textarea
          maxRows={3}
          id="art-style-input"
          className="border-gray-200"
          placeholder={`${t("VD")}: ${t("Anime, Realistic...")}`}
          value={selectedName || value || ""}
          onChange={(v: string) => {
            if (onChange) onChange(v);
            setSelectedName(v);
            if (!v?.trim() && onCodeChange) onCodeChange("");
          }}
        />
      </Field>

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={t("Chọn phong cách hình ảnh")}
        width="1200px"
        maxWidth="95vw"
        onOverlayClick={() => {}}
      >
        <Dialog.Body>
          <div className="flex flex-col gap-3">
            <CategoryTabBar
              categories={categories}
              activeId={activeCategoryId}
              onSelect={setActiveCategoryId}
            />
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Input
                  value={searchInput}
                  clearable
                  onChange={setSearchInput}
                  prefix={<RiSearchLine />}
                  placeholder={t("Tìm kiếm...")}
                  className="rounded-full"
                />
              </div>
              <Button
                onClick={() => {
                  setHasItemsLoaded(false);
                  if (!hasCatsLoaded) loadCategories();
                }}
                className="px-3 transition-all cursor-pointer border rounded-full bg-white"
                tooltip={t("Làm mới")}
                icon={
                  <RiRefreshLine className={`text-sm ${isLoadingItems ? "animate-spin" : ""}`} />
                }
              />
            </div>

            {/* "Của tôi" tab → CustomerArtStyleSection */}
            {activeCategoryId === MY_ART_STYLE_ID ? (
              <CustomerArtStyleSection
                searchText={debouncedSearch}
                onUseArtStyle={handleUse}
                categories={categories}
              />
            ) : (
              <>
                {isLoadingItems && !hasItemsLoaded && (
                  <div className="flex items-center justify-center py-6">
                    <CgSpinner className="animate-spin text-xl text-blue-400 mr-2" />
                    <span className="text-xs text-gray-500">{t("Đang tải...")}</span>
                  </div>
                )}

                {hasItemsLoaded && items.length > 0 && (
                  <>
                    <div
                      className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 ${
                        isLoadingItems ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      {items.map((item) => (
                        <ArtStyleCard key={item.id} item={item} onUse={handleUse} />
                      ))}
                    </div>
                    {total > ITEMS_PER_PAGE && (
                      <div className="flex justify-center mt-3">
                        <PaginationComponent
                          limit={ITEMS_PER_PAGE}
                          page={page}
                          total={total}
                          onPageChange={handlePageChange}
                          visiblePageCount={5}
                          hasDots
                        />
                      </div>
                    )}
                  </>
                )}

                {hasItemsLoaded && !isLoadingItems && items.length === 0 && (
                  <div className="text-center py-6 text-xs text-gray-500">
                    {t("Chưa có phong cách hình ảnh nào")}
                  </div>
                )}
              </>
            )}
          </div>
        </Dialog.Body>
      </Dialog>
    </>
  );
}
