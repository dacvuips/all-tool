import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";

import { useTranslation } from "react-i18next";
import { RiRepeatLine } from "react-icons/ri";
import { useAlert } from "../../../../lib/providers/alert-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Bank, BankService } from "../../../../lib/repo/list/bank.repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { BankSlideout } from "./components/bank-slideout";

export function BankPage(props) {
  const { t } = useTranslation();
  const [bankId, setBankId] = useState<string>(null);
  const { userPermission } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const alert = useAlert();
  useEffect(() => {
    if (router.query["create"]) {
      setBankId("");
    } else if (router.query["id"]) {
      setBankId(router.query["id"] as string);
    } else {
      setBankId(null);
    }
  }, [router.query]);

  return (
    <Card>
      <DataTable<Bank>
        crudService={BankService}
        order={{ createdAt: 1 }}
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
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_BANK")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter></DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Table className="mt-4">
          <DataTable.Column
            className="w-32"
            label={t("Hình ảnh")}
            render={(item: Bank) => (
              <DataTable.CellImage ratio169 className="w-28" value={item.bankImage} />
            )}
          />
          <DataTable.Column
            label={t("Tên ngân hàng")}
            render={(item: Bank) => <DataTable.CellText value={item.bankName} />}
          />
          <DataTable.Column
            center
            label={t("Mã ngân hàng")}
            render={(item: Bank) => <DataTable.CellText value={item.bankCode} />}
          />
          <DataTable.Column
            label={t("Chủ tài khoản")}
            render={(item: Bank) => (
              <DataTable.CellText
                className="whitespace-nowrap"
                value={item.accountName}
                subText={item.accountNumber}
              />
            )}
          />
          <DataTable.Column
            center
            label={t("Phương thức thanh toán")}
            render={(item: Bank) => <DataTable.CellText value={item.method} />}
          />

          <DataTable.Column
            right
            className="whitespace-nowrap"
            render={(item: Bank) => (
              <>
                <DataTable.CellButton
                  value={item}
                  icon={<RiRepeatLine />}
                  tooltip={t("Đồng bộ dữ liệu")}
                  onClick={async () => {
                    await alert.warn(
                      t("XÁC NHẬN ĐỒNG BỘ"),
                      t("Bạn có chắc chắn muốn đồng bộ lại thanh toán cho đơn hàng này?"),
                      t("Xác nhận"),
                      async () => {
                        // await orderService
                        //   .syncCassoTransaction(item.accountNumber)
                        //   .then((res) => {
                        //     toast.success(t("Đồng bộ thành công."));
                        //   })

                        //   .catch((err) => {
                        //     toast.error(`{t(Đồng bộ thất bại)}, ${err}`);
                        //   });

                        return true;
                      }
                    );
                  }}
                  disabled={!userPermission("PAYMENT_ORDER")}
                />

                <DataTable.CellButton
                  value={item}
                  isEditButton
                  disabled={!userPermission("EDIT_BANK")}
                />
                <DataTable.CellButton
                  hoverDanger
                  value={item}
                  isDeleteButton
                  disabled={!userPermission("EDIT_BANK")}
                />
              </>
            )}
          />
        </DataTable.Table>
        <DataTable.Pagination />

        <DataTable.Consumer>
          {({ loadAll }) => <BankSlideout id={bankId} onSubmit={loadAll} />}
        </DataTable.Consumer>
      </DataTable>
    </Card>
  );
}
