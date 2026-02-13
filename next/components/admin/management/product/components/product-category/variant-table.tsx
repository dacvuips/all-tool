import React from "react";
import { useTranslation } from "react-i18next";
import { uploadImage } from "../../../../../../lib/helpers/image";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { Button, Input, Label } from "../../../../../shared/utilities/form";
import { PhotoIcon } from "./icons";
import { ClassificationGroup, Variant, VariantField } from "./types";

interface Props {
  groups: ClassificationGroup[];
  variants: Variant[];
  updateVariant: (id: string, field: VariantField, value: string) => void;
  updateOptionImage: (optionId: string, imageUrl: string) => void;
  applyBulkEdit: (price: number, stock: number, sku: string) => void;
}

export const VariantTable: React.FC<Props> = ({
  groups,
  variants,
  updateVariant,
  updateOptionImage,
  applyBulkEdit,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [bulkPrice, setBulkPrice] = React.useState(undefined);
  const [bulkStock, setBulkStock] = React.useState(undefined);
  const [bulkSku, setBulkSku] = React.useState("");
  const [uploading, setUploading] = React.useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = React.useState<string | null>(null);
  const [imageUrl, setImageUrl] = React.useState("");

  const group1 = groups[0];
  const group2 = groups[1];

  // Helper to trigger file input
  const handleImageUploadClick = (optionId: string) => {
    const input = document.getElementById(`file-input-${optionId}`) as HTMLInputElement;
    if (input) input.click();
  };

  const handleUrlSubmit = (optionId: string) => {
    if (imageUrl.trim()) {
      updateOptionImage(optionId, imageUrl.trim());
      setImageUrl("");
      setShowUrlInput(null);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, optionId: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        setUploading(optionId);
        const res = await uploadImage(file);
        updateOptionImage(optionId, res.link);
      } catch (err) {
        console.error(err);
        toast.error(t("Upload ảnh thất bại. Xin thử lại."));
      } finally {
        setUploading(null);
        // Reset input để có thể chọn lại file giống nhau
        e.target.value = "";
      }
    }
  };

  if (!group1) return null;

  return (
    <>
      <div className="mt-2 col-span-full">
        <Label text={t("Danh sách phân loại hàng")} />
        <div className="flex-1 w-full">
          {/* Bulk Edit Bar */}
          <div className="flex items-center gap-4 p-3 mb-4 border border-gray-200 rounded bg-gray-50">
            <Input
              number
              showZeroDefaultValue={false}
              value={bulkPrice}
              onChange={(value) => setBulkPrice(value)}
              placeholder={t("Giá")}
              className="w-32"
            />
            <Input
              number
              showZeroDefaultValue={false}
              value={bulkStock}
              onChange={(value) => setBulkStock(value)}
              placeholder={t("Kho hàng")}
              className="w-32"
            />
            <Input
              type="text"
              value={bulkSku}
              onChange={(e) => setBulkSku(e.target.value)}
              placeholder={t("SKU phân loại")}
              className="w-32"
            />
            <Button
              text={t("Áp dụng tất cả")}
              danger
              className="flex-1"
              onClick={() => applyBulkEdit(bulkPrice, bulkStock, bulkSku)}
            />
          </div>

          {/* Table */}
          <div className="col-span-12 border border-gray-200 rounded">
            <table className="w-full text-sm text-left">
              <thead className="font-medium text-gray-600 bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-center border-r border-gray-200 w-26">
                    {group1.name}
                  </th>
                  {group2 && (
                    <th className="px-4 py-3 text-center border-r border-gray-200">
                      {group2.name}
                    </th>
                  )}
                  <th className="w-32 px-4 py-3 text-center border-r border-gray-200">
                    {t("Giá")}
                  </th>
                  <th className="w-32 px-4 py-3 text-center border-r border-gray-200">
                    {t("Kho hàng")}
                  </th>
                  <th className="w-40 px-4 py-3 text-center">{t("SKU phân loại")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {variants.map((variant, index) => {
                  const option1 = group1.options.find((o) => o.code === variant.option1Id);
                  const option2 = group2
                    ? group2.options.find((o) => o.code === variant.option2Id)
                    : null;

                  // Safety check: If option1 is missing (stale variant), skip rendering to prevent crash
                  if (!option1) return null;

                  // Safety check: If group2 exists with options, but variant is missing option2 (stale), skip
                  if (group2 && group2.options.length > 0 && !option2) return null;

                  // Determine row span for the first column
                  // If group2 exists AND has options, we group by group1 options.
                  // If group2 exists but has 0 options (edge case), we treat as 1-to-1 mapping.
                  const effectiveGroup2Count =
                    group2 && group2.options.length > 0 ? group2.options.length : 1;

                  const isFirstOfGroup = index % effectiveGroup2Count === 0;

                  return (
                    <tr key={variant.code} className="hover:bg-gray-50">
                      {/* Column 1: Group 1 Option (Merged Cells) */}
                      {isFirstOfGroup && (
                        <td
                          className="px-4 py-4 align-top bg-white border-r border-gray-200"
                          rowSpan={effectiveGroup2Count}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-gray-700">{option1.name}</span>

                            {/* Image Upload for Group 1 Option */}
                            {showUrlInput === option1.code ? (
                              <div className="flex flex-col gap-2">
                                <input
                                  type="text"
                                  value={imageUrl}
                                  onChange={(e) => setImageUrl(e.target.value)}
                                  placeholder={t("Nhập URL ảnh")}
                                  className="w-48 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleUrlSubmit(option1.code);
                                    }
                                  }}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    text={t("Xác nhận")}
                                    small
                                    primary
                                    onClick={() => handleUrlSubmit(option1.code)}
                                  />
                                  <Button
                                    text={t("Hủy")}
                                    small
                                    onClick={() => {
                                      setShowUrlInput(null);
                                      setImageUrl("");
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <div
                                  className="relative cursor-pointer group"
                                  onClick={() => !uploading && handleImageUploadClick(option1.code)}
                                >
                                  <input
                                    type="file"
                                    id={`file-input-${option1.code}`}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => handleFileChange(e, option1.code)}
                                    disabled={uploading === option1.code}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                      }
                                    }}
                                  />
                                  {option1.image ? (
                                    <div className="relative">
                                      <img
                                        src={option1.image}
                                        alt="preview"
                                        className="object-cover w-20 h-20 border border-gray-300 rounded-sm"
                                      />
                                      {uploading === option1.code && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-sm">
                                          <div className="w-6 h-6 border-2 border-white rounded-full animate-spin border-t-transparent"></div>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      className={`flex flex-col justify-center items-center w-20 h-20 text-red-500 bg-red-50 rounded-sm border border-red-300 border-dashed transition-colors ${
                                        uploading === option1.code
                                          ? "opacity-50 cursor-wait"
                                          : "hover:bg-red-100"
                                      }`}
                                    >
                                      {uploading === option1.code ? (
                                        <div className="w-6 h-6 border-2 border-red-500 rounded-full animate-spin border-t-transparent"></div>
                                      ) : (
                                        <>
                                          <PhotoIcon className="w-6 h-6 mb-1" />
                                          <span className="text-sm">+</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  text={t("Nhập URL")}
                                  small
                                  className="text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowUrlInput(option1.code);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Column 2: Group 2 Option */}
                      {group2 && (
                        <td className="px-4 py-4 text-center text-gray-700 border-r border-gray-200">
                          {option2?.name}
                        </td>
                      )}

                      {/* Price Input */}
                      <td className="px-4 py-4 border-r border-gray-200">
                        <Input
                          number
                          value={variant.price}
                          onChange={(value) => updateVariant(variant.code, "price", value)}
                          placeholder={t("Nhập giá")}
                          suffix={"đ"}
                          showZeroDefaultValue={false}
                          suffixClassName="border-l"
                          className="w-28"
                        />
                      </td>

                      {/* Stock Input */}
                      <td className="px-4 py-4 border-r border-gray-200">
                        <Input
                          number
                          value={variant.stock}
                          onChange={(value) => updateVariant(variant.code, "stock", value)}
                          placeholder={t("Tồn kho")}
                          className="w-24"
                        />
                      </td>

                      {/* SKU Input */}
                      <td className="px-4 py-4">
                        <Input
                          value={variant.sku}
                          onChange={(e) => updateVariant(variant.code, "sku", e.target.value)}
                          className="w-32"
                          placeholder={t("Nhập SKU")}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {variants.length === 0 && (
              <div className="p-8 text-sm text-center text-gray-400 bg-white border-t border-gray-100">
                {t(
                  "Chưa có phân loại hàng nào. Vui lòng thêm các tùy chọn phân loại (ví dụ: Màu sắc, Kích thước)."
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
