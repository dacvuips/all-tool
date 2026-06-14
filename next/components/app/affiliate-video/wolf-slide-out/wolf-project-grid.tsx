import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from "react-icons/ri";

import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form/button";
import { Input } from "../../../shared/utilities/form/input";
import { DB_NAME, STORE_NAME, uid } from "../constants";
import { useIndexedDB } from "../hook/useIndexedDB";

export type WolfProject = {
  id: string;
  name: string;
  createdAt: number;
};

function formatProjectName(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.getMonth() + 1;
  return `${hours}:${minutes} ${day} thg ${month}`;
}

type WolfProjectGridProps = {
  onNewProject?: (projectId: string) => void;
  onOpenProject?: (projectId: string) => void;
};

export function WolfProjectGrid({ onNewProject, onOpenProject }: WolfProjectGridProps) {
  const { t } = useTranslation();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [projects, setProjects] = useState<WolfProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [renameTarget, setRenameTarget] = useState<WolfProject | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isSavingRename, setIsSavingRename] = useState(false);

  const projectDB = useIndexedDB<WolfProject>(STORE_NAME.wolf, DB_NAME.wolf);

  const loadProjects = useCallback(async () => {
    const records = await projectDB.getAll();
    records.sort((a, b) => b.createdAt - a.createdAt);
    setProjects(records);
  }, [projectDB]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const records = await projectDB.getAll();
        if (!cancelled) {
          records.sort((a, b) => b.createdAt - a.createdAt);
          setProjects(records);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectDB]);

  const handleNewProject = async () => {
    const now = new Date();
    const project: WolfProject = {
      id: uid(),
      name: formatProjectName(now),
      createdAt: now.getTime(),
    };

    await projectDB.set(project.id, project);
    await loadProjects();
    onNewProject?.(project.id);
  };

  const handleOpenRename = (project: WolfProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameTarget(project);
    setRenameValue(project.name);
  };

  const handleCloseRename = () => {
    if (isSavingRename) return;
    setRenameTarget(null);
    setRenameValue("");
  };

  const handleSaveRename = async () => {
    if (!renameTarget) return;

    const trimmed = renameValue.trim();
    if (!trimmed) return;

    setIsSavingRename(true);
    try {
      const updated: WolfProject = { ...renameTarget, name: trimmed };
      await projectDB.set(renameTarget.id, updated);
      await loadProjects();
      setRenameTarget(null);
      setRenameValue("");
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("Bạn có chắc muốn xoá dự án này?"))) return;

    await projectDB.remove(projectId);
    await loadProjects();
  };

  return (
    <div className="flex relative flex-col h-full bg-white">
      <div className="overflow-auto flex-1 p-4 v-scrollbar">
        {isLoading ? (
          <div className="flex justify-center items-center h-32 text-sm text-slate-400">
            {t("Đang tải...")}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex justify-center items-center h-32 text-sm text-slate-400">
            {t("Chưa có dự án nào")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenProject?.(project.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenProject?.(project.id);
                  }
                }}
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="flex overflow-hidden flex-col text-left bg-white rounded-2xl border shadow-sm transition-all cursor-pointer group border-slate-200 hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <div className="w-full aspect-video bg-slate-100" />
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="text-sm truncate text-slate-500">{project.name}</span>
                  {hoveredId === project.id && (
                    <div className="flex gap-1 items-center shrink-0">
                      <button
                        type="button"
                        title={t("Sửa tên")}
                        onClick={(e) => handleOpenRename(project, e)}
                        className="p-1 rounded-md transition-colors text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                      >
                        <RiPencilLine className="text-base" />
                      </button>
                      <button
                        type="button"
                        title={t("Xoá dự án")}
                        onClick={(e) => handleDeleteProject(project.id, e)}
                        className="p-1 rounded-md transition-colors text-slate-500 hover:bg-red-50 hover:text-red-500"
                      >
                        <RiDeleteBinLine className="text-base" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex absolute inset-x-0 bottom-6 justify-center pointer-events-none">
        <button
          type="button"
          onClick={handleNewProject}
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-blue-500 bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700"
        >
          <RiAddLine className="text-lg" />
          {t("Dự án mới")}
        </button>
      </div>

      <Dialog
        isOpen={!!renameTarget}
        onClose={handleCloseRename}
        title={t("Sửa tên dự án")}
        width={420}
      >
        <Dialog.Body>
          <Input
            autoFocus
            value={renameValue}
            onChange={(val) => setRenameValue(val)}
            placeholder={t("Nhập tên dự án")}
          />{" "}
          <div className="flex gap-2 justify-end py-2">
            <Button text={t("Huỷ")} onClick={handleCloseRename} disabled={isSavingRename} />
            <Button
              primary
              text={t("Lưu")}
              onClick={() => void handleSaveRename()}
              isLoading={isSavingRename}
              disabled={!renameValue.trim() || isSavingRename}
            />
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
