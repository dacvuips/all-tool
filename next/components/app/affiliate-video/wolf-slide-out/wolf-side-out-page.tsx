import { useState } from "react";

import { WolfProjectGrid } from "./wolf-project-grid";
import { WolfWorkspace } from "./wolf-workspace";

type View = "projects" | "workspace";

export function WolfSlideOutPage() {
  const [view, setView] = useState<View>("projects");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [gridRefreshKey, setGridRefreshKey] = useState(0);

  const openWorkspace = (projectId: string) => {
    setActiveProjectId(projectId);
    setView("workspace");
  };

  if (view === "workspace") {
    return (
      <WolfWorkspace
        projectId={activeProjectId}
        onBack={() => {
          setView("projects");
          setActiveProjectId(null);
          setGridRefreshKey((key) => key + 1);
        }}
      />
    );
  }

  return (
    <WolfProjectGrid
      key={gridRefreshKey}
      onNewProject={openWorkspace}
      onOpenProject={openWorkspace}
    />
  );
}
