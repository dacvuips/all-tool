import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAddLine,
  RiArrowDownSFill,
  RiArrowRightSLine,
  RiDragMove2Line,
  RiEdit2Line,
} from "react-icons/ri";
import { Category, CategoryService } from "../../../../../lib/repo";
import { Button } from "../../../../shared/utilities/form";
import { Img, Spinner } from "../../../../shared/utilities/misc";

export interface CategoryTreeProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (category: Category | null) => void;
  onAddChild: (parent: Category | null) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function CategoryTree({
  categories,
  selectedId,
  onSelect,
  onAddChild,
  onRefresh,
  disabled,
}: CategoryTreeProps) {
  const { t } = useTranslation();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Mặc định mở full cây khi có categories
  useEffect(() => {
    if (categories.length > 0) {
      const allIds = flattenTree(categories).map((c) => c.id);
      setExpandedIds(new Set(allIds));
    }
  }, [categories]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, node: Category) => {
      if (disabled) return;
      e.dataTransfer.setData("categoryId", node.id);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(
        "application/json",
        JSON.stringify({ id: node.id, parentId: node.parentId })
      );
      setDraggedId(node.id);
    },
    [disabled]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTargetId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, target: Category) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (disabled || !draggedId || draggedId === target.id) return;
      setDropTargetId(target.id);
    },
    [disabled, draggedId]
  );

  const handleDragLeave = useCallback(() => {
    setDropTargetId(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, target: Category) => {
      e.preventDefault();
      setDropTargetId(null);
      const sourceId = e.dataTransfer.getData("categoryId");
      if (!sourceId || sourceId === target.id || disabled) return;
      // Chỉ cấm khi target nằm trong source (kéo cha vào con → tạo vòng). Cho phép kéo con lên cha (ngang hàng với nhánh anh/chị).
      if (isDescendant(categories, sourceId, target.id)) return;
      setUpdating(true);
      try {
        // Nơi thả (target) là cha mới của item đang kéo
        const newSiblings = getSiblings(categories, target.id);
        const maxPriority =
          newSiblings.length > 0 ? Math.max(...newSiblings.map((c) => c.priority ?? 0)) : -1;
        const newPriority = maxPriority + 1;

        await CategoryService.update({
          id: sourceId,
          data: {
            parentId: target.id,
            priority: newPriority,
          },
        });
        onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setUpdating(false);
        setDraggedId(null);
      }
    },
    [categories, disabled, onRefresh]
  );

  const moveOrder = useCallback(
    async (node: Category, direction: "up" | "down") => {
      if (disabled) return;
      const siblings = getSiblings(categories, node.parentId);
      const idx = siblings.findIndex((c) => c.id === node.id);
      if (idx < 0) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= siblings.length) return;
      const other = siblings[newIdx];
      setUpdating(true);
      try {
        await CategoryService.update({ id: node.id, data: { priority: other.priority } });
        await CategoryService.update({ id: other.id, data: { priority: node.priority } });
        onRefresh();
      } catch (err) {
        console.error(err);
      } finally {
        setUpdating(false);
      }
    },
    [categories, disabled, onRefresh]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-3 bg-gray-50 rounded-t-lg border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">{t("Cây danh mục")}</h3>
        <Button
          primary
          small
          icon={<RiAddLine />}
          text={t("Thêm danh mục gốc")}
          disabled={disabled}
          onClick={() => onAddChild(null)}
        />
      </div>
      {updating && (
        <div className="flex gap-2 items-center p-2 text-sm text-gray-500">
          <Spinner className="w-4 h-4" />
          {t("Đang cập nhật...")}
        </div>
      )}
      <div className="overflow-auto flex-1 py-2 v-scrollbar">
        {categories.length === 0 ? (
          <p className="p-4 text-sm text-center text-gray-500">{t("Chưa có danh mục")}</p>
        ) : (
          <CategoryTreeNodes
            nodes={categories}
            level={0}
            expandedIds={expandedIds}
            selectedId={selectedId}
            draggedId={draggedId}
            dropTargetId={dropTargetId}
            disabled={disabled}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
            onAddChild={onAddChild}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onMoveOrder={moveOrder}
          />
        )}
      </div>
    </div>
  );
}

function getSiblings(list: Category[], parentId: string | null): Category[] {
  const flat = flattenTree(list);
  return flat
    .filter((c) => (c.parentId || null) === parentId)
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
}

function flattenTree(nodes: Category[]): Category[] {
  const out: Category[] = [];
  function walk(items: Category[]) {
    items.forEach((n) => {
      out.push(n);
      if (n.children?.length) walk(n.children);
    });
  }
  walk(nodes);
  return out;
}

