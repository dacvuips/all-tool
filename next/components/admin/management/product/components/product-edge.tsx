import { useTranslation } from "react-i18next";
import { HiOutlineTrash } from "react-icons/hi";
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getBezierPath } from "reactflow";
import { Button } from "../../../../shared/utilities/form/button";

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
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const strokeColor = selected ? "#F2890D" : "#C26E0B";
  const markerId = selected ? "product-flow-arrow-selected" : "product-flow-arrow";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          stroke: strokeColor,
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
            <Button
              icon={<HiOutlineTrash />}
              onClick={() => onDelete(id)}
              tooltip={t("Xóa liên kết")}
              hoverDanger
              className="w-7 h-7 text-white rounded-full bg-danger"
            />
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
