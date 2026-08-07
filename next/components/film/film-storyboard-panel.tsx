import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPlus, HiRefresh } from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import {
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmSceneRecord,
  buildStoryboardScenesFromContent,
  createFilmId,
  filmScenesTotalDuration,
} from "./film-types";
import FilmStoryboardSceneDetail from "./film-storyboard-scene-detail";
import FilmStoryboardSceneList from "./film-storyboard-scene-list";

export type FilmStoryboardTab = "storyboard" | "voice" | "shot_images" | "create_video";

type Props = {
  projectId: string;
  episode: FilmEpisodeRecord | null;
  scenes: FilmSceneRecord[];
  characters?: FilmCharacterRecord[];
  onScenesChange: (scenes: FilmSceneRecord[]) => void;
  onSaveScene: (scene: FilmSceneRecord) => Promise<void>;
  onReplaceScenes: (scenes: FilmSceneRecord[]) => Promise<void>;
  onAddScene: () => Promise<void>;
  onTabNavigate?: (tab: FilmStoryboardTab) => void;
};

const TABS: { id: FilmStoryboardTab; label: string }[] = [
  { id: "storyboard", label: "Tạo Storyboard" },
  { id: "voice", label: "Tạo Giọng" },
  { id: "shot_images", label: "Ảnh Cảnh quay" },
  { id: "create_video", label: "Tạo video" },
];

export default function FilmStoryboardPanel({
  projectId,
  episode,
  scenes,
  characters = [],
  onScenesChange,
  onSaveScene,
  onReplaceScenes,
  onAddScene,
  onTabNavigate,
}: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<FilmStoryboardTab>("storyboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!scenes.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !scenes.find((s) => s.id === selectedId)) {
      setSelectedId(scenes[0].id);
    }
  }, [scenes, selectedId]);

  const selected = useMemo(
    () => scenes.find((s) => s.id === selectedId) || null,
    [scenes, selectedId]
  );

  const totalDuration = useMemo(() => filmScenesTotalDuration(scenes), [scenes]);
  const allCharacterNames = useMemo(
    () => Array.from(new Set(characters.map((c) => c.name).filter(Boolean))),
    [characters]
  );
  const allPropNames = useMemo(() => {
    const set = new Set<string>();
    for (const s of scenes) {
      for (const p of s.propNames || []) set.add(p);
    }
    return Array.from(set);
  }, [scenes]);

  const handleTab = (id: FilmStoryboardTab) => {
    setTab(id);
    if (id !== "storyboard" && onTabNavigate) onTabNavigate(id);
  };

  const handlePatch = async (patch: Partial<FilmSceneRecord>) => {
    if (!selected) return;
    const next: FilmSceneRecord = {
      ...selected,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    onScenesChange(scenes.map((s) => (s.id === next.id ? next : s)));
    await onSaveScene(next);
  };

  const handleRecreate = async () => {
    if (!episode || busy) return;
    setBusy(true);
    try {
      const content = episode.originalContent || "";
      const generated = buildStoryboardScenesFromContent(
        projectId,
        episode,
        content,
        episode.sceneCount || undefined
      );
      await onReplaceScenes(generated);
      if (generated[0]) setSelectedId(generated[0].id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border-0 cursor-pointer transition-colors ${
                  active
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {active && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                {t(item.label)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {scenes.length} {t("Cảnh quay")} - {totalDuration}s
          </span>
          <Button
            outline
            small
            text={t("Thêm")}
            icon={<HiPlus />}
            className="!rounded-lg"
            onClick={() => onAddScene()}
            disabled={!episode || busy}
          />
          <Button
            outline
            small
            text={t("Tạo lại")}
            icon={<HiRefresh />}
            className="!rounded-lg"
            onClick={handleRecreate}
            isLoading={busy}
            disabled={!episode}
          />
        </div>
      </div>

      {tab !== "storyboard" ? (
        <div className="flex-1 min-h-sm bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center px-6">
          <p className="text-base font-semibold text-gray-700 m-0">
            {t("Tính năng đang phát triển")}
          </p>
          <p className="text-sm text-gray-400 mt-2 m-0">
            {t("Tab này sẽ sớm được hỗ trợ trong quy trình sản xuất.")}
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3">
          <div className="w-full lg:w-80 flex-shrink-0 min-h-sm lg:min-h-0 lg:max-h-screen">
            <FilmStoryboardSceneList
              scenes={scenes}
              selectedId={selectedId}
              totalDurationSec={totalDuration}
              onSelect={setSelectedId}
            />
          </div>
          <div className="flex-1 min-w-0 min-h-md lg:min-h-0 lg:max-h-screen">
            <FilmStoryboardSceneDetail
              scene={selected}
              allCharacterNames={allCharacterNames}
              allPropNames={allPropNames}
              onChange={handlePatch}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function createEmptyFilmScene(
  projectId: string,
  episodeId: string,
  index: number
): FilmSceneRecord {
  const now = new Date().toISOString();
  return {
    id: createFilmId("sc"),
    projectId,
    episodeId,
    index,
    title: `Cảnh quay #${index}`,
    summary: "",
    shotSize: "Toàn cảnh",
    cameraAngle: "",
    cameraMovement: "",
    location: "",
    durationSec: 8,
    characterNames: [],
    propNames: [],
    sceneTag: "",
    action: "",
    visualDescription: "",
    dialogue: "",
    imagePrompt: "",
    videoPrompt: "",
    audioPrompt: "",
    mediaStatus: "pending",
    frameStatus: "pending",
    frameImageUrl: "",
    videoStatus: "pending",
    videoUrl: "",
    voiceStatus: "pending",
    voiceUrl: "",
    speakerName: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}
