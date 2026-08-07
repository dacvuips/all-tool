import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiLightningBolt, HiRefresh } from "react-icons/hi";
import { Button } from "../shared/utilities/form";
import FilmCharacterImagesPanel from "./film-character-images-panel";
import FilmPropsPanel from "./film-props-panel";
import FilmSceneImagesPanel from "./film-scene-images-panel";
import FilmCreateVideoPanel from "./film-create-video-panel";
import FilmVoicePanel from "./film-voice-panel";
import FilmShotImagesPanel from "./film-shot-images-panel";
import { sceneFrameReady } from "./film-shot-image-card";
import { sceneVideoReady } from "./film-video-card";
import { sceneHasDialogue, sceneVoiceReady, buildPlaceholderVoiceUrl } from "./film-voice-card";
import type { FilmVoiceGenerateInput } from "./film-voice-dialog";
import type { FilmShotFrameGenerateInput } from "./film-shot-frame-dialog";
import {
  addFilmScene,
  getFilmCharactersByProject,
  getFilmEpisodesByProject,
  getFilmProject,
  getFilmPropsByProject,
  getFilmSceneImagesByProject,
  getFilmScenesByEpisode,
  getFilmScenesByProject,
  initFilmDB,
  putFilmCharacter,
  putFilmProp,
  putFilmScene,
  putFilmSceneImage,
  replaceFilmCharactersForProject,
  replaceFilmPropsForProject,
  replaceFilmSceneImagesForProject,
  replaceFilmScenesForEpisode,
  saveFilmEpisodeOriginalContent,
} from "./film-idb";
import {
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmProjectRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
  FilmWorkspaceStepId,
  buildFilmCharactersFromNames,
  buildFilmPropsFromNames,
  buildFilmSceneImagesFromLocations,
  buildStoryboardScenesFromContent,
  collectCharacterNamesFromScenes,
  collectLocationsFromScenes,
  collectPropNamesFromScenes,
  createEmptyFilmProp,
  createEmptyFilmSceneImage,
  extractCharacterNamesFromText,
} from "./film-types";
import FilmOriginalContentPanel from "./film-original-content-panel";
import FilmStoryboardPanel, { createEmptyFilmScene } from "./film-storyboard-panel";
import FilmWorkspaceSidebar from "./film-workspace-sidebar";

type Props = {
  projectId: string;
};