function isDescendant(tree: Category[], ancestorId: string, nodeId: string): boolean {
  const flat = flattenTree(tree);
  const node = flat.find((c) => c.id === nodeId);
  if (!node) return false;
  let current: Category | undefined = node;
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = flat.find((c) => c.id === current.parentId);
  }
  return false;
}

interface CategoryTreeNodesProps {
  nodes: Category[];
  level: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  draggedId: string | null;
  dropTargetId: string | null;
  disabled?: boolean;
  onToggleExpand: (id: string) => void;
  onSelect: (category: Category | null) => void;
  onAddChild: (parent: Category | null) => void;
  onDragStart: (e: React.DragEvent, node: Category) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, target: Category) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, target: Category) => void;
  onMoveOrder: (node: Category, direction: "up" | "down") => void;
}

function CategoryTreeNodes({
  nodes,
  level,
  expandedIds,
  selectedId,
  draggedId,
  dropTargetId,
  disabled,
  onToggleExpand,
  onSelect,
  onAddChild,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onMoveOrder,
}: CategoryTreeNodesProps) {
  const { t } = useTranslation();

  return (
    <>
      {nodes.map((node, index) => {
        const hasChildren = !!node.children?.length;
        const isExpanded = expandedIds.has(node.id);
        const isSelected = selectedId === node.id;
        const isDragging = draggedId === node.id;
        const isDropTarget = dropTargetId === node.id;
        const isLast = index === nodes.length - 1;

        return (
          <div key={node.id} className="relative select-none">
            {/* Tree connector lines */}
            {level > 0 && (
              <>
                <div
                  className="absolute rounded-bl border-b border-l border-gray-300"
                  style={{
                    left: 12 + (level - 1) * 20,
                    top: 0,
                    height: 20,
                    width: 20,
                  }}
                />
                {!isLast && (
                  <div
                    className="absolute border-l border-gray-300"
                    style={{
                      left: 12 + (level - 1) * 20,
                      top: 20,
                      bottom: 0,
                      width: 20,
                    }}
                  />
                )}
              </>
            )}
            <div
              draggable={!disabled}
              onDragStart={(e) => onDragStart(e, node)}
              onDragEnd={onDragEnd}
              onDragOver={(e) => onDragOver(e, node)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, node)}
              className={`group flex items-center gap-1 py-1.5 px-2 rounded-lg border transition-colors ${
                isSelected ? "bg-primary-light border-primary" : "border-transparent"
              } ${isDragging ? "opacity-50" : ""} ${
                isDropTarget ? "ring-2 ring-primary bg-primary-light" : ""
              }`}
              style={{ paddingLeft: `${12 + level * 20}px` }}
            >
              <div
                className="flex-shrink-0 text-gray-400 cursor-grab active:cursor-grabbing hover:text-gray-600"
                onMouseDown={(e) => e.stopPropagation()}
                title={t("Kéo để di chuyển")}
              >
                <RiDragMove2Line className="w-5 h-5" />
              </div>
              {hasChildren ? (
                <button
                  type="button"
                  className="flex-shrink-0 p-0.5 rounded hover:bg-gray-200 text-gray-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(node.id);
                  }}
                >
                  {isExpanded ? (
                    <RiArrowDownSFill className="w-5 h-5" />
                  ) : (
                    <RiArrowRightSLine className="w-5 h-5" />
                  )}
                </button>
              ) : null}
              {node.imgUrl ? (
                <Img src={node.imgUrl} className="object-contain flex-shrink-0 w-6 h-6 rounded" />
              ) : null}
              <div className="flex flex-1 justify-start min-w-0">
                <div className="flex items-center gap-0.5 min-w-0">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-sm font-semibold text-left text-gray-800 truncate hover:text-primary"
                    onClick={() => onSelect(node)}
                  >
                    {node.name || t("(Chưa đặt tên)")}
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 flex-shrink-0 px-2 h-8 bg-gray-100 ml-2  rounded-full">
                    <Button
                      className="p-1 min-w-0 h-8"
                      icon={<RiAddLine className="w-4 h-4" />}
                      tooltip={t("Thêm con")}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddChild(node);
                      }}
                    />
                    <Button
                      className="p-1 min-w-0 h-8"
                      icon={<RiEdit2Line className="w-4 h-4" />}
                      tooltip={t("Sửa")}
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(node);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
            {hasChildren && isExpanded && (
              <div className="relative" style={{ marginLeft: 12 + level * 20 }}>
                <CategoryTreeNodes
                  nodes={node.children}
                  level={level + 1}
                  expandedIds={expandedIds}
                  selectedId={selectedId}
                  draggedId={draggedId}
                  dropTargetId={dropTargetId}
                  disabled={disabled}
                  onToggleExpand={onToggleExpand}
                  onSelect={onSelect}
                  onAddChild={onAddChild}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  onMoveOrder={onMoveOrder}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
