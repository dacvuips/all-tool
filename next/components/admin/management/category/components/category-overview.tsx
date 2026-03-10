import { useTranslation } from "react-i18next";
import { useScreen } from "../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";

import { Category, CategoryService } from "../../../../../lib/repo";
import { Field, Form, ImageInput, Input, Select, Switch } from "../../../../shared/utilities/form";

function flattenForSelect(
  nodes: Category[],
  level = 0,
  excludeId?: string,
  excludeDescendantIds?: Set<string>
): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const prefix = "— ".repeat(level);
  for (const n of nodes) {
    if (n.id === excludeId || excludeDescendantIds?.has(n.id)) continue;
    options.push({ value: n.id, label: prefix + (n.name || "(Chưa đặt tên)") });
    if (n.children?.length)
      options.push(...flattenForSelect(n.children, level + 1, excludeId, excludeDescendantIds));
  }
  return options;
}

function getDescendantIds(nodes: Category[], parentId: string): Set<string> {
  const set = new Set<string>();
  const flat: Category[] = [];
  const walk = (items: Category[]) => {
    items.forEach((c) => {
      flat.push(c);
      if (c.children?.length) walk(c.children);
    });
  };
  walk(nodes);
  const addDescendants = (id: string) => {
    flat
      .filter((c) => c.parentId === id)
      .forEach((c) => {
        set.add(c.id);
        addDescendants(c.id);
      });
  };
  addDescendants(parentId);
  return set;
}

export function CategoryOverviewTab({
  category,
  loadAll,
  loadTree,
  parentOptions = [],
}: {
  category: Category;
  loadAll: () => void;
  loadTree?: () => void;
  parentOptions?: Category[];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const sm = useScreen("sm");
  const xl = useScreen("xl");
  const { userPermission } = useAuth();

  const parentSelectOptions = [
    { value: "", label: t("(Danh mục gốc)") },
    ...flattenForSelect(
      parentOptions,
      0,
      category?.id,
      category?.id ? getDescendantIds(parentOptions, category.id) : undefined
    ),
  ];

  const onSubmit = async (data) => {
    const payload = { ...data, parentId: data.parentId || undefined };
    await CategoryService.createOrUpdate({ id: category.id, data: payload })
      .then((res) => {
        toast.success(`${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thành công")}`);
        loadTree?.();
        loadAll();
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          `${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thất bại")}. ${err.message}`
        );
      });
  };
  return (
    <>
      <Form className="grid grid-cols-12 gap-2" defaultValues={category} onSubmit={onSubmit}>
        <Field label={t("Danh mục cha")} name="parentId" cols={xl ? 2 : sm ? 4 : 6}>
          <Select options={parentSelectOptions} clearable placeholder={t("Chọn danh mục cha")} />
        </Field>
        <Field label={t("Tên")} name="name" required cols={xl ? 2 : sm ? 4 : 6}>
          <Input placeholder={t("Nhập tên danh mục")} />
        </Field>

        <Field label={t("Mô tả")} name="description" cols={xl ? 2 : sm ? 4 : 6}>
          <Input placeholder={t("Nhập mô tả")} />
        </Field>
        <Field label={t("Hình ảnh")} name="imgUrl" cols={xl ? 2 : sm ? 4 : 6}>
          <ImageInput placeholder={t("Nhập link ảnh")} />
        </Field>

        <Field label={t("Ưu tiên")} name="priority" cols={xl ? 1 : sm ? 4 : 6}>
          <Input number placeholder={t("Nhập số ưu tiên")} />
        </Field>
        <Field label={t("Trạng thái")} name="active" cols={xl ? 1 : sm ? 4 : 6}>
          <Switch />
        </Field>

        <Form.Footer
          className="pb-14 lg:pb-0"
          cancelText=""
          submitProps={{ disabled: !userPermission("EDIT_CATEGORY") }}
        />
      </Form>
    </>
  );
}
