import { User } from "../../../../../lib/repo";

import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../../lib/helpers/parser";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import {
  WalletTransaction,
  WalletTransactionService,
} from "../../../../../lib/repo/wallet/wallet-transaction.repo";
import { Field, Select } from "../../../../shared/utilities/form";
import { DataTable } from "../../../../shared/utilities/table/data-table";

interface Props extends ReactProps {
  user: User;
  setUser: (user: User) => any;
}

export function AccountWalletTransaction({ user, setUser }: Props) {
  return (
    <>
      <ProfileWallet user={user} setUser={setUser} />
    </>
  );
}

function ProfileWallet({ user, setUser }: Props) {
  const { t } = useTranslation();
  const lg = useScreen("lg");
  const sm = useScreen("sm");
  const {
    WALLET_TRANSACTION_SIDE_OPTIONS,
    WALLET_TRANSACTION_STATUS_OPTIONS,
    WALLET_TRANSACTION_TYPE_OPTIONS,
  } = useOptionsTranslation();

  return (
    <>
      <DataTable<WalletTransaction>
        crudService={WalletTransactionService}
        filter={{ ownerId: user.id }}
        order={{ createdAt: -1 }}
      >
        <DataTable.Toolbar className={`${!lg ? "overflow-x-scroll" : ""}`}>
          <DataTable.Search />
          <DataTable.Filter>
            <Field name="side" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo hướng")}
                options={WALLET_TRANSACTION_SIDE_OPTIONS}
                menuPosition="fixed"
              />
            </Field>
            <Field name="type" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo loại")}
                options={WALLET_TRANSACTION_TYPE_OPTIONS}
                menuPosition="fixed"
              />
            </Field>
            <Field name="status" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo trạng thái")}
                options={WALLET_TRANSACTION_STATUS_OPTIONS}
                menuPosition="fixed"
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>
        <DataTable.Table className="mt-4" disableDbClick={true}>
          {!lg ? (
            <DataTable.Column
              label={t("Thông tin")}
              render={(item: WalletTransaction) => (
                <>
                  <span>
                    <span className="font-semibold whitespace-nowrap">{`${t("Ngày")}: `}</span>
                    <span>{formatDate(item.createdAt, "HH:mm dd-MM-yyyy")}</span>
                  </span>
                  <div className="flex gap-1">
                    <span className="font-semibold whitespace-nowrap">{`${t("Số dư")}: `} </span>
                    <DataTable.CellNumber value={item.balance} />
                  </div>
                  <div className="flex gap-1">
                    <span className="font-semibold whitespace-nowrap">{`${t("MPoint")}: `}</span>
                    <DataTable.CellNumber value={item.amount} />
                  </div>
                  <span>
                    <span className="font-semibold ">{`${t("Mô tả")}: `}</span>
                    <span>{item.description}</span>
                  </span>
                </>
              )}
            />
          ) : (
            <>
              <DataTable.Column
                label={t("Ngày")}
                render={(item: WalletTransaction) => (
                  <DataTable.CellDate value={item.createdAt} format="HH:mm dd-MM-yyyy" />
                )}
              />
              <DataTable.Column
                label={t("Số dư")}
                render={(item: WalletTransaction) => <DataTable.CellNumber value={item.balance} />}
              />
              <DataTable.Column
                label={t("Số mPoint")}
                render={(item: WalletTransaction) => <DataTable.CellNumber value={item.amount} />}
              />
              <DataTable.Column
                label={t("Mô tả")}
                render={(item: WalletTransaction) => (
                  <DataTable.CellText value={item.description} />
                )}
              />
            </>
          )}
          {!lg ? (
            <DataTable.Column
              center
              label={t("Trạng thái")}
              render={(item: WalletTransaction) => (
                <div className="flex flex-col gap-1">
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_SIDE_OPTIONS}
                    value={item.side}
                  />
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_TYPE_OPTIONS}
                    value={item.type}
                  />
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_STATUS_OPTIONS}
                    value={item.status}
                  />
                </div>
              )}
            />
          ) : (
            <>
              <DataTable.Column
                center
                label={t("Hướng giao dịch")}
                render={(item: WalletTransaction) => (
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_SIDE_OPTIONS}
                    value={item.side}
                  />
                )}
              />
              <DataTable.Column
                center
                label={t("Loại")}
                render={(item: WalletTransaction) => (
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_TYPE_OPTIONS}
                    value={item.type}
                  />
                )}
              />
              <DataTable.Column
                right
                label={t("Trạng thái")}
                render={(item: WalletTransaction) => (
                  <DataTable.CellStatus
                    options={WALLET_TRANSACTION_STATUS_OPTIONS}
                    value={item.status}
                  />
                )}
              />
            </>
          )}
        </DataTable.Table>
        <DataTable.Pagination hasOptions={sm ? true : false} visiblePageCount={sm ? 4 : 3} />
      </DataTable>
    </>
  );
}
