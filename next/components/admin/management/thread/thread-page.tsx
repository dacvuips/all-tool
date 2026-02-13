import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { RiEyeLine, RiToggleFill, RiToggleLine } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";

import { useTranslation } from "react-i18next";
import { FaRegCommentDots } from "react-icons/fa";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { SelectCustomerService } from "../../../../lib/repo/get-all-select-resource/select-customer.repo";
import { SelectUserService } from "../../../../lib/repo/get-all-select-resource/select-user.repo";
import { Thread, ThreadService } from "../../../../lib/repo/thread/thread.repo";
import { Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ThreadSlideout } from "./components/thread-slideout";

export function ThreadPage(props) {
  const { t } = useTranslation();
  const alert = useAlert();
  const toast = useToast();
  const [threadId, setThreadId] = useState<string>(null);
  const { userPermission } = useAuth();
  const router = useRouter();
  const [groupTransaction, setGroupTransaction] = useState<string>(null);
  const { GROUP_TRANSACTION_THREAD_OPTION, THREAD_STATUS_OPTION } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setThreadId("");
    } else if (router.query["id"]) {
      setThreadId(router.query["id"] as string);
    } else {
      setThreadId(null);
    }
  }, [router.query]);

  const filter = useMemo(() => {
    if (groupTransaction == "group") {
      return { customerId: { $ne: null }, shopId: { $ne: null }, gameOrderId: { $ne: null } };
    } else if (groupTransaction == "single") {
      return { $or: [{ customerId: null }, { shopId: null }] };
    } else {
      return {};
    }
  }, [groupTransaction]);

  const createThread = async ({ customerId, shopId }) => {
    await ThreadService.createThreadStaff(shopId, customerId)
      .then((res) => {
        toast.success(t(`Đã tạo cuộc trò chuyện thành công`));
        setTimeout(() => {
          router.replace("/admin/management/chats");
        }, 400);
      })
      .catch((err) => toast.error(err));
  };

  return (
    <Card>
      <DataTable<Thread>
        crudService={ThreadService}
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
          {/* <DataTable.Search placeholder="Tìm theo ID" style={{ width: "200px" }} /> */}
          <DataTable.Filter>
            <Select
              className="w-52"
              clearable
              placeholder={t("Lọc nhóm trạng thái")}
              options={GROUP_TRANSACTION_THREAD_OPTION}
              onChange={(value) => {
                setGroupTransaction(value);
              }}
            />
            <Field name="customerId" noError>
              <Select
                className="w-60"
                clearable
                placeholder={t("Lọc theo khách hàng")}
                autocompletePromise={(props) =>
                  SelectCustomerService.getAllAutocompletePromise(props, {
                    fragment: "id name avatarUrl",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatarUrl,
                    }),
                  })
                }
                hasImage
              />
            </Field>
            <Field name="staffId" noError>
              <Select
                className="w-56"
                clearable
                placeholder={t("Lọc theo nhân viên")}
                autocompletePromise={(props) =>
                  SelectUserService.getAllAutocompletePromise(props, {
                    fragment: "id name avatar",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatar,
                    }),
                  })
                }
                hasImage
              />
            </Field>
            <Field name="status" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo trạng thái")}
                options={THREAD_STATUS_OPTION}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4">
          <DataTable.Column
            label={t("Khách hàng")}
            render={(item: Thread) =>
              item.customer ? (
                <div className="flex gap-2">
                  <div className="w-12">
                    <DataTable.CellImage avatar value={item.customer?.avatarUrl} />
                  </div>

                  <DataTable.CellText value={item.customer?.name} />
                </div>
              ) : (
                <DataTable.CellText value={""} />
              )
            }
          />

          <DataTable.Column
            label={t("Cửa hàng")}
            render={(item: Thread) =>
              item.shop ? (
                <div className="flex gap-2">
                  <div className="w-12">
                    <DataTable.CellImage avatar value={item.shop?.info.logoUrl} />
                  </div>

                  <DataTable.CellText value={item.shop?.name} />
                </div>
              ) : (
                <DataTable.CellText value={""} />
              )
            }
          />

          <DataTable.Column
            label={t("Nhân viên")}
            render={(item: Thread) =>
              item.staff ? (
                <div className="flex gap-2">
                  <div className="w-12">
                    <DataTable.CellImage className="w-12" avatar value={item.staff?.avatar} />
                  </div>

                  <DataTable.CellText value={item.staff?.name} />
                </div>
              ) : (
                <DataTable.CellText value={""} />
              )
            }
          />
          <DataTable.Column
            className="whitespace-nowrap"
            label={t("Trạng thái nhóm")}
            render={(item: Thread) => (
              <>
                <DataTable.CellText
                  value={
                    !!item.gameOrderId && !!item.customerId && !!item.shopId
                      ? t("Nhóm giao dịch")
                      : t("Tán gẫu riêng")
                  }
                />
                <DataTable.CellText value={"ID: " + item.id.slice(-10)} />
              </>
            )}
          />
          <DataTable.Column
            width={250}
            label={t("Sản phẩm")}
            render={(item: Thread) => (
              <DataTable.CellText className="text-ellipsis-2" value={item.shopProduct?.name} />
            )}
          />
          <DataTable.Column
            right
            label={t("Trạng thái chat")}
            render={(item: Thread) => (
              <DataTable.CellStatus options={THREAD_STATUS_OPTION} value={item.status} />
            )}
          />

          <DataTable.Column
            right
            render={(item: Thread) => (
              <div className="flex flex-row items-center">
                <DataTable.CellButton
                  value={item}
                  onClick={() => createThread({ customerId: item.customerId, shopId: item.shopId })}
                  icon={<FaRegCommentDots />}
                  tooltip={t("Tạo trò chuyện")}
                  disabled={!userPermission("EDIT_THREAD")}
                />

                <DataTable.Consumer>
                  {({ loadAll }) => (
                    <DataTable.CellButton
                      value={item}
                      onClick={() => {
                        alert.danger(
                          `${t("Xác nhận")} ${item.status == "opening" ? t("đóng") : t("mở")} ${t(
                            "tán gẫu"
                          )}`,
                          `${t("Bạn có chắc chắn muốn")} ${
                            item.status == "opening" ? t("đóng") : t("mở")
                          } ${t("cuộc tán gẫu này không")}`,
                          t("Xác nhận"),
                          async () => {
                            await ThreadService.closeThread(
                              item.id,
                              item.status == "new" || item.status == "opening"
                                ? "closed"
                                : "opening"
                            ).then(() => {
                              loadAll(true);
                            });
                            return true;
                          }
                        );
                      }}
                      icon={
                        item.status == "new" || item.status == "opening" ? (
                          <RiToggleFill />
                        ) : (
                          <RiToggleLine />
                        )
                      }
                      className={`${
                        item.status != "closed" ? "text-success-dark" : "text-gray-400"
                      }`}
                      tooltip={`${item.status != "closed" ? t("Đóng tán gẫu") : t("Mở tán gẫu")}`}
                      disabled={!userPermission("EDIT_THREAD")}
                    />
                  )}
                </DataTable.Consumer>
                <DataTable.CellButton
                  value={item}
                  isEditButton
                  icon={<RiEyeLine />}
                  tooltip={t("Xem cuộc trò chuyện")}
                  disabled={!userPermission("VIEW_THREAD")}
                />
              </div>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => <ThreadSlideout id={threadId} onSubmit={loadAll} loadAll={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
