/**
 * trending-category-list.tsx
 * Hiển thị danh sách trending categories + trending items theo từng category.
 * Mỗi category load trending items riêng với phân trang (getTrendingsByCategoryId).
 * Giao diện professional: accordion-style categories, grid card items
 * Tailwind CSS, i18n, dùng component có sẵn trong source.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

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

import { BsBookmarkStarFill, BsMagic } from "react-icons/bs";
import { parseNumber } from "../../../../../lib/helpers/parser";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { TrendingTypeEnum } from "../../../../../lib/repo/list/trending.repo";
import { TrendingCategoryService } from "../../../../../lib/repo/list/trendingCategory.repo";
import { NotifyText } from "../../../../shared/common/notify-text";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Switch,
  Textarea,
} from "../../../../shared/utilities/form";
import { Img } from "../../../../shared/utilities/misc";
import { PaginationComponent } from "../../../../shared/utilities/pagination/pagination-component";
import { useAffiliateVideoContext } from "../../chatbot/providers/affiliate-video-provider";
import {
  CustomerTrendingInput,
  TrendingCategoryPublicItem,
  TrendingPublicItem,
  useAffiliateVideoApi,
} from "../../hook/useAffiliateVideoApi";
import { AppTrendingType, AppTypeConfig, useAppTypeConfig } from "../useAppTypeConfig";

// ── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 5;

const filterItemsByType = (items: TrendingPublicItem[], type: TrendingTypeEnum) =>
  items.filter((item) => !item.type || item.type === type);
const ALL_CATEGORY_ID = "__all__";
const MY_TRENDING_ID = "__my__";

// ── AppItemCard – hiển thị 1 app item ────────────────────────────────────
const AppItemCard = ({
  item,
  categoryName,
  onUseTrending,
  onEdit,
  onDelete,
  onShowInfo,
}: {
  item: TrendingPublicItem;
  categoryName?: string;
  onUseTrending: (trendingId: string, promptName: string) => void | Promise<boolean>;
  onEdit?: (item: TrendingPublicItem) => void;
  onDelete?: (item: TrendingPublicItem) => void;
  onShowInfo?: (item: TrendingPublicItem) => void;
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [useCount, setUseCount] = useState(item.count || 0);
  const firstImage = item.imageUrls?.[0];

  useEffect(() => {
    setUseCount(item.count || 0);
  }, [item.count]);

  return (
    <div className="group relative rounded-xl  overflow-hidden bg-white p-1.5 gap-2  transition-all duration-300 border border-primary-dark  flex flex-col hover:shadow-2xl cursor-pointer hover:shadow-primary-100 hover:border-success-dark hover:border-2">
      {/* Image */}
      <div className="aspect-[4/3]  overflow-hidden relative">
        {firstImage ? (
          <Img
            lazyload={false}
            showImageOnClick
            rounded
            src={firstImage}
            alt={item.name}
            className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex justify-center items-center w-full h-full text-3xl text-gray-600">
            🎬
          </div>
        )}{" "}
        <div
          className={`text-lg absolute -bottom-0.5 -left-0.5 p-1    bg-white rounded-l-none rounded-br-none  rounded-tr-xl font-semibold ${
            item.price === 0 ? "text-success" : "text-red-500"
          }`}
        >
          {item.price === 0 ? t("Miễn phí") : parseNumber(item.price, "VND")}
        </div>
      </div>

      <Button
        onClick={(e) => {
          e.stopPropagation();
          setIsBookmarked(!isBookmarked);
        }}
        className="absolute top-2 right-2 z-10 p-0.5"
        tooltip={t("Đánh dấu")}
        icon={
          isBookmarked ? (
            <BsBookmarkStarFill className="text-20 text-success" />
          ) : (
            <BsBookmarkStarFill className="text-20" />
          )
        }
      />

      {/* Edit/Delete buttons for customer's own items */}
      {onEdit && onDelete && (
        <div className="flex absolute top-2 left-2 z-10 gap-2 p-1 bg-white bg-opacity-80 rounded-lg border border-white opacity-100 transition-opacity">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="px-0 h-7"
            tooltip={t("Sửa")}
            icon={<RiEdit2Line className="text-lg text-blue-500" />}
          />
          {!item.isActive && (
            <Button
              onClick={(e) => {
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

      {/* Title row: Name + Bookmark + Copy */}
      <div className="flex gap-2 items-start w-full">
        <div className="flex items-center gap-1.5 justify-between min-w-0 flex-1">
          {/* Category tag */}
          {categoryName && (
            <div className="bg-white bg-opacity-70 font-semibold px-1 py-0.5 text-emerald-400 text-base rounded-md border min-w-0 truncate">
              🌿 {categoryName}
            </div>
          )}
          <div className="flex gap-1 items-center">
            <Button
              onClick={async (e) => {
                e.stopPropagation();
                if (!customer) {
                  toast.error(t("Vui lòng đăng nhập để sử dụng tính năng này"));
                  return;
                }
                const ok = await onUseTrending(item.id, item.name);
                if (ok) setUseCount((prev) => prev + 1);
              }}
              outline
              info
              className="px-1 h-7 font-normal whitespace-nowrap rounded-lg text-10"
              text={t("Dùng ngay")}
              icon={<BsMagic className="text-14" />}
            ></Button>
            {/* Info button */}
            {(item.des || onShowInfo) && (
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShowInfo) onShowInfo(item);
                }}
                className="rounded-full p-0.5 h-7 w-7  border bg-white hover:bg-blue-50"
                tooltip={t("Xem hướng dẫn")}
                icon={<RiFileList3Line className="text-blue-400 text-20" />}
              />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 items-center pl-1 m-0 font-bold leading-snug text-primary line-clamp-1">
        {item.name}
      </div>
      {/* Prompt section (dark, max 3 lines) */}
      {item.promptShort && (
        <div className="bg-white rounded-lg border border-gray-200 border-dashed">
          <p className="px-2 m-0 max-w-full leading-relaxed text-gray-400 overflow-ellipsis text-12 line-clamp-3 text-ellipsis-2">
            {item.promptShort}
          </p>
        </div>
      )}

      {/* Footer: stats + hashtags */}
      <div className="flex flex-wrap gap-3 items-center mt-auto">
        {/* Fire count */}
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiFireLine className="text-xs text-orange-400/70" />
          {useCount}
        </span>
        {/* Eye count */}
        <span className="flex items-center gap-1 text-[10px] text-gray-500">
          <RiEyeLine className="text-xs text-gray-500" />0
        </span>
      </div>
    </div>
  );
};

// ── CategorySection – hiển thị 1 category với trending items phân trang ──
const CategorySection = ({
  category,
  categoryId,
  searchText,
  onUseTrending,
  loadCategories,
  onShowInfo,
  onOpenCreate,
  config,
}: {
  category?: TrendingCategoryPublicItem;
  categoryId?: string;
  defaultExpanded?: boolean;
  searchText?: string;
  onUseTrending: (trendingId: string, promptName: string) => void | Promise<boolean>;
  loadCategories: () => void;
  onShowInfo?: (item: TrendingPublicItem) => void;
  onOpenCreate?: () => void;
  config: AppTypeConfig;
}) => {
  const { t } = useTranslation();
  const { getByCategoryId, type: itemType } = config;
  const { customer } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<TrendingPublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Use explicit categoryId prop if provided, otherwise fall back to category.id
  const effectiveCategoryId = categoryId ?? category?.id;

  const loadItems = useCallback(
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result = await getByCategoryId(
          effectiveCategoryId,
          pageNum,
          ITEMS_PER_PAGE,
          search || undefined
        );
        setItems(filterItemsByType(result.data, itemType));
        setTotal(result.total);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [getByCategoryId, effectiveCategoryId, searchText, itemType]
  );

  // Auto-load on mount and when search/type changes
  useEffect(() => {
    setPage(1);
    setHasLoaded(false);
  }, [searchText, itemType]);

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

  return (
    <div className="overflow-hidden rounded-xl">
      {/* Category header */}
      <div className="flex gap-2 justify-end items-center mb-2">
        <Button
          onClick={loadCategories}
          className="px-3 bg-white rounded-full border transition-all cursor-pointer"
          tooltip={t("Làm mới")}
          icon={<RiRefreshLine className={`text-sm ${isLoading ? "animate-spin" : ""}`} />}
        />{" "}
        <Button
          primary
          onClick={() => {
            if (!customer) {
              toast.error(t("Vui lòng đăng nhập để sử dụng tính năng này"));
              return;
            }
            onOpenCreate?.();
          }}
          className="px-3 h-9 whitespace-nowrap rounded-full"
          text={t("Tạo mới")}
          icon={<RiAddLine className="text-sm" />}
          disabled={!customer}
        />
      </div>

      {/* Loading state */}
      {isLoading && !hasLoaded && (
        <div className="flex justify-center items-center py-6">
          <CgSpinner className="mr-2 text-xl text-blue-400 animate-spin" />
          <span className="text-xs text-gray-500">{t("Đang tải...")}</span>
        </div>
      )}

      {/* Trending items grid */}
      {hasLoaded && items.length > 0 && (
        <>
          <div
            className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {items.map((item) => (
              <AppItemCard
                key={item.id}
                item={item}
                categoryName={category?.name}
                onUseTrending={onUseTrending}
                onShowInfo={onShowInfo}
              />
            ))}
          </div>

          {/* Pagination */}
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

      {/* Empty state */}
      {hasLoaded && !isLoading && items.length === 0 && (
        <div className="py-6 text-xs text-center text-gray-500">
          {t("Chưa có trending nào trong danh mục này")}
        </div>
      )}
    </div>
  );
};

// ── CategoryTabBar – thanh tab danh mục ngang ───────────────────────────
const CategoryTabBar = ({
  categories,
  activeId,
  onSelect,
  loadCategories,
  isLoading,
}: {
  categories: TrendingCategoryPublicItem[];
  activeId: string;
  onSelect: (id: string) => void;
  loadCategories: () => void;
  isLoading: boolean;
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => {
    const allTab = { id: ALL_CATEGORY_ID, name: t("Tất cả"), isHot: false };
    const myTab = {
      id: MY_TRENDING_ID,
      name: (
        <div className="flex gap-1 whitespace-nowrap">
          <RiUserHeartFill />
          {t("Của tôi")}
        </div>
      ),
      isHot: false,
    };
    return [allTab, myTab, ...categories.map((c) => ({ id: c.id, name: c.name, isHot: c.isHot }))];
  }, [categories, t]);

  return (
    <div className="flex relative flex-row flex-shrink-0 gap-2 items-center">
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 overflow-x-auto v-scrollbar py-1 w-full pb-2 no-scrollbar   rounded-lg px-1.5"
        style={{ scrollbarWidth: "thin" }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={` 
                flex items-center gap-1 px-3 py-1.5 rounded-full text-xs  bg-white
                whitespace-nowrap font-semibold transition-all duration-200 cursor-pointer  
                ${
                  isActive
                    ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                    : "  text-gray   hover:text-gray-200 border border-gray-200"
                }
              `}
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

// ── SearchInput – ô tìm kiếm trending theo name ─────────────────────────
const SearchInput = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
  const { t } = useTranslation();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e;
      // Update input immediately
      onChange(val as any);
    },
    [onChange]
  );

  return (
    <div className="relative flex-shrink-0">
      <Input
        value={value}
        clearable
        onChange={handleChange}
        prefix={<RiSearchLine />}
        placeholder={t("Tìm kiếm...")}
        className="rounded-full"
      />
    </div>
  );
};

// ── DescriptionInfoDialog – Dialog hiển thị mô tả (des) ─────────────────
const DescriptionInfoDialog = ({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: TrendingPublicItem | null;
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
        <div className="py-2 space-y-3">
          {item.des ? (
            <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {item.des}
            </div>
          ) : (
            <div className="text-sm italic text-gray-400">{t("Chưa có mô tả")}</div>
          )}
        </div>
      </Dialog.Body>
    </Dialog>
  );
};

// ── CreateEditTrendingDialog – Dialog tạo/sửa trending ───────────────────
const CreateEditTrendingDialog = ({
  isOpen,
  onClose,
  editItem,
  categories,
  onSave,
  config,
}: {
  isOpen: boolean;
  onClose: () => void;
  editItem: TrendingPublicItem | null;
  categories: TrendingCategoryPublicItem[];
  onSave: (data: CustomerTrendingInput, id?: string) => Promise<boolean>;
  config: AppTypeConfig;
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

  // Reset form when dialog opens/editItem changes
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
      const data: CustomerTrendingInput = {
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
      title={editItem ? t(config.editDialogTitle) : t(config.createDialogTitle)}
      width="560px"
      maxWidth="95vw"
      onOverlayClick={() => {}}
    >
      <Dialog.Body>
        <div className="py-2 space-y-3">
          <NotifyText
            color="green"
            text={t(
              "App của bạn được nhiều người dùng và được lên top thì bạn sẽ được nâng cấp gói hoặc một khoản tiền thưởng tương ứng với giá trị."
            )}
          />{" "}
          <NotifyText
            color="indigo"
            text={t(
              "Hãy đưa ra những App hay, độc đáo, thu hút người dùng để kiếm thêm thu nhập ngay bạn nhé!"
            )}
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
          <Field label={t(config.nameFieldLabel)} required>
            <Input value={name} onChange={setName} placeholder={t(config.namePlaceholder)} />
          </Field>
          <Field
            label={t("Prompt tạo App hoặc link tới app của bạn")}
            description={`${t("Prompt tạo App")}
${t("Link tới app của bạn...")}
${t("VD")}: https://aistudio.google.com/apps/drive/XXXX
https://labs.google/fx/tools/flow/shared/tool/XXXX`}
            required
          >
            <Textarea
              value={prompt}
              onChange={setPrompt}
              placeholder={t("Nhập Prompt tạo App hoặc link tới app của bạn...")}
              maxRows={4}
            />
          </Field>
          <Field label={t(config.guideFieldLabel)}>
            <Textarea
              value={des}
              onChange={setDes}
              placeholder={t("Nhập hướng dẫn chi tiết...")}
              maxRows={4}
            />
          </Field>
          <Field name="trendingCategoryIds" label={t("Danh mục hiển thị")} cols={12}>
            <Select
              multi
              autocompletePromise={(props) =>
                TrendingCategoryService.getAllAutocompletePromise(props, {
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
          <div className="flex gap-3 items-center">
            <span className="text-sm font-medium text-gray-700">{t("Công khai")}</span>
            <Switch value={isPublish} onChange={setIsPublish} />
          </div>
          <NotifyText
            color="pink"
            text={`${t("Lưu ý")}: ${t(
              "Khi bạn chọn 'Công khai', App sẽ được công khai cho tất tả người dùng sử dụng sau khi admin duyệt"
            )}`}
          />
        </div>
        <div className="flex gap-2 justify-end items-center w-full">
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

// ── CustomerTrendingSection – danh sách trending của customer ─────────────
const CustomerTrendingSection = ({
  searchText,
  onUseTrending,
  categories,
  config,
}: {
  searchText?: string;
  onUseTrending: (trendingId: string, promptName: string) => void | Promise<boolean>;
  categories: TrendingCategoryPublicItem[];
  config: AppTypeConfig;
}) => {
  const { t } = useTranslation();
  const Alert = useAlert();
  const toast = useToast();
  const { getCustomerList, update, delete: deleteItem, create, type: itemType } = config;
  const { customer } = useAuth();
  const [items, setItems] = useState<TrendingPublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<TrendingPublicItem | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<TrendingPublicItem | null>(null);

  const loadItems = useCallback(
    async (pageNum: number, search?: string) => {
      setIsLoading(true);
      try {
        const result = await getCustomerList(pageNum, ITEMS_PER_PAGE, search || undefined);
        setItems(filterItemsByType(result.data, itemType));
        setTotal(result.total);
      } catch {
        setItems([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setHasLoaded(true);
      }
    },
    [getCustomerList, itemType]
  );

  useEffect(() => {
    setPage(1);
    setHasLoaded(false);
  }, [searchText, itemType]);

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

  const handleEdit = (item: TrendingPublicItem) => {
    setEditItem(item);
    setEditDialogOpen(true);
  };

  const handleDelete = async (item: TrendingPublicItem) => {
    const confirmed = await Alert.danger(t("Xác nhận xoá"), t(config.deleteConfirm));
    if (!confirmed) return;
    const ok = await deleteItem(item.id);
    if (ok) {
      toast.success(t(config.deleteSuccess));
      loadItems(page, searchText);
    }
  };

  const handleShowInfo = (item: TrendingPublicItem) => {
    setInfoItem(item);
    setInfoDialogOpen(true);
  };

  const handleSave = async (data: CustomerTrendingInput, id?: string): Promise<boolean> => {
    if (id) {
      const result = await update(id, data);
      if (result) {
        toast.success(t(config.updateSuccess));
        loadItems(page, searchText);
        return true;
      }
      return false;
    } else {
      const result = await create(data);
      if (result) {
        toast.success(t(config.createSuccess));
        loadItems(1, searchText);
        setPage(1);
        return true;
      }
      return false;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl">
      {/* Header with Create button */}
      <div className="flex gap-2 justify-end items-center mb-2">
        <Button
          onClick={() => loadItems(page, searchText)}
          className="px-3 bg-white rounded-full border transition-all cursor-pointer"
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
        <div className="flex justify-center items-center py-6">
          <CgSpinner className="mr-2 text-xl text-blue-400 animate-spin" />
          <span className="text-xs text-gray-500">{t("Đang tải...")}</span>
        </div>
      )}

      {/* Grid */}
      {hasLoaded && items.length > 0 && (
        <>
          <div
            className={`grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ${
              isLoading ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {items.map((item) => (
              <AppItemCard
                key={item.id}
                item={item}
                onUseTrending={onUseTrending}
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
        <div className="py-10 text-center">
          <div className="mb-3 text-sm text-gray-400">{t("Bạn chưa tạo trending nào")}</div>
          <Button
            primary
            onClick={() => {
              setEditItem(null);
              setEditDialogOpen(true);
            }}
            text={t("Tạo trending đầu tiên")}
            icon={<RiAddLine />}
            className="rounded-lg"
            disabled={!customer}
          />
        </div>
      )}

      {/* Edit Dialog */}
      <CreateEditTrendingDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditItem(null);
        }}
        editItem={editItem}
        categories={categories}
        onSave={handleSave}
        config={config}
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

// ── AppCategoryList – main component ────────────────────────────────────
export const AppCategoryList = ({ type }: { type: AppTrendingType }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const config = useAppTypeConfig(type);
  const { getActiveTrendingCategoryList, getTrendingPromptById, recordAppTrendingUse } =
    useAffiliateVideoApi();
  const { create } = config;
  const { patchConfig, openSidebar, setPendingPrompt } = useAffiliateVideoContext();

  const [categories, setCategories] = useState<TrendingCategoryPublicItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(ALL_CATEGORY_ID);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [myListKey, setMyListKey] = useState(0);

  // Info dialog state (for non-customer items)
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<TrendingPublicItem | null>(null);

  // Reset filter state khi đổi tab type
  useEffect(() => {
    setActiveCategoryId(ALL_CATEGORY_ID);
    setSearchInput("");
    setDebouncedSearch("");
    setMyListKey((k) => k + 1);
    setHasLoaded(false);
  }, [type]);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getActiveTrendingCategoryList();
      setCategories(items);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [getActiveTrendingCategoryList]);

  useEffect(() => {
    if (!hasLoaded) {
      loadCategories();
    }
  }, [hasLoaded, loadCategories]);

  // Visible categories based on active tab
  const visibleCategories = useMemo(() => {
    if (activeCategoryId === ALL_CATEGORY_ID || activeCategoryId === MY_TRENDING_ID) return [];
    return categories.filter((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

  // Khi user click "Dùng ngay" → lấy prompt/link từ backend, hiển thị ở sidebar trái
  const handleUseTrending = useCallback(
    async (trendingId: string, promptName: string): Promise<boolean> => {
      const prompt = await getTrendingPromptById(trendingId);
      if (!prompt) {
        toast.error(t("Không lấy được prompt"));
        return false;
      }
      const recorded = await recordAppTrendingUse(trendingId);
      if (!recorded) {
        toast.error(t("Không ghi nhận được lượt dùng"));
        return false;
      }
      if (patchConfig) {
        patchConfig({ tipContent: prompt, promptId: trendingId, promptName });
      }
      if (setPendingPrompt) {
        setPendingPrompt(prompt);
      }
      if (openSidebar) {
        openSidebar();
      }
      return true;
    },
    [
      getTrendingPromptById,
      recordAppTrendingUse,
      patchConfig,
      setPendingPrompt,
      openSidebar,
      toast,
      t,
    ]
  );

  // Handle info button click for non-customer cards
  const handleShowInfo = useCallback((item: TrendingPublicItem) => {
    setInfoItem(item);
    setInfoDialogOpen(true);
  }, []);

  // Handle create from dialog
  const handleCreateSave = useCallback(
    async (data: CustomerTrendingInput): Promise<boolean> => {
      const result = await create(data);
      if (result) {
        toast.success(t(config.createSuccess));
        setMyListKey((k) => k + 1);
        setActiveCategoryId(MY_TRENDING_ID);
        return true;
      }
      return false;
    },
    [create, config.createSuccess, toast, t]
  );

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center py-16">
        <CgSpinner className="mb-3 text-3xl text-blue-500 animate-spin" />
        <span className="text-sm font-medium text-gray-400">
          {t("Đang tải danh sách trending...")}
        </span>
      </div>
    );
  }

  // ── Empty state ──
  if (hasLoaded && categories.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center px-4 py-16">
        <div className="w-16 h-16 rounded-full bg-[#1a2332] flex items-center justify-center mb-3">
          <span className="text-2xl">🔥</span>
        </div>
        <h3 className="mb-1 text-sm font-semibold text-gray-300">{t("Chưa có trending nào")}</h3>
        <p className="mb-4 text-xs text-center text-gray-500">
          {t("Các trending sẽ xuất hiện khi được quản trị viên thiết lập")}
        </p>
        <button
          onClick={loadCategories}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer border border-blue-500/20"
        >
          <RiRefreshLine className="text-sm" />
          {t("Thử lại")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0f1923]">
      {/* Categories list */}
      <div className="overflow-y-auto flex-1 p-2 space-y-4 v-scrollbar xs:p-3">
        {/* Category tabs + Search + Create button */}
        <div>
          {/* Tab bar */}
          <CategoryTabBar
            categories={categories}
            activeId={activeCategoryId}
            onSelect={setActiveCategoryId}
            loadCategories={loadCategories}
            isLoading={isLoading}
          />

          {/* Search input + Create button */}
          <div className="flex gap-2 items-center mt-1">
            <div className="flex-1">
              <SearchInput value={searchInput} onChange={setSearchInput} />
            </div>
          </div>
        </div>
        <NotifyText color="green" text={t(config.notifyText)} />
        {activeCategoryId === MY_TRENDING_ID ? (
          <CustomerTrendingSection
            key={myListKey}
            searchText={debouncedSearch}
            onUseTrending={handleUseTrending}
            categories={categories}
            config={config}
          />
        ) : activeCategoryId === ALL_CATEGORY_ID ? (
          <CategorySection
            key="__all__"
            searchText={debouncedSearch}
            onUseTrending={handleUseTrending}
            loadCategories={loadCategories}
            onShowInfo={handleShowInfo}
            onOpenCreate={() => setCreateDialogOpen(true)}
            config={config}
          />
        ) : (
          visibleCategories.map((cat, index) => (
            <CategorySection
              key={cat.id}
              category={cat}
              defaultExpanded={index === 0}
              searchText={debouncedSearch}
              onUseTrending={handleUseTrending}
              loadCategories={loadCategories}
              onShowInfo={handleShowInfo}
              onOpenCreate={() => setCreateDialogOpen(true)}
              config={config}
            />
          ))
        )}
      </div>

      {/* Create Dialog (from header button) */}
      <CreateEditTrendingDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        editItem={null}
        categories={categories}
        onSave={async (data) => handleCreateSave(data)}
        config={config}
      />

      {/* Info Dialog (for non-customer items) */}
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
