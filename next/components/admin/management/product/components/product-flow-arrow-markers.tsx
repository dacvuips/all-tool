/**
 * SVG marker definitions for product flow edges.
 * Referenced by product-edge.tsx via id: product-flow-arrow, product-flow-arrow-selected.
 */
export function ProductFlowArrowMarkers() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden>
      <defs>
        <marker
          id="product-flow-arrow"
          markerWidth={6}
          markerHeight={6}
          refX={5}
          refY={3}
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 L2 3 Z" fill="#F2890D" />
        </marker>
        <marker
          id="product-flow-arrow-selected"
          markerWidth={6}
          markerHeight={6}
          refX={5}
          refY={3}
          orient="auto"
        >
          <path d="M0 0 L6 3 L0 6 L2 3 Z" fill="#ef4444" />
        </marker>
      </defs>
    </svg>
  );
}
