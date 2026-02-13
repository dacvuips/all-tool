import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Wallet, WalletService } from "../../../../../lib/repo/wallet/wallet.repo";
import { Field, Form, Input } from "../../../../shared/utilities/form";

export function WalletOverviewTab({ wallet, loadAll }: { wallet: Wallet; loadAll: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const onSubmit = async (data) => {
    await WalletService.depositManual({
      walletId: wallet.id,
      amount: data.amount,
      description: data.description,
    })
      .then((res) => {
        toast.success(t("Nạp mPoint thành công"));

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("Nạp mPoint thất bại"));
      });
  };
  return (
    <>
      <Form className="grid grid-cols-12 gap-2" defaultValues={wallet} onSubmit={onSubmit}>
        <Field name="amount" label={t("Số mPoint")} required>
          <Input number placeholder={t("Nhập số mPoint cần nạp")} />
        </Field>
        <Field name="description" label={t("Mô tả")} required>
          <Input placeholder={t("Nhập mô tả")} />
        </Field>
        <Form.Footer submitProps={{ disabled: !userPermission("EDIT_WALLET") }} />
      </Form>
    </>
  );
}
