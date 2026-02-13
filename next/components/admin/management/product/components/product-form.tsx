import { useFormState } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  RiArticleLine,
  RiFileInfoLine,
  RiFolderLine,
  RiMoreLine,
  RiTruckLine,
} from "react-icons/ri";
import { AccordionGroup } from "../../../../shared/utilities/misc/accordion-group";
import { ProductCategory } from "./product-category";
import { ProductDelivery } from "./product-delivery";
import { ProductDetail } from "./product-detail";
import { ProductInfo } from "./product-info";
import { ProductOther } from "./product-other";

const SECTIONS = [
  {
    id: 0,
    component: ProductInfo,
    title: "Thông tin cơ bản",
    description: "Thông tin cơ bản về sản phẩm",
    icon: <RiFileInfoLine className="w-5 h-5" />,
    defaultOpen: true,
    fieldNames: ["imgs", "coverImg", "video", "name", "categoryId", "des"],
  },
  {
    id: 1,
    component: ProductDetail,
    title: "Thông tin chi tiết",
    description: "Mô tả và thông tin chi tiết sản phẩm",
    icon: <RiArticleLine className="w-5 h-5" />,
    defaultOpen: false,
    fieldNames: ["categoryProperties"],
  },
  {
    id: 2,
    component: ProductDelivery,
    title: "Vận chuyển",
    description: "Thông tin về vận chuyển và đóng gói",
    icon: <RiTruckLine className="w-5 h-5" />,
    defaultOpen: false,
    fieldNames: ["delivery"],
  },
  {
    id: 3,
    component: ProductCategory,
    title: "Phân loại sản phẩm",
    description: "Phân loại và thuộc tính sản phẩm",
    icon: <RiFolderLine className="w-5 h-5" />,
    defaultOpen: false,
    fieldNames: ["classification"],
  },
  {
    id: 4,
    component: ProductOther,
    title: "Thông tin khác",
    description: "Các thông tin bổ sung khác",
    icon: <RiMoreLine className="w-5 h-5" />,
    defaultOpen: false,
    fieldNames: ["otherInfo"],
  },
];

export function ProductForm() {
  const { t } = useTranslation();
  // Safely get form state - will be undefined if not in FormProvider
  const formState = useFormState();
  const errors = formState?.errors || {};

  // Check if a section has any errors
  const hasSectionError = (fieldNames: string[]) => {
    return fieldNames.some((fieldName) => {
      // Check if the field name or any nested field has an error
      return Object.keys(errors).some((errorKey) => {
        return errorKey === fieldName || errorKey.startsWith(`${fieldName}.`);
      });
    });
  };

  return (
    <>
      <div className="col-span-full space-y-4">
        {SECTIONS.map((section) => {
          const SectionComponent = section.component;
          const hasError = hasSectionError(section.fieldNames || []);
          return (
            <AccordionGroup
              key={section.id}
              title={t(section.title)}
              description={section.description}
              icon={section.icon}
              defaultOpen={section.defaultOpen}
              hasError={hasError}
            >
              <SectionComponent />
            </AccordionGroup>
          );
        })}
      </div>
    </>
  );
}
