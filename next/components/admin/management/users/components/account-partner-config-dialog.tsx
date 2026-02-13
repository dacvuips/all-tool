import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { UserService } from "../../../../../lib/repo";
import { Field, Form, Input, Switch } from "../../../../shared/utilities/form";

export function SettingUserDialog({ userId, ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission, user } = useAuth();
  const [config, setConfig] = useState<any>();

  useEffect(() => {
    props.isOpen && GetPartnerConfig();
  }, [props.isOpen]);
  const GetPartnerConfig = async () => {
    await UserService.getPartnerConfig(userId).then((res: any) => {
      setConfig(res);
    });
  };

  return (
    <Form
      grid
      title={t("Cài đặt giới hạn tài khoản")}
      width={700}
      dialog
      slideFromBottom="none"
      defaultValues={config}
      onSubmit={(data) => {
        UserService.setPartnerConfig(userId, {
          maximumOpenOrder: data.maximumOpenOrder,
          minimumWalletBalance: data.minimumWalletBalance,
          maximumOrderValue: data.maximumOrderValue,
          isWithdrawExchangeFee: data.isWithdrawExchangeFee,
        })
          .then((res) => {
            toast.success(t("Cập nhật cài đặt tài khoản thành công"));
            props.onClose();
          })
          .catch((err) => toast.error(`${t("Cập nhật cài đặt tài khoản thất bại")}, ${err}`));
      }}
      {...props}
    >
      <Field
        name="minimumWalletBalance"
        label={t("Giới hạn số mPoint thấp nhất trong ví mPoint")}
        cols={12}
        description={t(
          "Đây là số mPoint thấp nhất trong ví mPoint phải có để giao dịch và giới hạn tổng số tiền đơn hàng đang giao dịch phải nhỏ hơn số mPoint này, tại đây sẽ tính toán tiền tổng các đơn lại và đề xuất đơn thấp hơn giới hạn tổng còn lại"
        )}
      >
        <Input
          defaultValue={config?.minimumWalletBalance}
          number
          placeholder={t("Nhập số mPoint thấp nhất trong ví mPoint")}
        />
      </Field>
      <Field
        name="maximumOrderValue"
        label={t("Giá trị đơn hàng tối đa")}
        cols={12}
        description={t("Đây là giá trị lớn nhất của đơn hàng có thể nhìn thấy ở bản chờ giao dịch")}
      >
        <Input
          defaultValue={config?.maximumOrderValue}
          number
          placeholder={t("Nhập giá trị đơn hàng tối đa")}
        />
      </Field>
      <Field
        tooltip={t(
          "Số giao dịch tài khoản này có thể giao dịch cùng một lúc, khi giao dịch thành công thì phải chờ quản lý xác nhận đơn thành công"
        )}
        name="maximumOpenOrder"
        label={t("Giới hạn số giao dịch")}
        cols={6}
      >
        <Input
          defaultValue={config?.maximumOpenOrder}
          number
          placeholder={t("Nhập số lượng giao dịch nhiều nhất có thể")}
        />
      </Field>
      <Field name="isWithdrawExchangeFee" label={t("Trừ phí giao dịch sàn")} cols={6}>
        <Switch
          className="whitespace-nowrap"
          defaultValue={config?.isWithdrawExchangeFee}
          placeholder={t("Kích hoạt")}
        />
      </Field>
      <Form.Footer
        submitText={t("Lưu ngay")}
        submitProps={{ disabled: !userPermission("LIMIT_USER") || userId == user.id }}
      />
    </Form>
  );
}
