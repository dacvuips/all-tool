import { useTranslation } from "react-i18next";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { WalletService } from "../../../../../lib/repo/wallet/wallet.repo";
import { DialogProps } from "../../../../shared/utilities/dialog/dialog";
import { Field, Form, Input } from "../../../../shared/utilities/form";

interface Props extends DialogProps {
  walletId: string;
  loadAll: (value: boolean) => any;
}
export function DepositWalletDialog({ ...props }: Props) {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const toast = useToast();
  const alert = useAlert();
  const onSubmit = async (data) => {
    alert.warn(
      t("Xác nhận nạp mPoint"),
      t("Bạn có chắc muốn nạp mPoint vào tài khoản ví mPoint này không"),
      t("Xác nhận"),
      async () => {
        await WalletService.depositManual({
          walletId: props.walletId,
          amount: data.amount,
          description: data.description,
        })
          .then((res) => {
            toast.success(t("Nạp mPoint thành công"));
            props.onClose();
            props.loadAll(true);
          })
          .catch((err) => toast.error(`${t("Nạp mPoint thất bại")}, ${err}`));
        return true;
      }
    );
  };
  return (
    <>
      <Form
        title={t("Nạp mPoint vào ví")}
        dialog
        grid
        slideFromBottom="none"
        onSubmit={onSubmit}
        {...props}
      >
        <Field name="amount" label={t("Số mPoint")} required>
          <Input number />
        </Field>
        <Field name="description" label={t("Lý do")} required>
          <Input placeholder={t("Nhập lý do")} />
        </Field>
        <Form.Footer
          submitText={t("Nạp")}
          submitProps={{ disabled: !userPermission("DEPOSIT_WALLET") }}
        />
      </Form>
    </>
  );
}
