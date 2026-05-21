/**
 * batch-list.tsx (copy-video)
 * Thin wrapper around SharedBatchListPanel for the "copy-video" module.
 * Handles context-specific persistence (IndexedDB) and API calls.
 */
import { CACHE_KEY, CharacterItem, CopyVideoScene, DB_NAME, STORE_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { SharedBatchListPanel } from "../../shared/batch-list";
import { useCopyVideoApi } from "../hook/useCopyVideoApi";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { BatchActionBar } from "./batch-action-bar";
import { SceneRowGroup } from "./scene-batch-row";

interface BatchListPanelProps {
  scenes: CopyVideoScene[];
  characters: CharacterItem[];
}

export function BatchListPanel({ scenes, characters }: BatchListPanelProps) {
  const {
    scriptData,
    updateScriptData,
    selectedHistoryId,
    sceneHistory,
    selectHistoryItem,
    clearSceneHistory,
  } = useCopyVideoContext();
  const db = useIndexedDB<any>(STORE_NAME.copyVideo, DB_NAME.copyVideo);
  const { insertScene } = useCopyVideoApi();

  /** Persist scenes to IndexedDB (read-merge-write, no parent state sync).
   *  Also updates history item if a history entry is selected. */
  const handlePersistScenes = async (updatedScenes: any[]) => {
    try {
      const current = await db.get(CACHE_KEY.lastCopyVideoScript);
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...(current ?? scriptData),
        scenes: updatedScenes as any,
      });

      // Also update the selected history item in copyVideoHistory
      if (selectedHistoryId) {
        const history: any[] = (await db.get(CACHE_KEY.copyVideoHistory)) || [];
        const updatedHistory = history.map((item: any) =>
          item.id === selectedHistoryId
            ? { ...item, data: { ...item.data, scenes: updatedScenes as any } }
            : item
        );
        await db.set(CACHE_KEY.copyVideoHistory, updatedHistory);
      }
    } catch (err) {
      console.error("[copy-video/BatchListPanel] Failed to persist to IndexedDB:", err);
    }
  };

  /** Persist scenes + sync parent context state */
  const handleSyncScenes = async (updatedScenes: any[]) => {
    try {
      await db.set(CACHE_KEY.lastCopyVideoScript, {
        ...scriptData,
        scenes: updatedScenes as any,
      });
      updateScriptData?.({ ...scriptData, scenes: updatedScenes as any });
    } catch (err) {
      console.error("[copy-video/BatchListPanel] Failed to sync:", err);
    }
  };

  /** Call AI API to build a new scene, fallback on error */
  const handleBuildInsertedScene = async (
    data: {
      description: string;
      voiceover: string;
      cameraAngle: string;
      selectedCharacters: string[];
      audio: string;
    },
    sceneNumber: number,
    prevScene?: any,
    nextScene?: any
  ) => {
    try {
      const result = await insertScene({
        description: data.description,
        voiceover: data.voiceover,
        camera: data.cameraAngle,
        selectedCharacters: data.selectedCharacters,
        sceneNumber,
        prevScene,
        nextScene,
        scriptContext: scriptData
          ? {
              cast: scriptData.characters?.map((c: any, idx: number) => ({
                name: c.name,
                tag: idx === 0 ? "main" : "supporting",
                description: c.description || "",
              })),
            }
          : undefined,
      });

      return {
        id: crypto.randomUUID(),
        timestamp: "00:00",
        scene_type: "CHARACTER" as const,
        visual_prompt: result?.visualPrompt || data.description || "(AI generated)",
        motion_description: result?.motionPrompt || data.description || "(AI generated)",
        original_content: result?.dialogue || data.voiceover || "",
        audio_description: result?.audio || data.audio || "",
      };
    } catch (err) {
      console.error("[copy-video/handleInsert] API error:", err);
      return {
        id: crypto.randomUUID(),
        timestamp: "00:00",
        scene_type: "CHARACTER" as const,
        visual_prompt: data.description || "(AI generated)",
        motion_description: data.description || "(AI generated)",
        original_content: data.voiceover || "",
        audio_description: data.audio || "",
      };
    }
  };

  return (
    <SharedBatchListPanel
      scenes={scenes}
      characters={characters}
      selectedHistoryId={selectedHistoryId}
      history={
        sceneHistory?.length
          ? {
              items: sceneHistory,
              selectedId: selectedHistoryId ?? null,
              onSelect: (id) => selectHistoryItem?.(id),
              onClear: () => clearSceneHistory?.(),
              formatOptionLabel: (item) =>
                `${item.label} (${(item.data as any)?.scenes?.length || 0} scenes)`,
            }
          : undefined
      }
      onPersistScenes={handlePersistScenes}
      onSyncScenes={handleSyncScenes}
      onBuildInsertedScene={handleBuildInsertedScene}
      ActionBarComponent={BatchActionBar}
      SceneRowComponent={SceneRowGroup}
    />
  );
}
