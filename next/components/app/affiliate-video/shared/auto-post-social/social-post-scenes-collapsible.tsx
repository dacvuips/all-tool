import type { ReactNode } from "react";
import {
  useSocialPostGroupScenesExpanded,
  useSocialPostScenesCollapseState,
} from "./social-post-scenes-collapse-store";

function CollapsiblePanel({
  expanded,
  children,
}: {
  expanded: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-in-out"
      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
    >
      <div className="overflow-hidden min-h-0">
        <div
          className={`transition-opacity duration-300 ease-in-out ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Trượt mềm khi ẩn/hiện danh sách phân cảnh của một bài đăng */
export function SocialPostScenesCollapsible({
  groupId,
  children,
}: {
  groupId: string;
  children: ReactNode;
}) {
  useSocialPostScenesCollapseState();
  const expanded = useSocialPostGroupScenesExpanded(groupId);
  return <CollapsiblePanel expanded={expanded}>{children}</CollapsiblePanel>;
}

export { CollapsiblePanel as SocialPostScenesCollapsiblePanel };
