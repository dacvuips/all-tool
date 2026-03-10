import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Category, CategoryService } from "../../../../lib/repo";
import { Slideout } from "../../../shared/utilities/dialog/slideout";
import { Field, Form, ImageInput, Input, Select, Switch } from "../../../shared/utilities/form";
import { Card, Spinner } from "../../../shared/utilities/misc";
import { CategoryTree } from "./components/category-tree";

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

export function CategoryPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userPermission } = useAuth();
  const toast = useToast();

  const [tree, setTree] = useState<Category[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [slideoutId, setSlideoutId] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingParentId, setPendingParentId] = useState<string | undefined>(undefined);

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const data = await CategoryService.getCategoryTree();
      setTree(data || []);
    } catch (err) {
      console.error(err);
      setTree([]);
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (slideoutId !== null) {
      if (slideoutId === "") {
        setSelectedId(null);
        setCategory({ parentId: pendingParentId });
        setPendingParentId(undefined);
      } else {
        CategoryService.getOne({ id: slideoutId }).then((res) => {
          setCategory(res);
          setSelectedId(res?.id ?? null);
        });
      }
    } else {
      setCategory(null);
      setSelectedId(null);
    }
  }, [slideoutId]);

  const onCloseSlideout = useCallback(() => {
    setSlideoutId(null);
    router.replace({ pathname: router.pathname, query: {} });
  }, [router]);

  useEffect(() => {
    if (router.query["create"]) {
      setPendingParentId(undefined);
      setSlideoutId("");
    } else if (router.query["id"]) {
      setSlideoutId(router.query["id"] as string);
    } else if (!router.query["create"] && !router.query["id"]) {
      setSlideoutId(null);
    }
  }, [router.query]);

  const handleSelect = useCallback(
    (item: Category | null) => {
      if (!item) {
        setCategory(null);
        setSelectedId(null);
        return;
      }
      setSelectedId(item.id);
      setSlideoutId(item.id);
      router.replace({ pathname: router.pathname, query: { id: item.id } });
      CategoryService.getOne({ id: item.id }).then((res) => setCategory(res));
    },
    [router]
  );

  const handleAddChild = useCallback(
    (parent: Category | null) => {
      setSelectedId(null);
      setPendingParentId(parent?.id ?? undefined);
      setSlideoutId("");
      router.replace({ pathname: router.pathname, query: { create: true } });
    },
    [router]
  );

  const handleSubmit = useCallback(
    async (data: Partial<Category>) => {
      if (!category) return;
      const payload = { ...data, parentId: data.parentId || undefined };
      try {
        await CategoryService.createOrUpdate({ id: category.id, data: payload });
        toast.success(`${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thành công")}`);
        loadTree();
        onCloseSlideout();
      } catch (err) {
        console.error(err);
        toast.error(
          `${category.id ? t("Cập nhật") : t("Tạo")} ${t("danh mục thất bại")}. ${
            (err as Error).message
          }`
        );
      }
    },
    [category, loadTree, onCloseSlideout, t, toast]
  );

  const canEdit = userPermission("EDIT_CATEGORY");
  const parentSelectOptions = [
    { value: "", label: t("(Danh mục gốc)") },
    ...flattenForSelect(
      tree,
      0,
      category?.id,
      category?.id ? getDescendantIds(tree, category.id) : undefined
    ),
  ];

  return (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold text-gray-800">{t("Quản lý danh mục")}</h1>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white min-h-[400px]">
        {loadingTree ? (
          <div className="flex justify-center items-center py-20">
            <Spinner />
          </div>
        ) : (
          <CategoryTree
            categories={tree}
            selectedId={selectedId}
            onSelect={handleSelect}
            onAddChild={handleAddChild}
            onRefresh={loadTree}
            disabled={!canEdit}
          />
        )}
      </div>

      <Slideout
        width="92vw"
        maxWidth="800px"
        isOpen={slideoutId !== null}
        onClose={onCloseSlideout}
      >
        {slideoutId === null ? null : (
          <div className="p-6" style={{ minHeight: "calc(100vh - 64px)" }}>
            {category === null ? (
              <div className="flex flex-col justify-center items-center py-20 text-gray-500">
                <p className="text-base">{t("Đang tải...")}</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {category?.id ? t("Chỉnh sửa danh mục") : t("Thêm danh mục")}
                  </h2>
                </div>
                <Form
                  className="grid grid-cols-12 gap-2"
                  defaultValues={category}
                  onSubmit={handleSubmit}
                >
                  <Field label={t("Danh mục cha")} name="parentId" cols={6}>
                    <Select
                      options={parentSelectOptions}
                      clearable
                      placeholder={t("Chọn danh mục cha")}
                    />
                  </Field>
                  <Field label={t("Tên")} name="name" required cols={6}>
                    <Input placeholder={t("Nhập tên danh mục")} />
                  </Field>
                  <Field label={t("Mô tả")} name="description" cols={6}>
                    <Input placeholder={t("Nhập mô tả")} />
                  </Field>
                  <Field label={t("Hình ảnh")} name="imgUrl" cols={6}>
                    <ImageInput placeholder={t("Nhập link ảnh")} />
                  </Field>
                  <Field label={t("Ưu tiên")} name="priority" cols={6}>
                    <Input number placeholder={t("Nhập số ưu tiên")} />
                  </Field>
                  <Field label={t("Trạng thái")} name="active" cols={6}>
                    <Switch />
                  </Field>
                  <Form.Footer
                    className="col-span-12 pb-14 lg:pb-0"
                    cancelText=""
                    submitProps={{ disabled: !canEdit }}
                  />
                </Form>
              </>
            )}
          </div>
        )}
      </Slideout>
    </Card>
  );
}
