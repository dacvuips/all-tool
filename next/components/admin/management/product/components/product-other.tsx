import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { HiOutlineChevronDown, HiOutlineChevronUp } from "react-icons/hi";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { OtherInfoStatus, PreOrder } from "../../../../../lib/repo";
import { Field, Form, Input, Radio, Select } from "../../../../shared/utilities/form";

export function ProductOther() {
  const { t } = useTranslation();
  const { watch, setValue, register } = useFormContext();
  const xs = useScreen("xs");
  register("otherInfo.preOrderDay");
  const preOrder = watch("otherInfo.preOrder");
  const preOrderDay = watch("otherInfo.preOrderDay") || 7;

  const { PRE_ORDER, OTHER_INFO_STATUS } = useOptionsTranslation();
  const min = 7;
  const max = 15;
  const handleClick = (inc: boolean) => {
    if (inc) {
      preOrderDay < 15 && setValue("otherInfo.preOrderDay", +preOrderDay + 1);
    } else {
      preOrderDay > 7 && setValue("otherInfo.preOrderDay", +preOrderDay - 1);
    }
  };

  return (
    <>
      <Form.Title title={t("Thông tin khác")} />
      <Field name="otherInfo.preOrder" noError label={t("Hàng đặt trước")} cols={12}>
        <Radio options={PRE_ORDER} defaultValue={PreOrder.NO} />
      </Field>
      <div className="col-span-12 pl-2 mb-2">
        {preOrder === PreOrder.NO ? (
          <span className="block col-span-12 w-full whitespace-normal break-words">
            {t(
              "Tôi có sẳn hàng và sẽ gửi hàng trong 2 ngày (không bao gòm các ngày nghỉ lễ, Tết và những ngày đơn vị vận chuyển không làm việc"
            )}
          </span>
        ) : (
          <div className="flex col-span-full gap-1 items-center">
            <span>{t("Tôi cần")}</span>
            <div className="flex overflow-hidden rounded-md border">
              <input
                type="number"
                className="px-0 w-10 h-8 text-center"
                value={preOrderDay}
                onChange={(src) => {
                  const val = Number(src.target.value);
                  if (val < min || val > max) {
                    return;
                  } else {
                    setValue("otherInfo.preOrderDay", src);
                  }
                }}
              />
              <div className="flex flex-col px-1 text-gray-500 border-l">
                <HiOutlineChevronUp
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleClick(true)}
                />
                <HiOutlineChevronDown
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => handleClick(false)}
                />
              </div>
            </div>

            <span className="break-words">
              {t("thời gian để chuẩn bị hàng (tối thiểu:7 ngày - tối đa:15 ngày)")}
            </span>
          </div>
        )}
      </div>

      <Field name="otherInfo.status" label={t("Tình trạng")} cols={6}>
        <Select options={OTHER_INFO_STATUS} defaultValue={OtherInfoStatus.NEW} />
      </Field>
      <Field name="otherInfo.sku" label={t("SKU sản phẩm")} cols={6}>
        <Input />
      </Field>
    </>
  );
}
