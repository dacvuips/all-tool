import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { HiBadgeCheck, HiBan } from "react-icons/hi";
import { RiEdit2Line, RiRestartLine } from "react-icons/ri";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";

import { useTranslation } from "react-i18next";
import { FaRegCommentDots } from "react-icons/fa";
import {
  Customer,
  CustomerService,
  SubscriptionPlanEnum,
} from "../../../../lib/repo/customer/customer.repo";
import { ThreadService } from "../../../../lib/repo/thread/thread.repo";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import {
  CustomerGooglePackageCell,
  formatSubscription,
} from "./components/customer-google-package-cell";
import { CustomerBulkPackageLimitsDialog } from "./components/customer-bulk-package-limits-dialog";
import { CustomerSlideout } from "./components/customer-slideout";

const PACKAGE_FILTER_OPTIONS = Object.values(SubscriptionPlanEnum).map((plan) => ({
  value: plan,
  label: formatSubscription(plan),
}));

export function CustomerPage(props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { userPermission, user } = useAuth();
  const [customerId, setCustomerId] = useState<string>(null);
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const [packageFilter, setPackageFilter] = useState<SubscriptionPlanEnum>(null);
  const [resettingPackages, setResettingPackages] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Partial<Customer>[]>([]);
  const [bulkLimitsDialogOpen, setBulkLimitsDialogOpen] = useState(false);
  const loadAllRef = useRef<(() => void) | null>(null);

  const toast = useToast();
  const alert = useAlert();
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
      ...(packageFilter ? { "googlePackage.subscription": packageFilter } : {}),
    });
  }, [timeRange, packageFilter]);

  const onBulkResetPackages = async () => {
    if (user?.role !== "ADMIN") return;

    const confirmed = await alert.warn(
      t("Xác nhận reset gói hàng loạt"),
      t(
        "Chạy giống cron 00:00: đưa mức đã dùng về 0 cho Free/gói còn hạn; bỏ qua Trial còn hạn; gói hết hạn chuyển về Free. Tiếp tục?"
      ),
      t("Xác nhận"),
      async () => {
        setResettingPackages(true);
        try {
          const result = await CustomerService.customerBulkResetGooglePackage();
          toast.success(
            t(
              "Đã xử lý {{processed}} KH: {{reset}} reset, {{downgrade}} hạ Free, {{skipped}} bỏ qua Trial, {{errors}} lỗi",
              {
                processed: result.processedCount,
                reset: result.resetCount,
                downgrade: result.downgradeCount,
                skipped: result.skippedTrialCount,
                errors: result.errorCount,
              }
            )
          );
          return true;
        } catch (error: any) {
          toast.error(error?.message || t("Reset gói hàng loạt thất bại"));
          return false;
        } finally {
          setResettingPackages(false);
        }
      }
    );

    if (!confirmed) return;
  };

  return (
    <Card>
      <DataTable<Customer>
        crudService={CustomerService}
        order={{ createdAt: -1 }}
        filter={filter}
        multiSelection
        onSelectItems={setSelectedCustomers}
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
            {user?.role === "ADMIN" && (
              <>
                <DataTable.Button
                  outline
                  text={t("Cập nhật limit hàng loạt")}
                  icon={<RiEdit2Line />}
                  onClick={() => setBulkLimitsDialogOpen(true)}
                />
                <DataTable.Button
                  outline
                  text={t("Reset gói hàng loạt")}
                  icon={<RiRestartLine />}
                  disabled={resettingPackages}
                  onClick={onBulkResetPackages}
                  refreshAfterTask
                />
              </>
            )}
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
            <Field noError>
              <Select
                className="w-48"
                value={packageFilter}
                onChange={setPackageFilter}
                clearable
                placeholder={t("Lọc gói")}
                options={PACKAGE_FILTER_OPTIONS}
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
          {({ loadAll }) => {
            loadAllRef.current = loadAll;
            return <CustomerSlideout id={customerId} loadAll={loadAll} />;
          }}
        </DataTable.Consumer>
      </DataTable>

      <CustomerBulkPackageLimitsDialog
        isOpen={bulkLimitsDialogOpen}
        onClose={() => setBulkLimitsDialogOpen(false)}
        selectedCustomers={selectedCustomers}
        currentFilter={filter}
        onSuccess={() => loadAllRef.current?.()}
      />
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
