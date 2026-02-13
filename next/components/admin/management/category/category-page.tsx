import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";

import { useTranslation } from "react-i18next";
import { RiToggleFill, RiToggleLine } from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";

import { Category, CategoryService } from "../../../../lib/repo";
import { CategorySlideout } from "./components/category-slideout";

export function CategoryPage(props) {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState<string>(null);
  const { user, userPermission } = useAuth();
  const router = useRouter();

  const { BOOLEAN_OPTION } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setCategoryId("");
    } else if (router.query["id"]) {
      setCategoryId(router.query["id"] as string);
    } else {
      setCategoryId(null);
    }
  }, [router.query]);

  return (
    <Card>
      <DataTable<Category>
        crudService={CategoryService}
        // filter={user.role !== "ADMIN" && { role: { $ne: "ADMIN" } }}
        updateItem={(item) => {
          router.replace({ pathname: location.pathname, query: { id: item.id } });
        }}
        createItem={() => {
          router.replace({ pathname: location.pathname, query: { create: true } });
        }}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />

            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_CATEGORY")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            <Field name="active" noError>
              <Select
                className="w-40"
                clearable
                placeholder={t("Lọc trạng thái")}
                options={BOOLEAN_OPTION}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4">
          <DataTable.Column
            className="w-32"
            label={t("Hình ảnh")}
            render={(item: Category) => (
              <DataTable.CellImage ratio169 className="w-28" value={item.imgUrl} />
            )}
          />
          <DataTable.Column
            label={t("Tên")}
            render={(item: Category) => (
              <DataTable.CellText className="min-w-3xs" value={item.name} />
            )}
          />
          <DataTable.Column
            label={t("Mô tả")}
            render={(item: Category) => (
              <DataTable.CellText className="min-w-3xs" value={item.description} />
            )}
          />
          <DataTable.Column
            label={t("Ưu tiên")}
            render={(item: Category) => (
              <DataTable.CellText className="min-w-3xs" value={item.priority} />
            )}
          />
          <DataTable.Column
            label={t("Trạng thái")}
            render={(item: Category) => (
              <div>
                {item.active ? (
                  <Button
                    tooltip={t("Đang hoạt động")}
                    iconClassName="text-20"
                    icon={<RiToggleFill />}
                    className="text-primary"
                  ></Button>
                ) : (
                  <Button
                    tooltip={t("Ngưng hoạt động")}
                    iconClassName="text-20"
                    icon={<RiToggleLine />}
                  ></Button>
                )}
              </div>
            )}
          />

          <DataTable.Column
            right
            className="whitespace-nowrap"
            render={(item: Category) => (
              <>
                {/* <ActiveCellButton
                  item={item}
                  service={CategoryService}
                  disabled={!userPermission("EDIT_CATEGORY")}
                /> */}
                <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_CATEGORY")}
                />
                <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("DELETE_CATEGORY")}
                />
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => <CategorySlideout id={categoryId} onSubmit={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
