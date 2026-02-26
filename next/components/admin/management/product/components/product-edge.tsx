import { useTranslation } from "react-i18next";
import { HiOutlineTrash } from "react-icons/hi";
import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getSmoothStepPath,
} from "reactflow";

interface ProductEdgeProps extends EdgeProps {
  onDelete?: (edgeId: string) => void;
}

export function ProductEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  onDelete: onDeleteProp,
}: ProductEdgeProps) {
  const { t } = useTranslation();
  const onDelete = onDeleteProp ?? (data?.onDelete as ((edgeId: string) => void) | undefined);
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#818cf8" : "#4f46e5",
          strokeWidth: selected ? 3 : 2,
        }}
      />
      {selected && onDelete && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
          >
            <button
              type="button"
              onClick={() => onDelete(id)}
              title={t("Xóa liên kết")}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                border: "none",
                background: "rgba(239,68,68,0.9)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "12px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <HiOutlineTrash />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
