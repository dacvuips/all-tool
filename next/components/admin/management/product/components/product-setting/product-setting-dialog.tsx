import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../../lib/providers/toast-provider";
import { Product, ProductService } from "../../../../../../lib/repo";
import { Form } from "../../../../../shared/utilities/form/form";
import { ProductSettingForm } from "./product-setting-from";
import { ProductSettingView } from "./product-setting-view";

export function ProductSettingDialog({
  isOpen,
  onClose,
  productId,
  loadAll,
}: {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  loadAll: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [product, setProduct] = useState<Product>(null);

  const getProduct = async () => {
    await ProductService.getOne({ id: productId, cache: false }).then((res) => {
      setProduct(res);
    });
  };
  useEffect(() => {
    if (isOpen) {
      getProduct();
    }
  }, [isOpen]);

  const onSubmit = async (data) => {
    await ProductService.createOrUpdate({ id: product.id, data: { ...data } })
      .then((res) => {
        toast.success(`${product.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thành công")}`);

        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${product.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thất bại")}. ${err.message}`
        );
      });
  };
  return (
    <Form
      dialog
      width={"1500px"}
      title={t("Cấu hình sản phẩm")}
      isOpen={isOpen}
      onClose={onClose}
      defaultValues={product}
      onSubmit={onSubmit}
    >
      <div className="flex gap-3  ">
        <ProductSettingForm />
        <ProductSettingView />
      </div>

      <Form.Footer
        className="pb-14 lg:pb-0"
        cancelText=""
        submitProps={{ disabled: !userPermission("EDIT_PRODUCT") }}
      />
    </Form>
  );
}
