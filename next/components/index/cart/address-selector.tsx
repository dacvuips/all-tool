import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AddressService } from "../../../lib/repo";
import { Input } from "../../shared/utilities/form";
import { Field } from "../../shared/utilities/form/field";
import { Select } from "../../shared/utilities/form/select";

interface AddressSelectorProps {
  className?: string;
}

export function AddressSelector({ className = "" }: AddressSelectorProps) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext();
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [districts, setDistricts] = useState<Option[]>([]);
  const [wards, setWards] = useState<Option[]>([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const address = watch("address");
  const province = watch("province");
  const district = watch("district");
  const ward = watch("ward");

  const [selectedProvince, setSelectedProvince] = useState(province);
  const [selectedDistrict, setSelectedDistrict] = useState(district);
  const [selectedWard, setSelectedWard] = useState(ward);

  useEffect(() => {
    setLoadingProvinces(true);
    AddressService.getProvinces()
      .then((res) => {
        setProvinces(res.map((x) => ({ value: x.name, label: x.name })));
      })
      .catch((err) => {
        console.error("Error loading provinces:", err);
      })
      .finally(() => {
        setLoadingProvinces(false);
      });
  }, []);

  // Load districts when province changes
  useEffect(() => {
    if (selectedProvince) {
      setDistricts([]);
      setWards([]);
      setSelectedDistrict("");
      setSelectedWard("");

      setLoadingDistricts(true);
      AddressService.getDistricts(selectedProvince)
        .then((res) => {
          setDistricts(res.map((x) => ({ value: x.name, label: x.name })));
        })
        .catch((err) => {
          console.error("Error loading districts:", err);
          setDistricts([]);
        })
        .finally(() => {
          setLoadingDistricts(false);
        });
    } else {
      setDistricts([]);
      setWards([]);
    }
  }, [selectedProvince]);

  // Load wards when district changes
  useEffect(() => {
    if (selectedDistrict) {
      setWards([]);
      setSelectedWard("");

      setLoadingWards(true);
      AddressService.getWards(selectedDistrict)
        .then((res) => {
          setWards(res.map((x) => ({ value: x.name, label: x.name })));
        })
        .catch((err) => {
          console.error("Error loading wards:", err);
          setWards([]);
        })
        .finally(() => {
          setLoadingWards(false);
        });
    } else {
      setWards([]);
    }
  }, [selectedDistrict]);

  const handleProvinceChange = (value: string) => {
    setSelectedProvince(value);
    setSelectedDistrict("");
    setSelectedWard("");
    setValue("district", ""); // Clear district in form
    setValue("ward", ""); // Clear ward in form
  };

  const handleDistrictChange = (value: string) => {
    setSelectedDistrict(value);
    setSelectedWard("");
    setValue("ward", ""); // Clear ward in form
  };

  const handleWardChange = (value: string) => {
    setSelectedWard(value);
  };

  const textAddress = `${address}${ward && `, ${ward}`}${district && `, ${district}`}${
    province && `, ${province}`
  }`;
  return (
    <div className={`grid grid-cols-12 col-span-12 gap-x-4 ${className}`}>
      <Field
        name="province"
        label={t("Tỉnh/Thành phố")}
        required
        className="col-span-12 md:col-span-4"
      >
        <Select
          value={selectedProvince}
          options={provinces}
          onChange={handleProvinceChange}
          placeholder={loadingProvinces ? t("Đang tải...") : t("Chọn Tỉnh/Thành phố")}
          readOnly={loadingProvinces}
          loading={loadingProvinces}
        />
      </Field>

      <Field name="district" label={t("Quận/Huyện")} required className="col-span-12 md:col-span-4">
        <Select
          value={selectedDistrict}
          options={districts}
          onChange={handleDistrictChange}
          placeholder={loadingDistricts ? t("Đang tải...") : t("Chọn Quận/Huyện")}
          readOnly={!selectedProvince || districts.length === 0 || loadingDistricts}
          loading={loadingDistricts}
        />
      </Field>

      <Field name="ward" label={t("Phường/Xã")} required className="col-span-12 md:col-span-4">
        <Select
          value={selectedWard}
          options={wards}
          onChange={handleWardChange}
          placeholder={loadingWards ? t("Đang tải...") : t("Chọn Phường/Xã")}
          readOnly={!selectedDistrict || wards.length === 0 || loadingWards}
          loading={loadingWards}
        />
      </Field>
      <Field
        name={"address"}
        label={t("Địa chỉ giao hàng")}
        description={t("Chỉ nhập số nhà và tên đường")}
        required
        className="col-span-12"
      >
        <Input placeholder={t("Nhập Số nhà và tên đường")} />
      </Field>
      <span className="col-span-12 p-1 mb-3 -mt-3 text-sm text-gray-600 border border-dashed rounded-md bg-gray-50">
        <span className="font-semibold text-primary-dark">{`${t("Địa chỉ đầy đủ")}:`}</span>{" "}
        {textAddress}
      </span>
    </div>
  );
}
