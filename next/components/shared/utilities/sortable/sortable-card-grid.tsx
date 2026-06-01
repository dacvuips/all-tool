/**
 * sortable-card-grid.tsx
 * Lưới thẻ kéo-thả – tối ưu: overlay nhẹ, tay cầm kéo, persist không chặn UI
 */
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React, { memo, useCallback, useMemo, useState } from "react";
import { MdOutlineDragIndicator } from "react-icons/md";

/** Kéo từ tay cầm – không delay; giữ cả thẻ – delay ngắn */
const CARD_HOLD_MS = 120;

export interface SortableCardGridProps<T> {
  items: T[];
  getItemId: (item: T) => string;
  onReorder: (reorderedItems: T[]) => void;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Preview nhẹ khi kéo – tránh mount lại SceneRow nặng */
  renderDragOverlay?: (item: T, index: number) => React.ReactNode;
  gridClassName?: string;
  itemClassName?: string;
  disabled?: boolean;
  keyPrefix?: string;
  /** true (mặc định): kéo bằng nút ⋮⋮ – phản hồi nhanh, không đụng scroll */
  useDragHandle?: boolean;
}

interface SortableCardItemProps {
  id: string;
  disabled?: boolean;
  useDragHandle: boolean;
  itemClassName?: string;
  children: React.ReactNode;
}

const SortableCardItem = memo(function SortableCardItem({
  id,
  disabled,
  useDragHandle,
  itemClassName,
  children,
}: SortableCardItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 1 : undefined,
    willChange: transform ? "transform" : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={`relative ${itemClassName ?? ""}`}>
      {isDragging && (
        <div
          className="absolute inset-0 z-0 rounded-xl border-2 border-dashed pointer-events-none border-primary/40 bg-primary/10"
          aria-hidden
        />
      )}

      {useDragHandle && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="flex absolute -top-3 left-1/2 z-30 justify-center items-center w-7 h-7 text-gray-400 bg-white rounded-lg border border-gray-200 shadow-sm opacity-70 transition-opacity -translate-x-1/2 bg-white/90 cursor-grab touch-none sm:opacity-0 sm:group-hover:opacity-100 hover:text-primary hover:border-primary/40 active:cursor-grabbing"
          aria-label="Kéo để đổi thứ tự"
          style={{
            transform: "rotate(90deg)",
          }}
          {...attributes}
          {...listeners}
        >
          <MdOutlineDragIndicator className="block text-lg" />
        </button>
      )}

      <div
        className={`relative z-10 h-full ${isDragging ? "opacity-0" : ""}`}
        {...(!useDragHandle ? { ...attributes, ...listeners } : {})}
      >
        {children}
      </div>
    </div>
  );
});

export function SortableCardGrid<T>({
  items,
  getItemId,
  onReorder,
  renderItem,
  renderDragOverlay,
  gridClassName = "grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6",
  itemClassName,
  disabled = false,
  keyPrefix = "sortable",
  useDragHandle = true,
}: SortableCardGridProps<T>) {
  const itemIds = useMemo(() => items.map(getItemId), [items, getItemId]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: useDragHandle ? { distance: 4 } : { delay: CARD_HOLD_MS, tolerance: 5 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    const rect = event.active.rect.current.initial;
    if (rect) {
      setOverlaySize({ width: rect.width, height: rect.height });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverlaySize(null);

      if (!over || active.id === over.id) return;

      const oldIndex = itemIds.indexOf(String(active.id));
      const newIndex = itemIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      onReorder(arrayMove(items, oldIndex, newIndex));
    },
    [itemIds, items, onReorder]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverlaySize(null);
  }, []);

  const activeIndex = activeId ? itemIds.indexOf(activeId) : -1;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;

  if (items.length === 0) return null;

  const overlayContent =
    activeItem &&
    (renderDragOverlay?.(activeItem, activeIndex) ?? (
      <DefaultDragGhost sceneNumber={(activeItem as { sceneNumber?: number }).sceneNumber} />
    ));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy} disabled={disabled}>
        <div className={`${gridClassName} [&>*]:overflow-visible`}>
          {items.map((item, index) => {
            const id = getItemId(item);
            return (
              <SortableCardItem
                key={`${keyPrefix}-${id}`}
                id={id}
                disabled={disabled}
                useDragHandle={useDragHandle}
                itemClassName={`group ${itemClassName ?? ""}`}
              >
                {renderItem(item, index)}
              </SortableCardItem>
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay adjustScale={false} dropAnimation={{ duration: 140, easing: "ease-out" }}>
        {activeItem ? (
          <div
            className="rounded-xl ring-2 shadow-2xl cursor-grabbing ring-primary/50 animate-wiggle"
            style={
              overlaySize ? { width: overlaySize.width, minHeight: overlaySize.height } : undefined
            }
          >
            {overlayContent}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DefaultDragGhost({ sceneNumber }: { sceneNumber?: number }) {
  return (
    <div className="flex justify-center items-center w-full h-full min-h-[100px] rounded-xl border border-gray-200 bg-white/95 backdrop-blur-[2px]">
      <span className="text-sm font-bold text-gray-600">
        {sceneNumber != null ? `Cảnh #${sceneNumber}` : "…"}
      </span>
    </div>
  );
}

export function reorderScenesWithNumbers<T extends { sceneNumber?: number }>(scenes: T[]): T[] {
  return scenes.map((scene, index) => ({ ...scene, sceneNumber: index + 1 }));
}
