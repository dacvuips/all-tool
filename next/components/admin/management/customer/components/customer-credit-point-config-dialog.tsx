import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import {} from "../../../../../lib/repo/types";
import { Field, Form, Input, Select } from "../../../../shared/utilities/form";

export function CustomerCreditPointConfigDialog({ customer, ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [action, setAction] = useState<any>("add");
  const { CUSTOMER_CREDIT_POINT_ACTION } = useOptionsTranslation();

  return (
    <Form
      grid
      title={t("Điều chỉnh điểm tín dụng khách hàng")}
      width={700}
      dialog
      slideFromBottom="none"
      onSubmit={(data) => {
        CustomerService.customerCreditPoint({
          customerId: customer.id,
          point: data.point,
          action: action,
        })
          .then((res) => {
            toast.success(t("Cập nhật điểm tín dụng khách hàng thành công"));
            props.onClose();
            props.loadAll(true);
          })
          .catch((err) =>
            toast.error(`${t("Cập nhật điểm tín dụng khách hàng thất bại")}, ${err}`)
          );
      }}
      {...props}
    >
      <div className="col-span-12 mb-5">
        <span>
          {`${t("Điểm tín dụng hiện tại")}:`} <b>{customer.creditPoint + `/100 ${t("điểm")}`}</b>
        </span>
      </div>
      <Field
        name="point"
        label={t("Số điểm tăng/giảm")}
        cols={12}
        description={t("Số điểm bạn muốn tăng hoặc giảm cho khách hàng")}
        required
      >
        <Input
          number
          placeholder={t("Số điểm")}
          suffixInputFocus={false}
          suffix={
            <Select
              className="w-44 rounded-l-none border-t-0 border-r-0 border-b-0 w-text-gray-600"
              options={CUSTOMER_CREDIT_POINT_ACTION}
              value={action}
              onChange={(value) => {
                setAction(value);
              }}
            />
          }
        />
      </Field>

      <Form.Footer
        submitProps={{ disabled: !userPermission("EDIT_CUSTOMER") }}
        submitText={t("Điều chỉnh")}
      />
    </Form>
  );
}
