import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiOutlineTrash, HiPlus } from "react-icons/hi";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { UserService } from "../../../../../lib/repo";
import { Button, Field, Form, Input } from "../../../../shared/utilities/form";

export function UserBanksDialog({ userId, ...props }) {
  const { t } = useTranslation();
  const toast = useToast();
  const sm = useScreen("sm");
  const { userPermission, user } = useAuth();
  const { control } = useForm();
  const { append, remove, fields } = useFieldArray({
    name: "banks",
    control,
  });
  const name = "banks";

  useEffect(() => {
    if (props.isOpen) {
      fields.map((field, index) => {
        remove(index);
      });
      GetUserBanks();
      return;
    } else {
      fields.map((field, index) => {
        remove(index);
      });
      return;
    }
  }, [props.isOpen]);
  const GetUserBanks = async () => {
    await UserService.clearStore();
    await UserService.getUserBanks(userId).then((res: any) => {
      res.banks.map((bank) => {
        append({
          bankAccount: bank.bankAccount,
          bankNumber: bank.bankNumber,
          bankName: bank.bankName,
        });
      });
    });
  };

  return (
    <>
      <Form
        width={700}
        dialog
        slideFromBottom="none"
        title={t("Danh sách tài khoản ngân hàng")}
        {...props}
        onSubmit={async (data) => {
          await UserService.setUserBanks(userId, data.banks)
            .then((res) => {
              props.onClose();
              toast.success(t("Cập nhật ngân hàng thành công"));
            })
            .catch((err) => {
              toast.error(`${t("Cập nhật ngân hàng thất bại")}, ${err}`);
            });
        }}
      >
        {(fields as any[])?.map((item, index) => (
          <div
            className="grid grid-cols-12 mb-3 border-b border-gray-200 sm:gap-5"
            key={`${item}` + index}
          >
            <Field
              label={t("Chủ tài khoản")}
              name={`${name}.${index}.bankAccount`}
              // validation={{ code: true }}
              required
              cols={sm ? 4 : 12}
            >
              <Input defaultValue={item.bankAccount} />
            </Field>

            <Field
              label={t("Số tài khoản")}
              name={`${name}.${index}.bankNumber`}
              required
              cols={sm ? 4 : 12}
            >
              <Input defaultValue={item.bankNumber} />
            </Field>
            <Field label={t("Tên ngân hàng")} name={`${name}.${index}.bankName`} cols={sm ? 3 : 12}>
              <Input defaultValue={item.bankName} />
            </Field>

            <Button
              className="mb-2 sm:mt-7"
              icon={<HiOutlineTrash />}
              outline
              hoverDanger
              onClick={() => {
                remove(index);
              }}
            />
          </div>
        ))}
        <Button
          accent
          text={t("Thêm ngân hàng")}
          icon={<HiPlus />}
          disabled={!userPermission("EDIT_GAME")}
          onClick={() => {
            append({ bankAccount: null, bankNumber: null, bankName: null });
          }}
        />
        <Form.Footer
          submitText={t("Lưu ngay")}
          submitProps={{ disabled: !userPermission("BANK_USER") || userId == user.id }}
        />
      </Form>
    </>
  );
}
