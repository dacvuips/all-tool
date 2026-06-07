import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { HiBadgeCheck, HiBan } from "react-icons/hi";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";

import { useTranslation } from "react-i18next";
import { FaRegCommentDots } from "react-icons/fa";
import { Customer, CustomerService } from "../../../../lib/repo/customer/customer.repo";
import { ThreadService } from "../../../../lib/repo/thread/thread.repo";
import { DatePicker, Field } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { CustomerGooglePackageCell } from "./components/customer-google-package-cell";
import { CustomerSlideout } from "./components/customer-slideout";

export function CustomerPage(props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { userPermission, user } = useAuth();
  const [customerId, setCustomerId] = useState<string>(null);
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);

  const toast = useToast();
  useEffect(() => {
    if (router.query["create"]) {
      setCustomerId("");
    } else if (router.query["id"]) {
      setCustomerId(router.query["id"] as string);
    } else {
      setCustomerId(null);
    }
  }, [router.query]);
  const createThread = async (customerId) => {
    await ThreadService.createThreadCustomerShop(undefined, customerId)
      .then((res) => {
        toast.success(t(`Đã tạo cuộc trò chuyện thành công`));
        setTimeout(() => {
          router.replace("/admin/management/chats");
        }, 400);
      })
      .catch((err) => toast.error(err));
  };
  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);
  return (
    <Card>
      <DataTable<Customer>
        crudService={CustomerService}
        order={{ createdAt: -1 }}
        filter={filter}
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
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            <Field noError>
              <DatePicker
                className="w-40"
                value={timeRange}
                onChange={setTimeRange}
                selectsRange
                fullHeader
                placeholder={t("Lọc thời gian")}
                clearable
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4" disableDbClick={true}>
          <DataTable.Column
            render={(item: Customer) => (
              <DataTable.CellImage avatar className="w-12" value={item.avatarUrl} />
            )}
          />
          <DataTable.Column
            label={t("Tên")}
            render={(item: Customer) => (
              <DataTable.CellText className="whitespace-nowrap" value={item.name} />
            )}
          />
          <DataTable.Column
            label={t("Mã khách hàng")}
            render={(item: Customer) => <DataTable.CellText value={item.code} />}
          />
          <DataTable.Column
            center
            label={t("Ngày tham gia")}
            render={(item: Customer) => (
              <DataTable.CellDate
                value={item.createdAt}
                className="whitespace-nowrap"
                format="HH:mm dd-MM-yyyy"
              />
            )}
          />

          <DataTable.Column
            label={t("email")}
            render={(item: Customer) => <DataTable.CellText value={item.email} />}
          />
          <DataTable.Column
            label={t("Gói")}
            render={(item: Customer) => (
              <CustomerGooglePackageCell googlePackage={item.googlePackage} />
            )}
          />
          <DataTable.Column
            center
            label={t("Gói dùng thử")}
            render={(item: Customer) =>
              item.hasActivatedTrial ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 whitespace-nowrap">
                  {t("Đã kích hoạt")}
                </span>
              ) : (
                <span className="text-sm text-gray-400">—</span>
              )
            }
          />

          <DataTable.Column
            right
            className="whitespace-nowrap"
            render={(item: Customer) => (
              <>
                {user.role == "ADMIN" && (
                  <DataTable.CellButton
                    value={item}
                    onClick={() => createThread(item.id)}
                    icon={<FaRegCommentDots />}
                    tooltip={t("Tạo trò chuyện")}
                    disabled={!userPermission("EDIT_CUSTOMER")}
                  />
                )}
                <ActiveButton
                  item={item}
                  service={CustomerService}
                  disabled={!userPermission("EDIT_CUSTOMER")}
                />
                <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_CUSTOMER")}
                />
                {/* <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("DELETE_CUSTOMER")}
                /> */}
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => <CustomerSlideout id={customerId} loadAll={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}

export function ActiveButton({ item, service, disabled = false }) {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <>
      {item.status == "ACTIVE" ? (
        <DataTable.CellButton
          value={item}
          disabled={disabled}
          icon={<HiBan />}
          tooltip={t("Ngưng hoạt động")}
          onClick={async () => {
            await service.update({ id: item.id, data: { status: "INACTIVE" } });
            toast.success(t("Ngừng kích hoạt thành công"));
          }}
          refreshAfterTask
        />
      ) : (
        <DataTable.CellButton
          value={item}
          disabled={disabled}
          icon={<HiBadgeCheck />}
          tooltip={t("Kích hoạt")}
          onClick={async () => {
            await service.update({
              id: item.id,
              data: { status: "ACTIVE" },
            });
            toast.success(t("Kích hoạt thành công"));
          }}
          refreshAfterTask
        />
      )}
    </>
  );
}
