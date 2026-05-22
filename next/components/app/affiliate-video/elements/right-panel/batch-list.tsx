/**
 * batch-list.tsx (elements)
 * Thin wrapper around SharedBatchListPanel for the "elements" module.
 * Handles context-specific persistence (IndexedDB) and API calls.
 */
import { CACHE_KEY, CharacterItem, CopyVideoScene, DB_NAME, STORE_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { SharedBatchListPanel } from "../../shared/batch-list";
import { useElementApi } from "../hook/useElementApi";
import { useElementContext } from "../providers/element-provider";
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
  } = useElementContext();
  const db = useIndexedDB<any>(STORE_NAME.generateElement, DB_NAME.generateElement);
  const { insertScene } = useElementApi();

  /** Persist scenes to IndexedDB (read-merge-write, no parent state sync).
   *  Also updates history item if a history entry is selected. */
  const handlePersistScenes = async (updatedScenes: any[]) => {
    try {
      const current = await db.get(CACHE_KEY.lastElementScript);
      await db.set(CACHE_KEY.lastElementScript, {
        ...(current ?? scriptData),
        scenes: updatedScenes as any,
      });

      // Also update the selected history item in elementHistory
      if (selectedHistoryId) {
        const history: any[] = (await db.get(CACHE_KEY.elementHistory)) || [];
        const updatedHistory = history.map((item: any) =>
          item.id === selectedHistoryId
            ? { ...item, data: { ...item.data, scenes: updatedScenes as any } }
            : item
        );
        await db.set(CACHE_KEY.elementHistory, updatedHistory);
      }
    } catch (err) {
      console.error("[elements/BatchListPanel] Failed to persist to IndexedDB:", err);
    }
  };

  /** Persist scenes + sync parent context state */
  const handleSyncScenes = async (updatedScenes: any[]) => {
    try {
      await db.set(CACHE_KEY.lastElementScript, {
        ...scriptData,
        scenes: updatedScenes as any,
      });
      updateScriptData?.({ ...scriptData, scenes: updatedScenes as any });
    } catch (err) {
      console.error("[elements/BatchListPanel] Failed to sync:", err);
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
        scriptContext: undefined,
      });

      return {
        id: crypto.randomUUID(),
        timestamp: "",
        scene_type: "",
        visual_prompt: result?.visualPrompt || data.description || "(AI generated)",
        motion_description: "",
        original_content: "",
        audio_description: "",
      };
    } catch (err) {
      console.error("[elements/handleInsert] API error:", err);
      return {
        id: crypto.randomUUID(),
        timestamp: "",
        scene_type: "",
        visual_prompt: data.description || "(AI generated)",
        motion_description: "",
        original_content: "",
        audio_description: "",
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
