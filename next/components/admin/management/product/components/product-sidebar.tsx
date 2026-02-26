import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Product, ProductService } from "../../../../../lib/repo";
import { Label } from "../../../../shared/utilities/form";
import { Form } from "../../../../shared/utilities/form/form";
import type { FlowNodeData } from "./product-node";
import { ProductSettingForm } from "./product-setting/product-setting-from";
import { ProductSettingView } from "./product-setting/product-setting-view";

export type SidebarMode = "create" | "edit" | "settings" | null;

interface ProductSidebarProps {
  mode: SidebarMode;
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
  /** Khi chỉnh cấu hình 1 node trong flow */
  editingNodeId?: string | null;
  selectedNodeData?: FlowNodeData | null;
  onUpdateNode?: (
    nodeId: string,
    data: {
      label?: string;
      properties?: FlowNodeData["properties"];
      config?: FlowNodeData["config"];
    }
  ) => void;
}

export function ProductSidebar({
  mode,
  product,
  onClose,
  onSuccess,
  editingNodeId,
  selectedNodeData,
  onUpdateNode,
}: ProductSidebarProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  const isOpen = mode !== null;
  const isEditingNode = mode === "settings" && !!editingNodeId && !!onUpdateNode;

  const handleSubmitSettings = async (data: any) => {
    if (isEditingNode && editingNodeId && onUpdateNode) {
      onUpdateNode(editingNodeId, {
        label: data.label,
        properties: data.properties,
        config: data.config,
      });
      toast.success(t("Cập nhật node thành công"));
      onSuccess();
      return;
    }
    try {
      await ProductService.createOrUpdate({
        id: product?.id,
        data: {
          ...data,
          flow: product?.flow,
        },
      });
      toast.success(t("Cấu hình sản phẩm thành công"));
      onSuccess();
    } catch (err: any) {
      toast.error(`${t("Cấu hình thất bại")}: ${err.message}`);
    }
  };

  const title =
    mode === "create"
      ? t("Tạo sản phẩm")
      : mode === "edit"
      ? t("Chỉnh sửa sản phẩm")
      : isEditingNode
      ? t("Cấu hình node")
      : t("Cấu hình sản phẩm");

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div onClick={onClose} className="fixed inset-0 bg-black/45 z-1000 backdrop-blur-2px" />
      )}

      {/* Sidebar panel */}
      <div
        className={`flex overflow-hidden fixed right-0 top-14 flex-col w-full h-full bg-white border-l  transition-transform ease-in-out transform z-100 duration-350 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          width: "70%",
          height: "calc(100vh - 57px)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 justify-between items-center px-4 py-2 bg-gray-100">
          <div>
            <Label className="text-lg" text={title} />
            <div className="text-gray-800">{product?.name}</div>
          </div>
        </div>

        {/* Content: scrollable form + footer cố định dưới */}
        <div className="flex flex-col flex-1 min-h-0">
          {isOpen && (
            <Form
              className="flex flex-col flex-1 min-h-0"
              defaultValues={
                isEditingNode && selectedNodeData
                  ? {
                      label: selectedNodeData.label,
                      properties: selectedNodeData.properties ?? [],
                      config: selectedNodeData.config ?? {},
                    }
                  : {
                      ...product,
                      properties: product?.flow?.nodes?.[0]?.data?.properties ?? [],
                      config: product?.flow?.nodes?.[0]?.data?.config ?? {},
                    }
              }
              onSubmit={handleSubmitSettings}
            >
              <div className="overflow-auto flex-1 p-4 min-h-0">
                <div className="flex gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <ProductSettingForm />
                  </div>
                  <ProductSettingView />
                </div>
              </div>
              <div className="flex-shrink-0 px-2 pt-0 pb-1 border-t border-gray-100">
                <Form.Footer
                  cancelText={t("Hủy")}
                  cancelProps={{ onClick: onClose }}
                  submitProps={{ disabled: !userPermission("EDIT_PRODUCT") }}
                />
              </div>
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
