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
export function WithdrawWalletDialog({ ...props }: Props) {
  const { t } = useTranslation();
  const { userPermission } = useAuth();

  const toast = useToast();
  const alert = useAlert();
  const onSubmit = async (data) => {
    alert.warn(
      t("Xác nhận rút mPoint"),
      t("Bạn có chắc muốn rút mPoint ra khỏi tài khoản mPoint này không"),
      t("Xác nhận"),
      async () => {
        await WalletService.withdrawManual({
          walletId: props.walletId,
          amount: data.amount,
          description: data.description,
        })
          .then((res) => {
            toast.success(t("Rút mPoint thành công"));
            props.onClose();
            props.loadAll(true);
          })
          .catch((err) => toast.error(`${t("Rút mPoint thất bại")}, ${err}`));
        return true;
      }
    );
  };
  return (
    <>
      <Form
        title={t("Rút mPoint khỏi ví mPoint")}
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
          submitText={t("Rút")}
          submitProps={{ disabled: !userPermission("WITHDRAW_WALLET") }}
        />
      </Form>
    </>
  );
}
