import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowLeftLine } from "react-icons/ri";

import { DB_NAME, STORE_NAME } from "../constants";
import { useIndexedDB } from "../hook/useIndexedDB";
import { WolfPixelFlower } from "./wolf-pixel-flower";
import { WolfProject } from "./wolf-project-grid";
import { WolfWorkspaceComposer } from "./wolf-workspace-composer";

type WolfWorkspaceProps = {
  projectId?: string | null;
  onBack: () => void;
};

export function WolfWorkspace({ projectId, onBack }: WolfWorkspaceProps) {
  const { t } = useTranslation();
  const [projectName, setProjectName] = useState<string>("");
  const projectDB = useIndexedDB<WolfProject>(STORE_NAME.wolf, DB_NAME.wolf);

  useEffect(() => {
    if (!projectId) {
      setProjectName("");
      return;
    }

    let cancelled = false;
    void projectDB.get(projectId).then((project) => {
      if (!cancelled) setProjectName(project?.name ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [projectDB, projectId]);

  return (
    <div className="relative flex h-full flex-col bg-white">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-800"
      >
        <RiArrowLeftLine />
        {t("Dự án")}
      </button>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-44 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
          <WolfPixelFlower className="h-9 w-9 text-slate-700" />
        </div>
        <p className="max-w-xs text-sm leading-relaxed text-slate-500">
          {t("Bắt đầu tạo hoặc thả nội dung nghe nhìn")}
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0">
        <WolfWorkspaceComposer projectId={projectId} projectName={projectName} />
      </div>
    </div>
  );
}
