import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AddressService } from "../../../../lib/repo";

import { Field, Select } from "../form";

interface Props extends ReactProps {
  provinceName?: string;
  districtName?: string;
  wardName?: string;
  provinceLabel?: string;
  districtLabel?: string;
  wardLabel?: string;
  provinceRequired?: boolean;
  districtRequired?: boolean;
  wardRequired?: boolean;
  cols?: Cols;
}

export function AddressFields({
  provinceName = "province",
  districtName = "district",
  wardName = "ward",
  provinceLabel = "Tỉnh/Thành",
  districtLabel = "Quận/Huyện",
  wardLabel = "Phường/Xã",
  provinceRequired = false,
  districtRequired = false,
  wardRequired = false,
  cols = 12,
}: Props) {
  const { setValue } = useFormContext();
  const [districtOptions, setDistrictOptions] = useState<Option[]>();
  const [wardOptions, setWardOptions] = useState<Option[]>();

  const province = useWatch({ name: provinceName });
  const district = useWatch({ name: districtName });

  useEffect(() => {
    if (province) {
      AddressService.getDistricts(province)
        .then((res) => setDistrictOptions(res.map((x) => ({ value: x.name, label: x.name }))))
        .catch((err) => {
          console.error("Error loading districts:", err);
          setDistrictOptions([]);
        });
    } else {
      setDistrictOptions([]);
    }
    setWardOptions([]);
    setValue(districtName, "");
    setValue(wardName, "");
  }, [province]);

  useEffect(() => {
    if (district) {
      AddressService.getWards(district)
        .then((res) => setWardOptions(res.map((x) => ({ value: x.name, label: x.name }))))
        .catch((err) => {
          console.error("Error loading wards:", err);
          setWardOptions([]);
        });
    } else {
      setWardOptions([]);
    }
    setValue(wardName, "");
  }, [district]);

  return (
    <>
      <Field name={provinceName} label={provinceLabel} cols={cols} required={provinceRequired}>
        <Select
          optionsPromise={() =>
            AddressService.getProvinces().then((res) =>
              res.map((x) => ({ value: x.name, label: x.name }))
            )
          }
          onChange={(val) => {
            setValue(districtName, "");
            setValue(wardName, "");
          }}
        />
      </Field>
      <Field name={districtName} label={districtLabel} cols={cols} required={districtRequired}>
        <Select
          options={districtOptions}
          onChange={(val) => {
            setValue(wardName, "");
          }}
        />
      </Field>
      <Field name={wardName} label={wardLabel} cols={cols} required={wardRequired}>
        <Select options={wardOptions} />
      </Field>
    </>
  );
}
