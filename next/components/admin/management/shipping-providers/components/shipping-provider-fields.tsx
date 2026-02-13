import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiDeleteBin6Line } from "react-icons/ri";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Textarea,
} from "../../../../shared/utilities/form";
import { Switch } from "../../../../shared/utilities/form/switch";

/**
 * Component form để tạo/sửa thông tin nhà cung cấp vận chuyển
 * Bao gồm các field: thông tin cơ bản, cấu hình API, danh sách dịch vụ
 */
export function ShippingProviderFields() {
  const { t } = useTranslation();
  const sm = useScreen("sm");
  const { watch, setValue, register } = useFormContext();
  const { SHIPPING_PROVIDER_CODE_OPTIONS } = useOptionsTranslation();
  // Theo dõi giá trị services để render động
  const services = watch("services") || [];
  register("name");
  // Khởi tạo services nếu chưa có
  useEffect(() => {
    if (!services || services.length === 0) {
      setValue("services", [
        {
          serviceCode: "",
          serviceName: "",
          isActive: true,
          estimatedTime: "",
          description: "",
        },
      ]);
    }
  }, []);

  /**
   * Thêm một dịch vụ mới vào danh sách
   */
  const handleAddService = () => {
    const newServices = [
      ...services,
      {
        serviceCode: "",
        serviceName: "",
        isActive: true,
        estimatedTime: "",
        description: "",
      },
    ];
    setValue("services", newServices);
  };

  /**
   * Xóa một dịch vụ khỏi danh sách
   */
  const handleRemoveService = (index: number) => {
    const newServices = services.filter((_, i) => i !== index);
    setValue("services", newServices);
  };

  return (
    <>
      {/* Phần thông tin cơ bản */}
      <div className="col-span-12">
        <h3 className="mb-3 text-lg font-semibold text-gray-800">{t("Thông tin cơ bản")}</h3>
      </div>
      {/* Tên nhà cung cấp */}
      {/* Mã nhà cung cấp */}
      <Field name="code" label={t("Mã nhà cung cấp")} cols={sm ? 3 : 6} required>
        <Select
          options={SHIPPING_PROVIDER_CODE_OPTIONS}
          onChange={(value) => {
            setValue(
              "name",
              SHIPPING_PROVIDER_CODE_OPTIONS.find((opt) => opt.value === value)?.label || ""
            );
          }}
        />
      </Field>
      {/* Logo nhà cung cấp */}
      <Field name="logo" label={t("Logo")} cols={sm ? 4 : 6}>
        <ImageInput />
      </Field>
      {/* Độ ưu tiên */}
      <Field name="priority" label={t("Độ ưu tiên")} cols={sm ? 2 : 6}>
        <Input number placeholder={t("Số càng nhỏ càng ưu tiên")} />
      </Field>
      {/* Trạng thái hoạt động */}
      <Field name="isActive" label={t("Trạng thái")} cols={sm ? 3 : 6}>
        <Switch placeholder={t("Kích hoạt")} />
      </Field>
      {/* Mô tả */}
      <Field name="description" label={t("Mô tả")} cols={12}>
        <Textarea placeholder={t("Mô tả về nhà cung cấp")} rows={2} />
      </Field>
      {/* Phần cấu hình API */}
      <Form.Title title={t("Cấu hình API")} />
      {/* Base URL */}
      <Field  name="apiConfig.baseUrl" label={t("Base URL")} cols={sm ? 8 : 12} required >
        <Input type="url" placeholder={t("VD: https://online-gateway.ghn.vn")} />
      </Field>{" "}
      {/* Shop ID */}
      <Field name="apiConfig.shopId" label={t("Shop ID")} cols={sm ? 4 : 12}>
        <Input placeholder={t("ID shop trên hệ thống")} />
      </Field>
      {/* Token */}
      <Field name="apiConfig.token" label={t("Token")} cols={sm ? 6 : 12} required>
        <Input type="password" placeholder={t("Token xác thực API")} />
      </Field>
      {/* API Key bổ sung */}
      <Field name="apiConfig.apiKey" label={t("API Key")} cols={sm ? 6 : 12}>
        <Input type="password" placeholder={t("API key bổ sung (nếu có)")} />
      </Field>
      {/* Phần danh sách dịch vụ */}
      <div className="col-span-12 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">{t("Danh sách dịch vụ")}</h3>
          <Button
            small
            primary
            icon={<RiAddLine />}
            text={t("Thêm dịch vụ")}
            onClick={handleAddService}
          />
        </div>
      </div>
      {/* Render từng dịch vụ */}
      {services.map((service, index) => (
        <ServiceItem
          key={index}
          index={index}
          onRemove={handleRemoveService}
          canRemove={services.length > 1}
        />
      ))}
    </>
  );
}

/**
 * Component con hiển thị form cho từng dịch vụ
 */
interface ServiceItemProps {
  index: number;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

function ServiceItem({ index, onRemove, canRemove }: ServiceItemProps) {
  const { t } = useTranslation();
  const sm = useScreen("sm");

  return (
    <div className="relative col-span-12 p-4 mb-3 border border-gray-300 rounded-lg">
      {/* Nút xóa dịch vụ */}
      {canRemove && (
        <button
          type="button"
          className="absolute text-red-500 top-2 right-2 hover:text-red-700"
          onClick={() => onRemove(index)}
        >
          <RiDeleteBin6Line size={20} />
        </button>
      )}

      <div className="grid grid-cols-12 gap-3">
        {/* Mã dịch vụ */}
        <Field
          name={`services.${index}.serviceCode`}
          label={t("Mã dịch vụ")}
          cols={sm ? 3 : 12}
          required
        >
          <Input placeholder={t("VD: EXPRESS")} className="uppercase" />
        </Field>

        {/* Tên dịch vụ */}
        <Field
          name={`services.${index}.serviceName`}
          label={t("Tên dịch vụ")}
          cols={sm ? 3 : 12}
          required
        >
          <Input placeholder={t("VD: Giao hàng nhanh")} />
        </Field>

        {/* Thời gian ước tính */}
        <Field
          name={`services.${index}.estimatedTime`}
          label={t("Thời gian ước tính")}
          cols={sm ? 3 : 12}
        >
          <Input placeholder={t("VD: 2-3 ngày")} />
        </Field>

        {/* Trạng thái */}
        <Field name={`services.${index}.isActive`} label={t("Kích hoạt")} cols={sm ? 3 : 12}>
          <Switch />
        </Field>

        {/* Mô tả dịch vụ */}
        <Field name={`services.${index}.description`} label={t("Mô tả")} cols={12}>
          <Textarea placeholder={t("Mô tả về dịch vụ")} rows={2} />
        </Field>
      </div>
    </div>
  );
}
