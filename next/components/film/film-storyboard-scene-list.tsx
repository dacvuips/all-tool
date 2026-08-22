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
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiTrash } from "react-icons/hi";
import { MdOutlineDragIndicator } from "react-icons/md";
import { FilmSceneRecord } from "./film-types";

type Props = {
  scenes: FilmSceneRecord[];
  selectedId: string | null;
  totalDurationSec: number;
  onSelect: (id: string) => void;
  onDelete?: (scene: FilmSceneRecord) => void;
  onReorder?: (scenes: FilmSceneRecord[]) => void | Promise<void>;
  deletingId?: string | null;
  reorderDisabled?: boolean;
};

type SceneCardProps = {
  scene: FilmSceneRecord;
  selected: boolean;
  deleting: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement> & {
    ref?: (node: HTMLButtonElement | null) => void;
  };
  isDragging?: boolean;
};

function SceneCard({
  scene,
  selected,
  deleting,
  onSelect,
  onDelete,
  dragHandleProps,
  isDragging,
}: SceneCardProps) {
  const { t } = useTranslation();
  const sceneTitle =
    scene.title?.trim() || scene.summary?.trim() || `${t("Cảnh quay")} #${scene.index}`;
  const snippet = scene.summary || scene.action || scene.dialogue || scene.atmosphere || "";
  const short = snippet.length > 72 ? `${snippet.slice(0, 72)}…` : snippet || t("Chưa có mô tả");
  const charCount = scene.characterNames?.length || 0;
  const statusDot =
    scene.mediaStatus === "ready"
      ? "bg-success"
      : scene.mediaStatus === "error"
      ? "bg-danger"
      : "bg-warning";

  const metaParts = [
    scene.shotSize,
    `${scene.durationSec || 0}s`,
    charCount > 0 ? `${charCount} ${t("NV")}` : null,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group/scene relative w-full text-left rounded-lg border px-1.5 pt-3 pb-1.5 transition-colors cursor-pointer ${
        isDragging ? "opacity-40" : ""
      } ${
        selected
          ? "border-primary/40 bg-primary-light ring-1 ring-primary/20"
          : "border-gray-200 bg-white hover:border-primary/25 hover:bg-gray-50"
      }`}
    >
      <span
        className={`absolute -top-2.5 -left-1 z-10 inline-flex items-center p-1 h-6 w-6 text-10 font-bold tabular-nums rounded-full border shadow-sm ${
          selected
            ? "text-white bg-primary border-primary-dark"
            : "text-primary-dark bg-white border-primary/30"
        }`}
      >
        #{scene.index}
      </span>

      <div className="flex items-center gap-0.5 min-w-0">
        {dragHandleProps ? (
          <button
            type="button"
            title={t("Kéo để đổi thứ tự")}
            aria-label={t("Kéo để đổi thứ tự")}
            className="flex flex-shrink-0 justify-center items-center w-4 py-0.5 text-gray-400 cursor-grab touch-none active:cursor-grabbing hover:text-primary group-hover/scene:text-gray-500"
            onClick={(e) => e.stopPropagation()}
            {...dragHandleProps}
          >
            <MdOutlineDragIndicator className="text-sm" />
          </button>
        ) : (
          <span className="flex-shrink-0 w-4" aria-hidden />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1 min-w-0">
            <div className="min-w-0 flex-1">
              <span
                className={`block text-xs font-semibold break-words leading-snug ${
                  selected ? "text-accent" : "text-gray-800"
                }`}
              >
                {sceneTitle}
              </span>
              <p
                className="text-10 text-gray-600 m-0 mt-0.5 leading-snug line-clamp-2"
                title={[metaParts.join(" · "), short, scene.location].filter(Boolean).join(" · ")}
              >
                {metaParts.length > 0 ? (
                  <span className="font-medium text-primary-dark">{metaParts.join(" · ")} · </span>
                ) : null}
                {short}
                {scene.location ? (
                  <span className="text-gray-400">
                    {" · "}
                    {scene.location}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 pt-px">
              <span
                className={`w-1.5 h-1.5 rounded-full ${statusDot}`}
                title={
                  scene.mediaStatus === "ready"
                    ? t("Sẵn sàng")
                    : scene.mediaStatus === "error"
                    ? t("Lỗi")
                    : t("Đang chờ")
                }
              />
              {onDelete ? (
                <button
                  type="button"
                  title={t("Xóa phân cảnh")}
                  aria-label={t("Xóa phân cảnh")}
                  disabled={deleting}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className={`flex justify-center items-center w-5 h-5 text-gray-400 rounded transition-opacity cursor-pointer hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected
                      ? "opacity-100"
                      : "opacity-0 group-hover/scene:opacity-100 hover:!opacity-100"
                  }`}
                >
                  <HiTrash className="text-xs" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableSceneItem({
  scene,
  selected,
  deleting,
  disabled,
  onSelect,
  onDelete,
}: {
  scene: FilmSceneRecord;
  selected: boolean;
  deleting: boolean;
  disabled: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative pt-2">
      {isDragging && (
        <div
          className="absolute inset-0 z-0 rounded-lg border-2 border-dashed pointer-events-none border-primary/35 bg-primary-light/60"
          aria-hidden
        />
      )}
      <SceneCard
        scene={scene}
        selected={selected}
        deleting={deleting}
        onSelect={onSelect}
        onDelete={onDelete}
        isDragging={isDragging}
        dragHandleProps={
          disabled
            ? undefined
            : {
                ref: setActivatorNodeRef,
                ...attributes,
                ...listeners,
              }
        }
      />
    </div>
  );
}

export default function FilmStoryboardSceneList({
  scenes,
  selectedId,
  totalDurationSec,
  onSelect,
  onDelete,
  onReorder,
  deletingId = null,
  reorderDisabled = false,
}: Props) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const canReorder = !!onReorder && !reorderDisabled && scenes.length > 1;

  const sceneIds = useMemo(() => scenes.map((s) => s.id), [scenes]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over || active.id === over.id || !onReorder) return;

      const oldIndex = sceneIds.indexOf(String(active.id));
      const newIndex = sceneIds.indexOf(String(over.id));
      if (oldIndex === -1 || newIndex === -1) return;

      onReorder(arrayMove(scenes, oldIndex, newIndex));
    },
    [onReorder, sceneIds, scenes]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeScene = activeId ? scenes.find((s) => s.id === activeId) : null;

  const listContent =
    scenes.length === 0 ? (
      <div className="text-center text-sm text-gray-400 py-10 px-4">
        {t("Chưa có cảnh quay. Bấm Trích xuất ở Nội dung gốc hoặc Thêm cảnh.")}
      </div>
    ) : canReorder ? (
      <SortableContext items={sceneIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 pt-1">
          {scenes.map((scene) => (
            <SortableSceneItem
              key={scene.id}
              scene={scene}
              selected={scene.id === selectedId}
              deleting={deletingId === scene.id}
              disabled={reorderDisabled}
              onSelect={() => onSelect(scene.id)}
              onDelete={onDelete ? () => onDelete(scene) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    ) : (
      <div className="space-y-2 pt-1">
        {scenes.map((scene) => (
          <div key={scene.id} className="pt-2">
            <SceneCard
              scene={scene}
              selected={scene.id === selectedId}
              deleting={deletingId === scene.id}
              onSelect={() => onSelect(scene.id)}
              onDelete={onDelete ? () => onDelete(scene) : undefined}
            />
          </div>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/80">
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-accent m-0 leading-tight">
            {t("Chuỗi phân cảnh")}
          </h3>
          <p className="text-10 text-gray-500 m-0 mt-0.5 truncate">
            {canReorder ? t("Kéo ⋮⋮ để đổi thứ tự") : t("Theo thứ tự cảnh quay")}
          </p>
        </div>
        <span className="text-10 font-semibold text-primary-dark flex-shrink-0 tabular-nums px-1.5 py-0.5 rounded-md bg-primary-light">
          {scenes.length} {t("cảnh")} · {totalDurationSec}s
        </span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-1.5 pt-2 bg-gray-50/50">
        {canReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {listContent}
            <DragOverlay dropAnimation={{ duration: 140, easing: "ease-out" }}>
              {activeScene ? (
                <div className="rounded-lg shadow-lg ring-2 ring-primary/30 bg-white cursor-grabbing">
                  <SceneCard
                    scene={activeScene}
                    selected={activeScene.id === selectedId}
                    deleting={false}
                    onSelect={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          listContent
        )}
      </div>
    </div>
  );
}
