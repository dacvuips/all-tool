import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Category, CategoryService } from "../../../../../lib/repo";
import { Slideout, SlideoutProps } from "../../../../shared/utilities/dialog/slideout";
import { Spinner } from "../../../../shared/utilities/misc";
import { CategoryOverviewTab } from "./category-overview";
import { CategoryTree } from "./category-tree";

interface Props extends SlideoutProps {
  id: string;
  onSubmit: () => any;
}

export function CategorySlideout({ id, ...props }: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { userPermission } = useAuth();
  const [category, setCategory] = useState<Category | null>(null);
  const [tree, setTree] = useState<Category[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    if (id !== null) {
      if (id) {
        CategoryService.getOne({ id }).then((res) => {
          setCategory(res);
          setSelectedId(res?.id ?? null);
        });
      } else {
        setCategory({ parentId: undefined });
        setSelectedId(null);
      }
    } else {
      setCategory(null);
      setSelectedId(null);
    }
  }, [id]);

  const onClose = () => router.replace({ pathname: location.pathname, query: {} });

  const handleSelect = useCallback((item: Category | null) => {
    if (!item) {
      setCategory(null);
      setSelectedId(null);
      return;
    }
    setSelectedId(item.id);
    CategoryService.getOne({ id: item.id }).then((res) => setCategory(res));
  }, []);

  const handleAddChild = useCallback(
    (parent: Category | null) => {
      const parentId = parent?.id ?? undefined;
      setCategory({ parentId });
      setSelectedId(null);
    },
    []
  );

  const handleSubmit = useCallback(() => {
    onClose();
    props.onSubmit();
  }, [onClose, props.onSubmit]);

  const showForm = category !== null;
  const canEdit = userPermission("EDIT_CATEGORY");

  return (
    <Slideout width="92vw" maxWidth="1600px" isOpen={id !== null} onClose={onClose}>
      {id === null ? null : (
        <div className="flex h-full" style={{ minHeight: "calc(100vh - 64px)" }}>
          {/* Cây danh mục bên trái */}
          <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
            {loadingTree ? (
              <div className="flex items-center justify-center flex-1">
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

          {/* Form chi tiết bên phải */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
            {!showForm ? (
              <div className="flex flex-col items-center justify-center flex-1 p-8 text-gray-500">
                <p className="text-base">{t("Chọn một danh mục bên trái để sửa hoặc thêm mới")}</p>
              </div>
            ) : (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {category?.id ? t("Chỉnh sửa danh mục") : t("Thêm danh mục")}
                  </h2>
                </div>
                <div className="flex-1 overflow-auto p-6 v-scrollbar">
                  <CategoryOverviewTab
                    category={category}
                    loadAll={handleSubmit}
                    loadTree={loadTree}
                    parentOptions={tree}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Slideout>
  );
}