export default function FilmWorkspace({ projectId }: Props) {
  const { t } = useTranslation();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<FilmProjectRecord | null>(null);
  const [episodes, setEpisodes] = useState<FilmEpisodeRecord[]>([]);
  const [activeEpisodeIndex, setActiveEpisodeIndex] = useState(0);
  const [activeStep, setActiveStep] = useState<FilmWorkspaceStepId>("original_content");
  const [characterCount, setCharacterCount] = useState(0);
  const [sceneCount, setSceneCount] = useState(0);
  const [scenes, setScenes] = useState<FilmSceneRecord[]>([]);
  const [characters, setCharacters] = useState<FilmCharacterRecord[]>([]);
  const [propsList, setPropsList] = useState<FilmPropRecord[]>([]);
  const [sceneImages, setSceneImages] = useState<FilmSceneImageRecord[]>([]);
  const [hasOriginalContent, setHasOriginalContent] = useState(false);

  const activeEpisode = episodes[activeEpisodeIndex] || null;

  const loadEpisodeScenes = useCallback(async (episodeId: string) => {
    const rows = await getFilmScenesByEpisode(episodeId);
    setScenes(rows);
  }, []);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      await initFilmDB();
      // Load project first — related stores failing must NOT wipe a valid project.
      const p = await getFilmProject(projectId);
      if (!p) {
        setProject(null);
        setEpisodes([]);
        setCharacters([]);
        setPropsList([]);
        setSceneImages([]);
        setScenes([]);
        setHasOriginalContent(false);
        setCharacterCount(0);
        setSceneCount(0);
        return;
      }

      const [eps, chars, allScenes, projectProps, locs] = await Promise.all([
        getFilmEpisodesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] episodes load failed:", e);
          return [] as FilmEpisodeRecord[];
        }),
        getFilmCharactersByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] characters load failed:", e);
          return [] as FilmCharacterRecord[];
        }),
        getFilmScenesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] scenes load failed:", e);
          return [] as FilmSceneRecord[];
        }),
        getFilmPropsByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] props load failed:", e);
          return [] as FilmPropRecord[];
        }),
        getFilmSceneImagesByProject(projectId).catch((e) => {
          console.error("[FilmWorkspace] sceneImages load failed:", e);
          return [] as FilmSceneImageRecord[];
        }),
      ]);

      setProject(p);
      setEpisodes(eps);
      setCharacters(chars);
      setPropsList(projectProps);
      setSceneImages(locs);
      setCharacterCount(Math.max(chars.length, p.characterCount || 0));
      setSceneCount(Math.max(allScenes.length, p.sceneCount || 0));
      setActiveEpisodeIndex(0);
      const ep = eps[0];
      if (ep) {
        setHasOriginalContent(!!ep.originalContent?.trim());
        try {
          setScenes(await getFilmScenesByEpisode(ep.id));
        } catch (e) {
          console.error("[FilmWorkspace] episode scenes load failed:", e);
          setScenes([]);
        }
      } else {
        setScenes([]);
        setHasOriginalContent(false);
      }
    } catch (err) {
      console.error("[FilmWorkspace] load failed:", err);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!activeEpisode) return;
    setHasOriginalContent(!!activeEpisode.originalContent?.trim());
    loadEpisodeScenes(activeEpisode.id).catch(console.error);
  }, [activeEpisode?.id, loadEpisodeScenes]);

  const handleSaveOriginal = async (content: string) => {
    if (!activeEpisode) return;
    const updated = await saveFilmEpisodeOriginalContent(activeEpisode.id, content);
    setEpisodes((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setHasOriginalContent(!!content.trim());
  };

  const handleExtract = async (content: string) => {
    if (!activeEpisode || !project) return;
    const generated = buildStoryboardScenesFromContent(
      project.id,
      activeEpisode,
      content,
      activeEpisode.sceneCount || undefined
    );
    const saved = await replaceFilmScenesForEpisode(project.id, activeEpisode.id, generated);
    setScenes(saved);
    setSceneCount((c) => Math.max(c, saved.length));
    setHasOriginalContent(true);
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === activeEpisode.id
          ? { ...e, originalContent: content, sceneCount: saved.length }
          : e
      )
    );
    setActiveStep("storyboard");
  };

  const handleSaveScene = async (scene: FilmSceneRecord) => {
    await putFilmScene(scene);
  };

  const handleReplaceScenes = async (next: FilmSceneRecord[]) => {
    if (!activeEpisode || !project) return;
    const saved = await replaceFilmScenesForEpisode(project.id, activeEpisode.id, next);
    setScenes(saved);
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === activeEpisode.id
          ? { ...e, sceneCount: saved.length, updatedAt: saved[0]?.updatedAt || e.updatedAt }
          : e
      )
    );
  };

  const handleAddScene = async () => {
    if (!activeEpisode || !project) return;
    const empty = createEmptyFilmScene(project.id, activeEpisode.id, scenes.length + 1);
    const created = await addFilmScene(empty);
    setScenes((prev) => [...prev, created]);
    setSceneCount((c) => c + 1);
  };

  const handleExtractCharacters = async () => {
    if (!project) return;
    const fromScenes = collectCharacterNamesFromScenes(scenes);
    const fromText = extractCharacterNamesFromText(activeEpisode?.originalContent || "");
    let names = Array.from(new Set([...fromScenes, ...fromText]));

    if (names.length === 0 && characters.length > 0) return;
    if (names.length === 0) names = ["Nhân vật 1", "Nhân vật 2"];

    const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c]));
    const built = buildFilmCharactersFromNames(project.id, names).map((c, i) => {
      const old = byName.get(c.name.trim().toLowerCase());
      if (!old) return c;
      return {
        ...c,
        id: old.id,
        role: old.role || c.role,
        description: old.description || c.description,
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        status: old.status,
        sortOrder: i,
      };
    });

    const saved = await replaceFilmCharactersForProject(project.id, built);
    setCharacters(saved);
    setCharacterCount(saved.length);
  };

  const handleSaveCharacter = async (c: FilmCharacterRecord) => {
    await putFilmCharacter(c);
  };

  const handleBulkCreateCharacters = async () => {
    const next = characters.map((c) => {
      if (c.status === "created" || c.imageUrl || (c.imageUrls && c.imageUrls.length)) return c;
      return {
        ...c,
        status: "created" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    for (const c of next) {
      await putFilmCharacter(c);
    }
    setCharacters(next);
  };

  const handleExtractProps = async () => {
    if (!project) return;
    let names = collectPropNamesFromScenes(scenes);
    if (names.length === 0 && propsList.length > 0) return;
    if (names.length === 0) {
      names = ["Vật phẩm 1", "Vật phẩm 2", "Vật phẩm 3"];
    }
    const byName = new Map(propsList.map((p) => [p.name.trim().toLowerCase(), p]));
    const built = buildFilmPropsFromNames(project.id, names).map((p, i) => {
      const old = byName.get(p.name.trim().toLowerCase());
      if (!old) return p;
      return {
        ...p,
        id: old.id,
        category: old.category || p.category,
        description: old.description || p.description,
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        status: old.status,
        locked: old.locked,
        sortOrder: i,
      };
    });
    const saved = await replaceFilmPropsForProject(project.id, built);
    setPropsList(saved);
  };

  const handleSaveProp = async (p: FilmPropRecord) => {
    await putFilmProp(p);
  };

  const handleBulkCreateProps = async () => {
    const next = propsList.map((p) => {
      if (p.status === "created" || p.imageUrl || (p.imageUrls && p.imageUrls.length)) return p;
      return {
        ...p,
        status: "created" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    for (const p of next) {
      await putFilmProp(p);
    }
    setPropsList(next);
  };

  const handleAddProp = async () => {
    if (!project) return;
    const empty = createEmptyFilmProp(project.id, propsList.length, `Vật phẩm ${propsList.length + 1}`);
    await putFilmProp(empty);
    setPropsList((prev) => [...prev, empty]);
  };

  const handleExtractSceneImages = async () => {
    if (!project) return;
    let locations = collectLocationsFromScenes(scenes);
    if (locations.length === 0 && sceneImages.length > 0) return;
    if (locations.length === 0) {
      locations = [
        { name: "Cảnh 1", context: "Ngày" },
        { name: "Cảnh 2", context: "Tối" },
        { name: "Cảnh 3", context: "Ngày" },
        { name: "Cảnh 4", context: "Ngày" },
      ];
    }
    const byName = new Map(sceneImages.map((p) => [p.name.trim().toLowerCase(), p]));
    const built = buildFilmSceneImagesFromLocations(project.id, locations).map((p, i) => {
      const old = byName.get(p.name.trim().toLowerCase());
      if (!old) return p;
      return {
        ...p,
        id: old.id,
        context: old.context || p.context,
        description: old.description || p.description,
        imageUrl: old.imageUrl,
        imageUrls: old.imageUrls,
        status: old.status,
        sortOrder: i,
      };
    });
    const saved = await replaceFilmSceneImagesForProject(project.id, built);
    setSceneImages(saved);
  };

  const handleSaveSceneImage = async (item: FilmSceneImageRecord) => {
    await putFilmSceneImage(item);
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleCreateSceneImage = async (item: FilmSceneImageRecord) => {
    const creating: FilmSceneImageRecord = {
      ...item,
      status: "creating",
      updatedAt: new Date().toISOString(),
    };
    setSceneImages((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
    await putFilmSceneImage(creating);
    await delay(900);
    const done: FilmSceneImageRecord = {
      ...creating,
      status: "created",
      updatedAt: new Date().toISOString(),
    };
    setSceneImages((prev) => prev.map((x) => (x.id === done.id ? done : x)));
    await putFilmSceneImage(done);
  };

  const handleBulkCreateSceneImages = async () => {
    const targets = sceneImages.filter(
      (p) => p.status !== "created" && !(p.imageUrl || (p.imageUrls && p.imageUrls.length))
    );
    if (!targets.length) return;

    const creating = sceneImages.map((p) => {
      if (p.status === "created" || p.imageUrl || (p.imageUrls && p.imageUrls.length)) return p;
      return { ...p, status: "creating" as const, updatedAt: new Date().toISOString() };
    });
    setSceneImages(creating);
    for (const p of creating) {
      if (p.status === "creating") await putFilmSceneImage(p);
    }
    await delay(1100);
    const next = creating.map((p) => {
      if (p.status !== "creating") return p;
      return { ...p, status: "created" as const, updatedAt: new Date().toISOString() };
    });
    for (const p of next) {
      await putFilmSceneImage(p);
    }
    setSceneImages(next);
  };

  const handleAddSceneImage = async () => {
    if (!project) return;
    const empty = createEmptyFilmSceneImage(
      project.id,
      sceneImages.length,
      `Cảnh ${sceneImages.length + 1}`
    );
    await putFilmSceneImage(empty);
    setSceneImages((prev) => [...prev, empty]);
  };

  const handleCreateShotFrame = async (input: FilmShotFrameGenerateInput) => {
    const { scene, prompt, characterIds } = input;
    const refNames = characters
      .filter((c) => characterIds.includes(c.id))
      .map((c) => c.name)
      .filter(Boolean);

    const creating: FilmSceneRecord = {
      ...scene,
      imagePrompt: prompt,
      characterNames: refNames.length
        ? refNames
        : scene.characterNames || [],
      frameStatus: "creating",
      mediaStatus: "pending",
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
    await putFilmScene(creating);
    await delay(1000);
    const done: FilmSceneRecord = {
      ...creating,
      frameStatus: "ready",
      mediaStatus: "ready",
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === done.id ? done : x)));
    await putFilmScene(done);
  };

  const handleBulkCreateShotFrames = async () => {
    const targets = scenes.filter((s) => !sceneFrameReady(s));
    if (!targets.length) return;
    const creating = scenes.map((s) => {
      if (sceneFrameReady(s)) return s;
      return {
        ...s,
        frameStatus: "creating" as const,
        mediaStatus: "pending" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    setScenes(creating);
    for (const s of creating) {
      if (s.frameStatus === "creating") await putFilmScene(s);
    }
    await delay(1200);
    const next = creating.map((s) => {
      if (s.frameStatus !== "creating") return s;
      return {
        ...s,
        frameStatus: "ready" as const,
        mediaStatus: "ready" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    for (const s of next) {
      await putFilmScene(s);
    }
    setScenes(next);
  };

  const handleCreateVideo = async (scene: FilmSceneRecord) => {
    const creating: FilmSceneRecord = {
      ...scene,
      videoStatus: "creating",
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
    await putFilmScene(creating);
    await delay(1200);
    const done: FilmSceneRecord = {
      ...creating,
      videoStatus: "ready",
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === done.id ? done : x)));
    await putFilmScene(done);
  };

  const handleBulkCreateVideos = async () => {
    const targets = scenes.filter((s) => !sceneVideoReady(s));
    if (!targets.length) return;
    const creating = scenes.map((s) => {
      if (sceneVideoReady(s)) return s;
      return {
        ...s,
        videoStatus: "creating" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    setScenes(creating);
    for (const s of creating) {
      if (s.videoStatus === "creating") await putFilmScene(s);
    }
    await delay(1400);
    const next = creating.map((s) => {
      if (s.videoStatus !== "creating") return s;
      return {
        ...s,
        videoStatus: "ready" as const,
        updatedAt: new Date().toISOString(),
      };
    });
    for (const s of next) {
      await putFilmScene(s);
    }
    setScenes(next);
  };

  const handleCreateVoice = async (input: FilmVoiceGenerateInput) => {
    const { scene, source, voiceId, voiceLabel } = input;
    const creating: FilmSceneRecord = {
      ...scene,
      speakerName: scene.speakerName || scene.characterNames?.[0] || "",
      voiceSource: source,
      voiceId,
      voiceLabel,
      voiceStatus: "creating",
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === creating.id ? creating : x)));
    await putFilmScene(creating);
    await delay(1000);
    const done: FilmSceneRecord = {
      ...creating,
      voiceStatus: "ready",
      voiceUrl: buildPlaceholderVoiceUrl(Math.max(2, scene.durationSec || 3)),
      updatedAt: new Date().toISOString(),
    };
    setScenes((prev) => prev.map((x) => (x.id === done.id ? done : x)));
    await putFilmScene(done);
  };

  const handleBulkCreateVoices = async () => {
    const targets = scenes.filter((s) => !sceneVoiceReady(s));
    if (!targets.length) return;
    const creating = scenes.map((s) => {
      if (sceneVoiceReady(s)) return s;
      return {
        ...s,
        voiceStatus: "creating" as const,
        speakerName: s.speakerName || s.characterNames?.[0] || "",
        updatedAt: new Date().toISOString(),
      };
    });
    setScenes(creating);
    for (const s of creating) {
      if (s.voiceStatus === "creating") await putFilmScene(s);
    }
    await delay(1200);
    const next = creating.map((s) => {
      if (s.voiceStatus !== "creating") return s;
      return {
        ...s,
        voiceStatus: "ready" as const,
        voiceUrl: buildPlaceholderVoiceUrl(Math.max(2, s.durationSec || 3)),
        updatedAt: new Date().toISOString(),
      };
    });
    for (const s of next) {
      await putFilmScene(s);
    }
    setScenes(next);
  };

  if (loading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-sm text-gray-400">
        {t("Đang tải...")}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="w-full min-h-screen flex flex-col items-center justify-center gap-3 px-6">
        <p className="text-gray-500 m-0">{t("Không tìm thấy dự án.")}</p>
        <Button outline text={t("Quay lại")} onClick={() => router.push("/film")} />
      </div>
    );
  }

  const episodeLabel = activeEpisode?.title || `${t("Tập")} ${activeEpisodeIndex + 1}`;
  const hasStoryboard = scenes.length > 0;
  const hasCharacters = characters.length > 0;
  const charactersDone =
    hasCharacters &&
    characters.every(
      (c) => c.status === "created" || !!c.imageUrl || (c.imageUrls && c.imageUrls.length > 0)
    );
  const hasProps = propsList.length > 0;
  const propsDone =
    hasProps &&
    propsList.every(
      (p) => p.status === "created" || !!p.imageUrl || (p.imageUrls && p.imageUrls.length > 0)
    );
  const hasSceneImages = sceneImages.length > 0;
  const sceneImagesDone =
    hasSceneImages &&
    sceneImages.every(
      (p) => p.status === "created" || !!p.imageUrl || (p.imageUrls && p.imageUrls.length > 0)
    );
  const shotImagesDone =
    hasStoryboard && scenes.length > 0 && scenes.every(sceneFrameReady);
  const createVideoDone =
    hasStoryboard && scenes.length > 0 && scenes.every(sceneVideoReady);
  const voiceTargets =
    hasStoryboard && scenes.length > 0
      ? scenes.some(sceneHasDialogue)
        ? scenes.filter(sceneHasDialogue)
        : scenes
      : [];
  const voiceDone =
    voiceTargets.length > 0 && voiceTargets.every(sceneVoiceReady);
  const doneSteps: FilmWorkspaceStepId[] = [];
  if (hasOriginalContent) doneSteps.push("original_content");
  if (hasStoryboard) doneSteps.push("storyboard");
  if (charactersDone) doneSteps.push("character_images");
  if (propsDone) doneSteps.push("props");
  if (sceneImagesDone) doneSteps.push("scene_images");
  if (voiceDone) doneSteps.push("voice");
  if (shotImagesDone) doneSteps.push("shot_images");
  if (createVideoDone) doneSteps.push("create_video");

  const openLayout =
    activeStep === "storyboard" ||
    activeStep === "character_images" ||
    activeStep === "props" ||
    activeStep === "scene_images" ||
    activeStep === "voice" ||
    activeStep === "shot_images" ||
    activeStep === "create_video";

  return (
    <div className="w-full min-h-screen bg-gray-100 flex flex-col">
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.push("/film")}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-blue-600 bg-transparent border-0 cursor-pointer flex-shrink-0"
            >
              <HiArrowLeft />
              <span className="hidden sm:inline">{t("Quay lại")}</span>
            </button>
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 m-0 truncate">
                {project.name}
              </h1>
              <span className="text-sm text-gray-500 flex-shrink-0">{episodeLabel}</span>
              <span className="hidden sm:inline text-gray-300 flex-shrink-0">·</span>
              <p className="text-xs text-gray-400 m-0">
                {t("Nội dung gồm")}: {characterCount} {t("Nhân vật")} - {sceneCount}{" "}
                {t("Cảnh quay")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap flex-shrink-0">
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100">
              {t("Gói")}: GNOLIMIT
            </span>
            <Button
              outline
              small
              text={t("Làm mới")}
              icon={<HiRefresh />}
              className="!rounded-lg"
              onClick={load}
            />
            <Button
              primary
              small
              text={t("Bắt đầu sản xuất")}
              icon={<HiLightningBolt />}
              className="!rounded-lg !bg-blue-600 hover:!bg-blue-700"
              onClick={() => setActiveStep("character_images")}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row gap-4 min-h-0">
        <FilmWorkspaceSidebar
          activeStep={activeStep}
          progressDone={doneSteps.length}
          doneStepIds={doneSteps}
          onStepChange={setActiveStep}
          onRefresh={load}
        />

        <main
          className={`flex-1 min-w-0 min-h-md ${
            openLayout ? "" : "bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5"
          }`}
        >
          {activeStep === "original_content" && (
            <>
              <FilmOriginalContentPanel
                episode={activeEpisode}
                onSave={handleSaveOriginal}
                onExtract={handleExtract}
              />
              {episodes.length > 1 && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                  {episodes.map((ep, idx) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setActiveEpisodeIndex(idx)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer ${
                        idx === activeEpisodeIndex
                          ? "bg-blue-50 border-blue-200 text-blue-700"
                          : "bg-white border-gray-200 text-gray-600"
                      }`}
                    >
                      {ep.title || `${t("Tập")} ${ep.index}`}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {activeStep === "storyboard" && (
            <FilmStoryboardPanel
              projectId={project.id}
              episode={activeEpisode}
              scenes={scenes}
              characters={characters}
              onScenesChange={setScenes}
              onSaveScene={handleSaveScene}
              onReplaceScenes={handleReplaceScenes}
              onAddScene={handleAddScene}
              onTabNavigate={(tab) => {
                if (tab === "voice") setActiveStep("voice");
                else if (tab === "shot_images") setActiveStep("shot_images");
                else if (tab === "create_video") setActiveStep("create_video");
              }}
            />
          )}

          {activeStep === "character_images" && (
            <FilmCharacterImagesPanel
              characters={characters}
              onCharactersChange={setCharacters}
              onSaveCharacter={handleSaveCharacter}
              onExtractCharacters={handleExtractCharacters}
              onBulkCreate={handleBulkCreateCharacters}
              onTabNavigate={(tab) => {
                if (tab === "props") setActiveStep("props");
                else if (tab === "scene_images") setActiveStep("scene_images");
              }}
            />
          )}

          {activeStep === "props" && (
            <FilmPropsPanel
              props={propsList}
              onPropsChange={setPropsList}
              onSaveProp={handleSaveProp}
              onExtractProps={handleExtractProps}
              onBulkCreate={handleBulkCreateProps}
              onAddProp={handleAddProp}
              onTabNavigate={(tab) => {
                if (tab === "character_images" || tab === "extract_characters") {
                  setActiveStep("character_images");
                } else if (tab === "scene_images") {
                  setActiveStep("scene_images");
                }
              }}
            />
          )}

          {activeStep === "scene_images" && (
            <FilmSceneImagesPanel
              items={sceneImages}
              onItemsChange={setSceneImages}
              onSaveItem={handleSaveSceneImage}
              onExtract={handleExtractSceneImages}
              onBulkCreate={handleBulkCreateSceneImages}
              onAddItem={handleAddSceneImage}
              onCreateItem={handleCreateSceneImage}
              onTabNavigate={(tab) => {
                if (tab === "character_images" || tab === "extract_characters") {
                  setActiveStep("character_images");
                } else if (tab === "props") {
                  setActiveStep("props");
                }
              }}
            />
          )}

          {activeStep === "shot_images" && (
            <FilmShotImagesPanel
              scenes={scenes}
              characters={characters}
              onCreateFrame={handleCreateShotFrame}
              onBulkCreateFrames={handleBulkCreateShotFrames}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") setActiveStep("storyboard");
                else if (tab === "voice") setActiveStep("voice");
                else if (tab === "create_video") setActiveStep("create_video");
              }}
            />
          )}

          {activeStep === "voice" && (
            <FilmVoicePanel
              scenes={scenes}
              onCreateVoice={handleCreateVoice}
              onBulkCreateVoices={handleBulkCreateVoices}
              onDownloadAll={() => {
                console.info("[Film] Download all voice audio (not implemented)");
              }}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") setActiveStep("storyboard");
                else if (tab === "shot_images") setActiveStep("shot_images");
                else if (tab === "create_video") setActiveStep("create_video");
              }}
            />
          )}

          {activeStep === "create_video" && (
            <FilmCreateVideoPanel
              scenes={scenes}
              onCreateVideo={handleCreateVideo}
              onBulkCreateVideos={handleBulkCreateVideos}
              onDownloadAll={() => {
                // Placeholder — export zip khi có video thật
                console.info("[Film] Download all videos (not implemented)");
              }}
              onTabNavigate={(tab) => {
                if (tab === "storyboard") setActiveStep("storyboard");
                else if (tab === "voice") setActiveStep("voice");
                else if (tab === "shot_images") setActiveStep("shot_images");
              }}
            />
          )}

          {activeStep !== "original_content" &&
            activeStep !== "storyboard" &&
            activeStep !== "character_images" &&
            activeStep !== "props" &&
            activeStep !== "scene_images" &&
            activeStep !== "voice" &&
            activeStep !== "shot_images" &&
            activeStep !== "create_video" && (
              <div className="h-full min-h-xs flex flex-col items-center justify-center text-center px-6">
                <p className="text-base font-semibold text-gray-700 m-0">
                  {t("Tính năng đang phát triển")}
                </p>
              </div>
            )}
        </main>
      </div>
    </div>
  );
}
