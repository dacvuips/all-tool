import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../../lib/helpers/parser";
import { useOptionsTranslation } from "../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Pagination } from "../../../lib/repo/crud.repo";
import {
  WalletTransaction,
  WalletTransactionService,
} from "../../../lib/repo/wallet/wallet-transaction.repo";
import { Dialog } from "../utilities/dialog/dialog";
import { DataTable } from "../utilities/table/data-table";
import { TablePagination } from "../utilities/table/table-pagination";

export function WalletTransactionDialog({ ...props }) {
  const { t } = useTranslation();
  const router = useRouter();
  const lg = useScreen("lg");
  const sm = useScreen("sm");
  const [walletTransaction, setWalletTransaction] = useState<any>(null);
  const {
    WALLET_TRANSACTION_SIDE_OPTIONS,
    WALLET_TRANSACTION_STATUS_OPTIONS,
    WALLET_TRANSACTION_TYPE_OPTIONS,
  } = useOptionsTranslation();
  useEffect(() => {
    GetWalletTransaction();
  }, []);

  const GetWalletTransaction = async (page?: Pagination) => {
    await WalletTransactionService.getTransactions({
      cache: false,
      query: { page: page?.page, order: { createdAt: -1 } },
    }).then((res) => {
      setWalletTransaction(res);
    });
  };

  return (
    <>
      <Dialog
        slideFromBottom={"none"}
        title={t("Lịch sử nạp")}
        width={1000}
        maxWidth={!sm ? "96vw" : "86vw"}
        {...props}
      >
        <Dialog.Body>
          <DataTable.Header>
            {(router.pathname.startsWith("/shop") || router.pathname.startsWith("/partner")) && (
              <div className="flex items-center gap-2">
                <DataTable.Button
                  primary
                  text={t("Nạp mPoint")}
                  onClick={() => {
                    props.onClose();
                    if (router.pathname.startsWith("/shop")) {
                      router.push("/shop/deposits");
                    } else if (router.pathname.startsWith("/partner")) {
                      router.push("/partner/management/deposits");
                    }
                  }}
                />
                <DataTable.Button
                  outline
                  text={t("Xem thêm")}
                  onClick={() => {
                    props.onClose();
                    if (router.pathname.startsWith("/shop")) {
                      router.push("/shop/wallet-transaction-history");
                    } else if (router.pathname.startsWith("/partner")) {
                      router.push("/partner/management/wallet-transaction-history");
                    }
                  }}
                />
              </div>
            )}
            <DataTable.Button outline isRefreshButton onClick={() => GetWalletTransaction()} />
          </DataTable.Header>

          <DataTable.Table className="mt-4" disableDbClick={true} items={walletTransaction?.data}>
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
                      <span className="font-semibold whitespace-nowrap">{`${t("Số dư")}: `}</span>
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
                  render={(item: WalletTransaction) => (
                    <DataTable.CellNumber value={item.balance} />
                  )}
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
          {walletTransaction && (
            <TablePagination
              visiblePageCount={4}
              pagination={walletTransaction?.pagination}
              setPagination={(page) => {
                GetWalletTransaction(page);
              }}
            />
          )}
        </Dialog.Body>
      </Dialog>
    </>
  );
}
