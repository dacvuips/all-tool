import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";

import { Wallet, WalletService } from "../../../../lib/repo/wallet/wallet.repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { WalletSlideout } from "./components/wallet-slideout";

import { useTranslation } from "react-i18next";
import { BiMoneyWithdraw } from "react-icons/bi";
import { RiShareBoxFill } from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { CustomerService, UserService } from "../../../../lib/repo";
import { UserRoleEnum } from "../../../../lib/repo/types";
import { Field, Select } from "../../../shared/utilities/form";
import { DepositWalletDialog } from "./components/depositWalletDialog";
import { WithdrawWalletDialog } from "./components/withDrawWalletDialog";

export function WalletPage(props) {
  const { t } = useTranslation();
  const [walletId, setWalletId] = useState<string>(null);
  const [openWithdraw, setOpenWithdraw] = useState<string>(null);
  const [openDeposit, setOpenDeposit] = useState<string>(null);
  const { userPermission, user } = useAuth();
  const router = useRouter();
  const { ROLES_OPTIONS } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setWalletId("");
    } else if (router.query["id"]) {
      setWalletId(router.query["id"] as string);
    } else {
      setWalletId(null);
    }
  }, [router.query]);

  return (
    <Card>
      <DataTable<Wallet>
        crudService={WalletService}
        order={{ createdAt: -1 }}
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
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          {/* <DataTable.Search /> */}
          <DataTable.Filter>
            <Field name="ownerId" noError>
              <Select
                className="w-60"
                clearable
                placeholder={t("Lọc theo khách hàng")}
                autocompletePromise={(props) =>
                  CustomerService.getAllAutocompletePromise(props, {
                    fragment: "id name avatarUrl",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatarUrl,
                    }),
                  })
                }
                hasImage
                // onChange={(value) => {
                //   setGameId(value);
                // }}
              />
            </Field>
            <Field name="ownerId" noError>
              <Select
                className="w-56"
                clearable
                placeholder={t("Lọc theo nhân viên")}
                autocompletePromise={(props) =>
                  UserService.getAllAutocompletePromise(props, {
                    fragment: "id name avatar",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatar,
                    }),
                  })
                }
                hasImage
                // onChange={(value) => {
                //   setGameId(value);
                // }}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4" disableDbClick={true}>
          <DataTable.Column
            label={t("Chủ mPoint")}
            render={(item: Wallet) => (
              <DataTable.CellText className="w-32 whitespace-nowrap" value={item?.owner?.name} />
            )}
          />
          <DataTable.Column
            label={t("Số dư")}
            orderBy="balance"
            render={(item: Wallet) => (
              <DataTable.CellNumber className="w-32" value={item.balance} />
            )}
          />

          <DataTable.Column
            label={t("Tổng ra")}
            orderBy="totalOut"
            render={(item: Wallet) => (
              <DataTable.CellNumber className="w-32" value={item.totalOut} />
            )}
          />
          <DataTable.Column
            label={t("Tổng vào")}
            orderBy="totalIn"
            render={(item: Wallet) => (
              <DataTable.CellNumber className="w-32" value={item.totalIn} />
            )}
          />
          <DataTable.Column
            label={t("Ngày tạo")}
            render={(item: Wallet) => (
              <DataTable.CellDate
                className="w-32"
                value={item?.createdAt}
                format="HH:mm dd/MM/yyyy"
              />
            )}
          />
          <DataTable.Column
            right
            label={t("Vai trò")}
            render={(item: Wallet) => (
              <DataTable.CellStatus
                options={ROLES_OPTIONS}
                className="w-32"
                value={item?.owner?.role}
              />
            )}
          />

          <DataTable.Column
            right
            className="whitespace-nowrap"
            render={(item: Wallet) => (
              <>
                {/* <ActiveCellButton
                  item={item}
                  service={WalletService}
                  disabled={!userPermission("EDIT_WALLET")}
                /> */}
                {
                  <DataTable.CellButton
                    value={item}
                    icon={<RiShareBoxFill />}
                    onClick={() =>
                      router.replace({
                        pathname: `/admin/management/${
                          item.owner?.role == UserRoleEnum.STAFF ||
                          item.owner?.role == UserRoleEnum.PARTNER
                            ? "users"
                            : "customers"
                        }`,
                        query: { id: item.ownerId },
                      })
                    }
                    tooltip={t("Đến tài khoản nhân viên")}
                  />
                }
                <DataTable.CellButton
                  value={item}
                  tooltip={t("Nạp mPoint")}
                  className="transform rotate-180 text-success"
                  icon={<BiMoneyWithdraw />}
                  disabled={!userPermission("DEPOSIT_WALLET")}
                  onClick={() => setOpenDeposit(item.id)}
                />
                {user.role == "ADMIN" && (
                  <DataTable.CellButton
                    value={item}
                    textDanger
                    className="text-8"
                    tooltip={t("Rút mPoint")}
                    icon={<BiMoneyWithdraw />}
                    disabled={!userPermission("WITHDRAW_WALLET")}
                    onClick={() => setOpenWithdraw(item.id)}
                  />
                )}
                {/* <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_WALLET")}
                /> */}
                {/* <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("DELETE_WALLET")}
                /> */}
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => <WalletSlideout id={walletId} onSubmit={loadAll} />}
        </DataTable.Consumer>
        <DataTable.Consumer>
          {({ loadAll }) => (
            <DepositWalletDialog
              isOpen={!!openDeposit}
              onClose={() => setOpenDeposit(null)}
              walletId={openDeposit}
              loadAll={loadAll}
            />
          )}
        </DataTable.Consumer>

        <DataTable.Consumer>
          {({ loadAll }) => (
            <WithdrawWalletDialog
              isOpen={!!openWithdraw}
              onClose={() => setOpenWithdraw(null)}
              walletId={openWithdraw}
              loadAll={loadAll}
            />
          )}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
