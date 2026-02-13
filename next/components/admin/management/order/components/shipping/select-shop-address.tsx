import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiLocationMarker, HiPhone } from "react-icons/hi";
import { ShopAddress, ShopAddressService } from "../../../../../../lib/repo/list/shopAddress.repo";
import { Dialog, DialogProps } from "../../../../../shared/utilities/dialog/dialog";
import { Button, Radio } from "../../../../../shared/utilities/form";

interface SelectShopAddressProps {
  selectedAddress?: ShopAddress;
  onSelectAddress: (address: ShopAddress) => void;
}

/**
 * Component hiển thị địa chỉ shop đã chọn và dialog để thay đổi
 */
export const SelectShopAddress = ({ selectedAddress, onSelectAddress }: SelectShopAddressProps) => {
  const { t } = useTranslation();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [addresses, setAddresses] = useState<ShopAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempSelectedId, setTempSelectedId] = useState<string>("");

  // Lấy danh sách địa chỉ đã active
  useEffect(() => {
    loadAddresses();
  }, []);

  // Tự động chọn địa chỉ mặc định khi load
  useEffect(() => {
    if (!selectedAddress && addresses.length > 0) {
      const defaultAddress = addresses.find((addr) => addr.default);
      if (defaultAddress) {
        onSelectAddress(defaultAddress);
      } else {
        onSelectAddress(addresses[0]);
      }
    }
  }, [addresses, selectedAddress]);

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const result = await ShopAddressService.getAll({
        fragment: ShopAddressService.fullFragment,
        query: {
          filter: {
            isActive: true,
          },
        },
      });
      setAddresses(result.data || []);
    } catch (error) {
      console.error("Error loading shop addresses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setTempSelectedId(selectedAddress?.id || "");
    setIsOpen(true);
  };

  const handleUpdateClick = () => {
    router.push("/admin/management/shop-address");
  };

  const handleConfirmSelection = () => {
    const selected = addresses.find((addr) => addr.id === tempSelectedId);
    if (selected) {
      onSelectAddress(selected);
    }
    setIsOpen(false);
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">{t("Đang tải địa chỉ...")}</div>;
  }

  return (
    <>
      {/* Hiển thị địa chỉ đã chọn */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            <HiLocationMarker className="inline mr-1" />
            {t("Địa Chỉ Lấy Hàng")}
          </label>
          <button
            type="button"
            onClick={handleOpenDialog}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {t("Thay Đổi")}
          </button>
        </div>

        {selectedAddress ? (
          <div className="p-3 border border-gray-200 rounded-lg bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-1">
                  <span className="font-semibold text-gray-900">
                    {selectedAddress.recipientName}
                  </span>
                  <span className="ml-2 text-gray-600">
                    <HiPhone className="inline mr-1" />
                    {selectedAddress.phone}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedAddress.address}
                  {selectedAddress.ward && `, ${selectedAddress.ward}`}
                  {selectedAddress.district && `, ${selectedAddress.district}`}
                  {selectedAddress.province && `, ${selectedAddress.province}`}
                </div>
              </div>
              {selectedAddress.default && (
                <span className="px-2 py-1 text-xs text-red-600 border border-red-600 rounded">
                  {t("Mặc Định")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 text-center text-gray-500 border border-gray-200 border-dashed rounded-lg">
            {t("Chưa chọn địa chỉ")}
          </div>
        )}
      </div>

      {/* Dialog chọn địa chỉ */}
      <SelectShopAddressDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        addresses={addresses}
        selectedId={tempSelectedId}
        onSelectId={setTempSelectedId}
        onConfirm={handleConfirmSelection}
        onUpdateClick={handleUpdateClick}
      />
    </>
  );
};

/**
 * Dialog để chọn địa chỉ shop
 */
interface SelectShopAddressDialogProps extends DialogProps {
  addresses: ShopAddress[];
  selectedId: string;
  onSelectId: (id: string) => void;
  onConfirm: () => void;
  onUpdateClick: () => void;
}

function SelectShopAddressDialog({
  addresses,
  selectedId,
  onSelectId,
  onConfirm,
  onUpdateClick,
  ...props
}: SelectShopAddressDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      {...props}
      width="600px"
      maxWidth="90vw"
      title={t("Địa Chỉ Của Tôi")}
      slideFromBottom="none"
    >
      <Dialog.Body>
        <div className="space-y-3">
          {addresses.map((address) => (
            <div
              key={address.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedId === address.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
              onClick={() => onSelectId(address.id)}
            >
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <Radio
                    value={selectedId === address.id}
                    options={[{ label: "", value: true }]}
                    onChange={() => onSelectId(address.id)}
                  />
                </div>
                <div className="flex-1 ml-3">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <span className="font-semibold text-gray-900">{address.recipientName}</span>
                      <span className="ml-2 text-sm text-gray-600">{address.phone}</span>
                    </div>
                    {address.default && (
                      <span className="px-2 py-0.5 text-xs text-red-600 border border-red-600 rounded">
                        {t("Mặc định")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600">{address.address}</div>
                  <div className="text-sm text-gray-500">
                    {address.ward && `${address.ward}, `}
                    {address.district && `${address.district}, `}
                    {address.province}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {addresses.length === 0 && (
            <div className="py-8 text-center text-gray-500">{t("Chưa có địa chỉ nào")}</div>
          )}
        </div>{" "}
        <div className="flex items-center justify-between w-full gap-3 mt-3">
          <Button
            onClick={onUpdateClick}
            className="px-4 py-2 text-gray-700 transition-colors border border-gray-300 rounded hover:bg-gray-50"
          >
            {t("Cập nhật/Thêm địa chỉ")}
          </Button>
          <div className="flex gap-2">
            <Button
              onClick={onConfirm}
              disabled={!selectedId}
              className="px-4 py-2 text-white transition-colors rounded bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t("Xác nhận")}
            </Button>
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
