import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineRefresh } from "react-icons/hi";
import { RiSettings4Line } from "react-icons/ri";

import { ParamName } from "../../../../lib/constants/constants";
import { useQueryParams } from "../../../../lib/hooks/useQueryParams";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";

import { ProductApp, ProductAppService } from "../../../../lib/repo/product/productApp.repo";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ProductField } from "./components/product-field";
import { ProductFlowPage } from "./product-flow-page";

/** Lấy danh sách slug từ pages/app/ qua API route */
async function fetchAppPageSlugs(): Promise<{ slug: string; filename: string }[]> {
  const res = await fetch("/api/app-pages");
  if (!res.ok) throw new Error("Không thể đọc danh sách pages/app");
  const data = await res.json();
  return data.slugs ?? [];
}

export function ProductPage(props: { initialProductId?: string | null }) {
  const { initialProductId } = props || {};
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [syncing, setSyncing] = useState(false);

  const [queryParams, setQueryParams] = useQueryParams({
    [ParamName.productId]: "",
  });
  const productIdParam = (queryParams[ParamName.productId] as string) || "";

  useEffect(() => {
    if (productIdParam) {
      setQueryParams({ [ParamName.productId]: productIdParam });
    }
  }, [productIdParam]);

  const handleOpenProductFlow = (productId: string) => {
    setQueryParams({ [ParamName.productId]: productId });
  };

  const handleBackFromFlow = () => {
    setQueryParams({ [ParamName.productId]: "" });
  };

  /**
   * Đồng bộ slug từ pages/app/ → tự động tạo product mới nếu slug chưa tồn tại
   * Data tạo: { slug, name: slug, active: true, creditCostTotal: 0 }
   */
  const handleSyncFromPages = async (loadAll: () => void) => {
    setSyncing(true);
    try {
      // 1. Lấy danh sách slug từ filesystem
      const appSlugs = await fetchAppPageSlugs();
      if (!appSlugs.length) {
        toast.success(t("Không tìm thấy page nào trong pages/app/"));
        return;
      }

      // 2. Lấy tất cả product hiện có để so sánh slug
      const existing = await ProductAppService.getAll({
        query: { limit: 500 },
        fragment: ProductAppService.parseFragment(`id slug`),
        cache: false,
      });
      const existingSlugs = new Set(
        (existing.data || []).map((p: ProductApp) => p.slug).filter(Boolean)
      );

      // 3. Tạo product mới cho các slug chưa có
      const newSlugs = appSlugs.filter((s) => !existingSlugs.has(s.slug));
      if (!newSlugs.length) {
        toast.success(t("Tất cả pages đã được đồng bộ"));
        return;
      }

      await Promise.all(
        newSlugs.map((s) =>
          ProductAppService.createOrUpdate({
            data: {
              slug: s.slug,
              name: s.slug,
              active: true,
              creditCostTotal: 0,
            },
          })
        )
      );

      toast.success(
        t(`Đã tạo {{count}} product mới từ pages/app`, { count: newSlugs.length })
      );
      loadAll();
    } catch (err: any) {
      toast.error(`${t("Đồng bộ thất bại")}: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (productIdParam) {
    return <ProductFlowPage productIdParam={productIdParam} onBack={handleBackFromFlow} />;
  }

  return (
    <Card>
      <DataTable<ProductApp> crudService={ProductAppService} filter={filter} order={{ priority: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Consumer>
              {({ loadAll }) => (
                <DataTable.Button
                  outline
                  icon={<HiOutlineRefresh className={syncing ? "animate-spin" : ""} />}
                  text={t("Đồng bộ Pages")}
                  disabled={syncing || !userPermission("CREATE_PRODUCT")}
                  onClick={() => handleSyncFromPages(loadAll)}
                  tooltip={t("Tự động tạo product từ các page trong pages/app/")}
                />
              )}
            </DataTable.Consumer>
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_PRODUCT")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter />
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData, loadAll }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label="Ảnh bìa"
                  width={120}
                  render={(item: ProductApp) => (
                    <DataTable.CellText
                      ratio169
                      imageClassName="w-28"
                      compress={200}
                      image={item.coverImg}
                      value=""
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Tiêu đề")}
                  render={(item: ProductApp) => <DataTable.CellText value={item.name} />}
                />

                {/* Cột Slug: hiển thị slug page tương ứng trong pages/app/ */}
                <DataTable.Column
                  label={t("Slug / App")}
                  render={(item: ProductApp) => (
                    <DataTable.CellText
                      value={
                        item.slug ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono font-semibold bg-indigo-50 text-indigo-700 rounded border border-indigo-200">
                            {item.slug}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">{t("Chưa có slug")}</span>
                        )
                      }
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Credit")}
                  render={(item: ProductApp) => (
                    <DataTable.CellText
                      value={
                        <span className="font-semibold text-primary">
                          {item.creditCostTotal ?? 0}
                        </span>
                      }
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Ngày cập nhật")}
                  render={(item: ProductApp) => (
                    <DataTable.CellDate value={item.updatedAt} format="dd/MM/yyyy" />
                  )}
                />

                <DataTable.Column
                  right
                  label={t("Kích hoạt")}
                  render={(item: ProductApp) => (
                    <DataTable.CellText
                      className="flex justify-end"
                      value={
                        <Switch
                          readOnly={!userPermission("EDIT_PRODUCT")}
                          dependent
                          value={item.active}
                          onChange={async () => {
                            try {
                              const res = await ProductAppService.toggleActive(item.id);
                              changeRowData(item, "active", res.active);
                              toast.success(t("Cập trạng thái thành công"));
                            } catch (err) {
                              changeRowData(item, "active", item.active);
                              toast.error(t("Cập trạng thái thất bại"));
                            }
                          }}
                        />
                      }
                    />
                  )}
                />

                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: ProductApp) => (
                    <>
                      <DataTable.CellButton
                        icon={<RiSettings4Line />}
                        value={item}
                        disabled={!userPermission("EDIT_PRODUCT")}
                        tooltip={t("Cấu hình sản phẩm")}
                        onClick={() => handleOpenProductFlow(item.id)}
                      />
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_PRODUCT")}
                      />
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                        disabled={!userPermission("DELETE_PRODUCT")}
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>

        <DataTable.Form grid width={1024} slideFromBottom="none">
          <ProductField />
        </DataTable.Form>

        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
