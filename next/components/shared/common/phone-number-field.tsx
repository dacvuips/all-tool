import { useTranslation } from "react-i18next";
import { HiOutlinePhone } from "react-icons/hi";
import { Field, Input } from "../utilities/form";

interface PhoneNumberFieldProps {
  required?: boolean;
  name: string;
}
export const PhoneNumberField = ({ required, name }: PhoneNumberFieldProps) => {
  const { t } = useTranslation();
  return (
    <Field
      className={`w-full`}
      name={name}
      label={t("Số điện thoại")}
      required={required}
      validation={{ number: true, min: 6 }}
    >
      <Input
        className="text-sm font-light border-gray-200 sm:h-12 sm:text-base"
        placeholder={t("Nhập số điện thoại")}
        suffix={<HiOutlinePhone />}
        prefixInputFocus={false}
        prefixClassName="border-r px-1 w-20"
      />
    </Field>
  );
};
