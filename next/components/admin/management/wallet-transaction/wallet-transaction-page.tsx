import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { RiShareBoxFill } from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { WalletTransactionTypeEnum } from "../../../../lib/repo/types";
import {
  WalletTransaction,
  WalletTransactionService,
} from "../../../../lib/repo/wallet/wallet-transaction.repo";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { WalletTransactionSlideout } from "./components/wallet-transaction-slideout";

export function WalletTransactionPage(props) {
  const { t } = useTranslation();
  const router = useRouter();
  const [walletTransactionId, setWalletTransactionId] = useState<string>(null);
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const {
    WALLET_TRANSACTION_SIDE_OPTIONS,
    WALLET_TRANSACTION_STATUS_OPTIONS,
    WALLET_TRANSACTION_TYPE_OPTIONS,
  } = useOptionsTranslation();

  useEffect(() => {
    if (router.query["create"]) {
      setWalletTransactionId("");
    } else if (router.query["id"]) {
      setWalletTransactionId(router.query["id"] as string);
    } else {
      setWalletTransactionId(null);
    }
  }, [router.query]);

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

  return (
    <Card>
      <DataTable<WalletTransaction>
        crudService={WalletTransactionService}
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
          <DataTable.Search style={{ width: "300px" }} />
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
            <Field name="side" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo hướng")}
                options={WALLET_TRANSACTION_SIDE_OPTIONS}
              />
            </Field>
            <Field name="type" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo loại")}
                options={WALLET_TRANSACTION_TYPE_OPTIONS}
              />
            </Field>
            <Field name="status" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo trạng thái")}
                options={WALLET_TRANSACTION_STATUS_OPTIONS}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4" disableDbClick={true}>
          <DataTable.Column
            className="w-32"
            label={t("Thông tin")}
            render={(item: WalletTransaction) => (
              <div className="flex flex-col">
                <span className="">
                  <span className="font-semibold ">{`${t("Chủ ví")}: `}</span>
                  <span className="font-semibold text-primary">
                    {item.ownerCustomer?.name || item.ownerUser?.name}
                  </span>
                </span>

                <span className="">
                  <span className="font-semibold ">{`${t("Mã")}: `}</span>
                  <span>{item.code.slice(-6)}</span>
                </span>
                <DataTable.CellDate
                  className="whitespace-nowrap"
                  value={item.createdAt}
                  format="HH:mm dd/MM/yyyy"
                />
              </div>
            )}
          />
          <DataTable.Column
            orderBy="amount"
            className="whitespace-nowrap"
            label={t("Số mPoint")}
            render={(item: WalletTransaction) => <DataTable.CellNumber value={item.amount} />}
          />

          <DataTable.Column
            orderBy="balance"
            label={t("Số dư")}
            render={(item: WalletTransaction) => <DataTable.CellNumber value={item.balance} />}
          />
          <DataTable.Column
            label={t("Nội dung")}
            render={(item: WalletTransaction) => (
              <DataTable.CellText className="min-w-2xs" value={item.description} />
            )}
          />
          <DataTable.Column
            center
            label={t("Hướng giao dịch")}
            className="whitespace-nowrap"
            render={(item: WalletTransaction) => (
              <DataTable.CellStatus options={WALLET_TRANSACTION_SIDE_OPTIONS} value={item.side} />
            )}
          />
          <DataTable.Column
            center
            label={t("Loại")}
            render={(item: WalletTransaction) => (
              <DataTable.CellStatus options={WALLET_TRANSACTION_TYPE_OPTIONS} value={item.type} />
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
          <DataTable.Column
            right
            render={(item: WalletTransaction) => (
              <>
                {item.type == WalletTransactionTypeEnum.EXCHANGE_FEE && (
                  <DataTable.CellButton
                    value={item}
                    isEditButton
                    icon={<RiShareBoxFill />}
                    onClick={() =>
                      router.replace({
                        pathname: "/admin/management/game-orders",
                        query: { id: item.specificInfo[0].value },
                      })
                    }
                    tooltip={t("Đến đơn hàng")}
                  />
                )}
                {/* <ActiveCellButton
                  item={item}
                  service={WalletTransactionService}
                  disabled={!userPermission("EDIT_WALLETTRANSACTION")}
                />
                <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_WALLETTRANSACTION")}
                />
                <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("DELETE_WALLETTRANSACTION")}
                /> */}
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => (
            <WalletTransactionSlideout id={walletTransactionId} onSubmit={loadAll} />
          )}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
