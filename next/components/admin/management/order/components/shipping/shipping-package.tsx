import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Order } from "../../../../../../lib/repo";
import { NotifyText } from "../../../../../shared/common/notify-text";
import { Field, Input, Label } from "../../../../../shared/utilities/form";
import { Img } from "../../../../../shared/utilities/misc";

interface ShippingPackageProps {
  order: Order;
  onWeightChange?: (totalItemsWeight: number, packageWeight: number, length: number, width: number, height: number) => void;  
   
 
}

export const ShippingPackage = ({ order, onWeightChange }: ShippingPackageProps) => {
  const { t } = useTranslation();

  // Try to use form context if available
  
  const { watch, setValue } = useFormContext();
  

  // Tính tổng khối lượng của các items
  const total = (order?.items || []).reduce((total, item) => {
    // Giả sử mỗi item có weight, nếu không có thì = 0
    const weight = (item as any)?.weight || 0;

    return total + weight * item.quantity;
  }, 0);

  const [localTotalItemsWeight, setLocalTotalItemsWeight] = useState(total);
  const [localPackageWeight, setLocalPackageWeight] = useState(0);
   const item = order.items[0] as any;
 
  const [length, setLength] = useState(item.length);
  const [width, setWidth] = useState(item.width);
  const [height, setHeight] = useState(item.height);
 
  const totalItemsWeight = watch("totalItemsWeight") ?? localTotalItemsWeight;
  const packageWeight = watch("packageWeight") ?? localPackageWeight;

  // Tổng khối lượng = items + thùng đóng gói
  const totalWeight = totalItemsWeight + packageWeight;

  // Notify parent component when weights change

  // Notify parent component when weights change
  useEffect(() => {
    if (onWeightChange) {
      onWeightChange(totalItemsWeight, packageWeight, length, width, height);
    }
  }, [totalItemsWeight, packageWeight, length, width, height, onWeightChange]);

  return (
    <div className="rounded-md">
      <h3 className="mb-4 text-lg font-semibold">{t("Thông tin gói hàng")} </h3>
      {/* Thông tin Items */}
      <div className="mb-6">
        <h4 className="mb-3 text-sm font-medium text-gray-700">{t("Danh sách sản phẩm")}</h4>
        <div className="space-y-3">
          {order?.items?.map((item, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-3 border border-gray-200 rounded-lg bg-white"
            >
              <div className="flex items-start flex-1 gap-3">
                {item.thumbnail && (
                  <Img
                    src={item.thumbnail}
                    alt={item.productName}
                    className="object-cover w-16 h-16 rounded-md"
                  />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium uppercase mb-0.5">{item.productName}</p>
                  {item.variantName && <p className="text-xs text-gray-500 mb-1">{item.variantName}</p>}
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>
                      D: {(item as any)?.length || 0}cm
                    </span>
                    <span>
                      R: {(item as any)?.width || 0}cm
                    </span>
                    <span>
                      C: {(item as any)?.height || 0}cm
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium mb-1">
                  <span className="text-gray-500 font-normal">SL:</span> {item.quantity}
                </p>
                <p className="text-sm text-gray-600">
                  {(item as any)?.weight
                    ? `${(
                        (item as any)?.weight * item.quantity
                      ).toLocaleString()}g`
                    : "0g"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Thông tin khối lượng */}
      <div className="pt-4 space-y-4 border-t">
        <div className="grid grid-cols-12 gap-x-5">
          {/* Input khối lượng sản phẩm */}
          <Field name="totalItemsWeight" label={t("Tổng khối lượng sản phẩm (gram)")} cols={6}>
            <Input
              defaultValue={total}
              value={watch("totalItemsWeight")}
              onChange={
                (_val, num) => setLocalTotalItemsWeight(Number(num) || 0)
              }
              number
              placeholder={t("Tổng khối lượng sản phẩm")}
              className="w-full"
            />
          </Field>
          {/* Input khối lượng thùng đóng gói */}
          <Field name="packageWeight" label={t("Khối lượng thùng đóng gói (gram)")} cols={6}>
            <Input
              value={watch("packageWeight")}
              onChange={(_val, num) => setLocalPackageWeight(Number(num) || 0)}
              number
              decimal
              placeholder={t("Nhập khối lượng thùng đóng gói")}
              className="w-full"
            />
          </Field>
          <Field  label={t("Dài (cm)")} cols={4}>
              <Input
                value={length}
                onChange={(_val, num) => setLength(Number(num) || 0)}     
                number
                placeholder={t("Dài")}
                className="w-full"
              />
            </Field>
            <Field label={t("Rộng (cm)")} cols={4}>
              <Input
                value={width}
                onChange={(_val, num) => setWidth(Number(num) || 0)}
                number
                placeholder={t("Rộng")}
                className="w-full"
              />
            </Field>
            <Field label={t("Cao (cm)")} cols={4}>
              <Input
                value={height}
                onChange={(_val, num) => setHeight(Number(num) || 0)}
                number
                placeholder={t("Cao")}
                className="w-full"
              />
            </Field>
        </div>
<NotifyText text={t("Mặt định lấy kích thước của sản phẩm đầu tiên")}/>
        {/* Kích thước gói hàng */}
     
         
         
          {(length * width * height) / 5 > totalWeight && (
            <div className="p-3 text-sm text-red-600">
              {t("Cảnh báo: Trọng lượng quy đổi")} ({(length * width * height) / 5}g){" "}
              {t("lớn hơn trọng lượng thực tế")} ({totalWeight}g).
            </div>
          )}
        

        {/* Tổng khối lượng */}
      </div>
      <div className="bg-gray-50 mb-2 flex items-start justify-between p-3 border border-gray-200 rounded-lg bg-white">
        <div className="flex items-start flex-1 gap-3">
          <div className="flex-1">
            <TextLabel
        title={t("Tổng khối lượng gói hàng")}
        value={`${totalWeight.toLocaleString()} (gram)`}
        classColor="text-primary"
        tooltip={`${t("Tổng khối lượng gói hàng")} + ${t("Khối lượng thùng đóng gói")}`}
      />
      <TextLabel  
        title={t("Tổng khối lượng quy đổi từ kích thước")}
        tooltip="(Dài * Rộng * Cao) / 5"
        value={`${((length * width * height) / 5).toLocaleString()} (gram)`}
        classColor="text-red-600"
      />
            
            <div className="flex gap-3 text-xs text-gray-500">
              <span>D: {length} cm</span>
              <span>R: {width} cm</span>
              <span>C: {height} cm</span>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

const TextLabel = ({
  title,
  value,
  tooltip,
  classColor,
}: {
  title: string;
  value: string;
  tooltip?: string;
  classColor: string;
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between">
       <Label
        text={title}
        htmlFor=""
        required={false}
        error={""} 
        tooltip={tooltip}
      />
      <span className={`text-md font-semibold whitespace-nowrap ${classColor}`}>{value}</span>
    </div>
  );
};
