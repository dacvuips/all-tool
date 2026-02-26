import { useTranslation } from "react-i18next";
import { HiX } from "react-icons/hi";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Product, ProductService } from "../../../../../lib/repo";
import { Form } from "../../../../shared/utilities/form/form";
import { ProductField } from "./product-field";
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

  const handleSubmitCreateEdit = async (data: any) => {
    try {
      await ProductService.createOrUpdate({
        id: mode === "edit" ? product?.id : undefined,
        data,
      });
      toast.success(
        mode === "edit" ? t("Cập nhật sản phẩm thành công") : t("Tạo sản phẩm thành công")
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(`${mode === "edit" ? t("Cập nhật") : t("Tạo")} ${t("thất bại")}: ${err.message}`);
    }
  };

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
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: mode === "settings" ? "880px" : "520px",
          maxWidth: "95vw",
          background: "#111827",
          borderLeft: "1px solid rgba(79,70,229,0.3)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.4)",
          zIndex: 1001,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1), width 0.3s",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ color: "white", fontWeight: 700, fontSize: "16px" }}>{title}</div>
            {product && mode !== "create" && (
              <div
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: "12px",
                  marginTop: "2px",
                }}
              >
                {product.name}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "8px",
              color: "white",
              padding: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
            }}
          >
            <HiX />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
          {isOpen && (mode === "create" || mode === "edit") && (
            <Form
              grid
              defaultValues={mode === "edit" ? product : {}}
              onSubmit={handleSubmitCreateEdit}
            >
              <ProductField />
              <Form.Footer
                className="pb-0 mt-4"
                cancelText={t("Hủy")}
                cancelProps={{ onClick: onClose }}
                submitProps={{
                  disabled:
                    mode === "edit"
                      ? !userPermission("EDIT_PRODUCT")
                      : !userPermission("CREATE_PRODUCT"),
                }}
              />
            </Form>
          )}

          {isOpen && mode === "settings" && (
            <Form
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
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ProductSettingForm />
                </div>
                <ProductSettingView />
              </div>
              <Form.Footer
                className="pb-0 mt-4"
                cancelText={t("Hủy")}
                cancelProps={{ onClick: onClose }}
                submitProps={{ disabled: !userPermission("EDIT_PRODUCT") }}
              />
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
