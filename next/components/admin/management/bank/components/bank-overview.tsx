import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";

import { Bank, BankService } from "../../../../../lib/repo/list/bank.repo";
import { Field, Form, Input, Select, Switch } from "../../../../shared/utilities/form";

export function BankOverviewTab({ bank, loadAll }: { bank: Bank; loadAll: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [banks, setBanks] = useState<any[]>([]);
  const [bankData, setBankData] = useState<any>(null);

  useEffect(() => {
    Bank();
  }, [bank, bankData]);
  const Bank = async () => {
    await BankService.getBankVietQR()
      .then((res) => {
        const data = [];
        res.data.map((item) => {
          data.push({
            value: item.bin,
            label: `${item.shortName} [ ${item.code} - ${item.bin} ]`,
            image: item.logo,
            data: item,
          });
        });
        setBanks(data);
      })
      .catch((err) => {
        console.log(err);
      });
  };
  const onSubmit = async (data) => {
    await BankService.createOrUpdate({
      id: bank.id,
      data: {
        bankImage: bankData?.logo || bank.bankImage,
        bankName: bankData?.shortName || bank.bankName,
        bankCode: bankData?.code || bank.bankCode,
        ...data,
      },
    })
      .then((res) => {
        toast.success(`${bank.id ? t("Cập nhật") : t("Tạo")} ${t("ngân hàng thành công")}`);

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${bank.id ? t("Cập nhật") : t("Tạo")} ${t("ngân hàng thất bại")}. ${err.message}`
        );
      });
  };

  return (
    <>
      <Form className="grid grid-cols-12 gap-2" defaultValues={bank} onSubmit={onSubmit}>
        <BankForm banks={banks} bank={bank} setBankData={setBankData} />
      </Form>
    </>
  );
}

function BankForm({
  banks,
  bank,
  setBankData,
}: {
  banks: any;
  bank: Bank;
  setBankData: (value: any) => void;
}) {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const { userPermission } = useAuth();
  const { PAYMENT_METHOD_OPTIONS } = useOptionsTranslation();
  return (
    <>
      <Field
        noError
        className="flex-1 "
        label={t("Ngân hàng")}
        tooltip={t("Danh sách ngân hàng.")}
        required
        name="bin"
        cols={sm ? 6 : 12}
      >
        <Select
          clearable
          hasImage
          defaultValue={bank.bin}
          options={banks}
          searchable
          placeholder={t("Chọn ngân hàng")}
          onChange={(value, extra) => {
            setBankData(extra?.data);
          }}
        />
      </Field>

      <Field name="method" label={t("Phương thức thanh toán")} cols={sm ? 6 : 12}>
        <Select options={PAYMENT_METHOD_OPTIONS} />
      </Field>
      <Field name="accountName" label={t("Tên chủ tài khoản")} cols={sm ? 6 : 12}>
        <Input placeholder={t("Nhập tên chủ tài khoản")} />
      </Field>
      <Field name="accountNumber" label={t("Mã số tài khoản")} cols={sm ? 6 : 12}>
        <Input placeholder={t("Nhập số tài khoản ngân hàng")} />
      </Field>

      <Field name="status" label={t("Trạng thái")} cols={sm ? 6 : 12}>
        <Switch placeholder={t("Kích hoạt")} />
      </Field>
      <Form.Footer cancelText="" submitProps={{ disabled: !userPermission("EDIT_BANK") }} />
    </>
  );
}
