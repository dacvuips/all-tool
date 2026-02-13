import { useTranslation } from "react-i18next";
import { ShippingProviderService } from "../../../../../../lib/repo";
import { Field, Select } from "../../../../../shared/utilities/form";
interface SelectShippingProviderProps { 
  
  onSelectShippingProviderId: (providerId: string) => void;
}
export const SelectShippingProvider = ({
    
  onSelectShippingProviderId,
}: SelectShippingProviderProps) => {
  const { t } = useTranslation();
  return (
    <Field name="provider" label={t("Chọn nhà cung cấp vận chuyển")} required>
      <Select
        className="w-full"
        placeholder={t("Chọn nhà cung cấp")}
        autocompletePromise={(props) =>
          ShippingProviderService.getAllAutocompletePromise(props, {
            fragment: "id name logo isActive",
            parseOption: (data) => ({
              value: data.id,
              label: data.name,
              image: data.logo,
            }),
          })
        }
         
        hasImage
        searchable
        onChange={(value) => {
          onSelectShippingProviderId(value);
        }}
      />
    </Field>
  );
};
