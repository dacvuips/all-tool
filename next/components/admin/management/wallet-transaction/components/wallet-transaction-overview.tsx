import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  WalletTransaction,
  WalletTransactionService,
} from "../../../../../lib/repo/wallet/wallet-transaction.repo";

export function WalletTransactionOverviewTab({
  walletTransaction,
  loadAll,
}: {
  walletTransaction: WalletTransaction;
  loadAll: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const onSubmit = async (data) => {
    await WalletTransactionService.createOrUpdate({ id: walletTransaction.id, data: { ...data } })
      .then((res) => {
        toast.success(`${walletTransaction.id ? t("Cập nhật") : t("Tạo")} ${t("thành công")}`);

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${walletTransaction.id ? t("Cập nhật") : t("Tạo")} ${t("thất bại")}. ${err.message}`
        );
      });
  };
  return (
    <>
      {/* <Form
        className="grid grid-cols-12 gap-2"
        defaultValues={walletTransaction}
        onSubmit={onSubmit}
      >
        <Field
          name="pictureUrl"
          label="Hình nhà cung cấp"
          cols={12}
          required
          readOnly={!userPermission("EDIT_SUPPLIER")}
        >
          <ImageInput largeImage ratio169 cover />
        </Field>

        <Field name="name" label="Tên nhà cung cấp" cols={8} required>
          <Input placeholder="Vui lòng nhập tên nhà cung cấp" />
        </Field>
        <Field name="code" label="Mã nhà cung cấp" cols={4} required>
          <Input placeholder="Mã định danh nhà cung cấp" />
        </Field>
        <Field name="priority" label="Ưu tiên" cols={2}>
          <Input number placeholder="Thứ tự hiển thị" />
        </Field>
        <Field name="actived" label="Trạng thái" cols={4}>
          <Switch placeholder="Kích hoạt" />
        </Field>
        <Form.Footer submitProps={{ disabled: !userPermission("EDIT_SUPPLIER") }} />
      </Form> */}
    </>
  );
}
