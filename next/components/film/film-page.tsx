import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus } from "react-icons/hi";
import { useAuth } from "../../lib/providers/auth-provider";
import { useSettingPublic } from "../../lib/hooks/useSettingPublic";
import { useAlert } from "../../lib/providers/alert-provider";
import { useToast } from "../../lib/providers/toast-provider";
import { useGlobalContext } from "../../lib/providers/global-provider";
import { customerIdOf } from "../app/voice/voice-access";
import { Button } from "../shared/utilities/form";
import { filmFeatureBlockReason } from "./film-access";
import FilmCreateDialog from "./film-create-dialog";
import {
  createFilmProject,
  deleteFilmProject,
  initFilmDB,
  listFilmProjects,
  updateFilmProject,
} from "./film-idb";
import FilmProjectCard from "./film-project-card";
import { FilmProjectCreateInput, FilmProjectRecord } from "./film-types";

const FilmPage = ({ hideHeader = false }: { hideHeader?: boolean }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const alert = useAlert();
  const toast = useToast();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const blockSetting = useSettingPublic("pa-b-page");
  const marketplaceStopped = Boolean(blockSetting?.key);
  const [projects, setProjects] = useState<FilmProjectRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<FilmProjectRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const openProject = (project: FilmProjectRecord) => {
    router.push(`/film/${project.id}`);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await initFilmDB();
        const rows = await listFilmProjects();
        if (!cancelled) setProjects(rows);
      } catch (err) {
        console.error("[FilmPage] init IndexedDB failed:", err);
        if (!cancelled) setProjects([]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const guardFilmFeature = (): boolean => {
    const reason = filmFeatureBlockReason(customer, marketplaceStopped);
    if (!reason) return true;
    toast.warn(t(reason));
    if (!customerIdOf(customer)) {
      setOpenCustomerLoginDialog(true);
    }
    return false;
  };

  const openCreate = () => {
    if (!guardFilmFeature()) return;
    setEditingProject(null);
    setDialogOpen(true);
  };

  const openEdit = (project: FilmProjectRecord) => {
    setEditingProject(project);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProject(null);
  };

  const handleDelete = async (project: FilmProjectRecord) => {
    const ok = alert?.danger
      ? await alert.danger(
          t("Xóa dự án"),
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ tập, phân cảnh, nhân vật, vật phẩm và bối cảnh. Thao tác không hoàn tác. Tiếp tục?",
            { name: project.name }
          ),
          t("Xóa")
        )
      : window.confirm(
          t(
            "Xóa “{{name}}” sẽ xóa toàn bộ dữ liệu dự án. Tiếp tục?",
            { name: project.name }
          )
        );
    if (!ok) return;
    try {
      await deleteFilmProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      toast.success(t("Đã xóa dự án “{{name}}”", { name: project.name }));
    } catch (err) {
      console.error("[FilmPage] delete project failed:", err);
      toast.error(t("Không thể xóa dự án"));
    }
  };

  const handleSubmit = async (data: FilmProjectCreateInput) => {
    if (saving) return;
    if (!editingProject && !guardFilmFeature()) return;
    setSaving(true);
    try {
      if (editingProject) {
        const updated = await updateFilmProject(editingProject.id, data);
        setProjects((prev) => {
          const next = prev.map((p) => (p.id === updated.id ? updated : p));
          return next.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
      } else {
        const project = await createFilmProject(data);
        setProjects((prev) => [project, ...prev]);
      }
      closeDialog();
    } catch (err) {
      console.error("[FilmPage] save project failed:", err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const countLabel =
    projects.length === 1 ? `1 ${t("Dự án")}` : `${projects.length} ${t("Dự án")}`;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {!hideHeader && (
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">{t("Film")}</h1>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-5 sm:mb-6">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 m-0 tracking-tight">
            {t("Dự án Phim ngắn")}
          </h2>
          <p className="text-sm text-gray-500 mt-1 sm:mt-1.5 m-0">{countLabel}</p>
        </div>
        <Button
          primary
          text={t("Tạo Dự án")}
          icon={<HiPlus />}
          className="!rounded-xl !px-4 !py-2.5 !bg-blue-600 hover:!bg-blue-700 shadow-sm !w-full sm:!w-auto justify-center flex-shrink-0"
          onClick={openCreate}
        />
      </div>

      {!ready ? (
        <div className="text-sm text-gray-400 py-12 text-center">{t("Đang tải...")}</div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 px-6 py-16 text-center">
          <p className="text-gray-500 m-0 mb-4">
            {t("Chưa có dự án nào. Hãy tạo dự án phim ngắn đầu tiên của bạn.")}
          </p>
          <Button
            primary
            text={t("Tạo Dự án")}
            icon={<HiPlus />}
            className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
            onClick={openCreate}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {projects.map((project) => (
            <FilmProjectCard
              key={project.id}
              project={project}
              onEdit={openEdit}
              onDelete={handleDelete}
              onClick={() => openProject(project)}
            />
          ))}
        </div>
      )}

      <FilmCreateDialog
        isOpen={dialogOpen}
        project={editingProject}
        onClose={closeDialog}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default FilmPage;
