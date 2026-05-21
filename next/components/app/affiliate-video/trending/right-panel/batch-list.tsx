/**
 * batch-list.tsx (trending)
 * Thin wrapper around SharedBatchListPanel for the "trending" module.
 * Handles context-specific persistence (IndexedDB) and API calls.
 */
import {
  CACHE_KEY,
  CharacterItem,
  DB_NAME,
  SceneScript,
  STORE_NAME,
  TrendingScriptData,
} from "../../constants";
import { useAffiliateVideoApi } from "../../hook/useAffiliateVideoApi";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { SharedBatchListPanel } from "../../shared/batch-list";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchActionBar } from "./batch-action-bar";
import { SceneRowGroup } from "./scene-batch-row";

interface BatchListPanelProps {
  scenes: SceneScript[];
  characters: CharacterItem[];
}

export function BatchListPanel({ scenes, characters }: BatchListPanelProps) {
  const {
    trendingScriptData,
    setTrendingScriptData,
    selectedHistoryId,
    sceneHistory,
    selectHistoryItem,
    clearSceneHistory,
  } = useAffiliateVideoContext();
  const db = useIndexedDB<TrendingScriptData>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const { insertScene } = useAffiliateVideoApi();

  /** Persist scenes to IndexedDB (read-merge-write, no parent state sync) */
  const handlePersistScenes = async (updatedScenes: any[]) => {
    try {
      const current = await db.get(CACHE_KEY.lastTrendingScript);
      await db.set(CACHE_KEY.lastTrendingScript, {
        ...(current ?? trendingScriptData),
        scenes: updatedScenes as any,
      });
    } catch (err) {
      console.error("[trending/BatchListPanel] Failed to persist to IndexedDB:", err);
    }
  };

  /** Persist scenes + sync parent context state */
  const handleSyncScenes = async (updatedScenes: any[]) => {
    try {
      await db.set(CACHE_KEY.lastTrendingScript, {
        ...trendingScriptData,
        scenes: updatedScenes as any,
      });
      setTrendingScriptData({ ...trendingScriptData, scenes: updatedScenes as any });
    } catch (err) {
      console.error("[trending/BatchListPanel] Failed to sync:", err);
    }
  };

  /** Call AI API to build a new scene, fallback on error */
  const handleBuildInsertedScene = async (
    data: { description: string; voiceover: string; cameraAngle: string; selectedCharacters: string[]; audio: string },
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
        scriptContext: trendingScriptData
          ? {
              cast: trendingScriptData.characterName
                ? [
                    {
                      name: trendingScriptData.characterName,
                      tag: "main",
                      description: trendingScriptData.characterBaseDescription || "",
                    },
                  ]
                : undefined,
              environment: trendingScriptData.environment,
              artStyle: trendingScriptData.artStyle,
              voiceGender: trendingScriptData.voiceGender,
              voiceTone: trendingScriptData.voiceTone,
            }
          : undefined,
      });

      return {
        id: crypto.randomUUID(),
        sceneNumber,
        camera: result?.camera || data.cameraAngle || "WIDE SHOT",
        imageGenPrompt: result?.imagePrompt || data.description || "(AI generated)",
        motionPrompt: result?.motionPrompt || data.description || "(AI generated)",
        dialogue: result?.dialogue || data.voiceover || "",
        visualPrompt: result?.visualPrompt || "",
        audio: result?.audio || data.audio || "",
      };
    } catch (err) {
      console.error("[trending/handleInsert] API error:", err);
      return {
        id: crypto.randomUUID(),
        sceneNumber,
        camera: data.cameraAngle || "WIDE SHOT",
        imageGenPrompt: data.description || "(AI generated)",
        motionPrompt: data.description || "(AI generated)",
        dialogue: data.voiceover || "",
        visualPrompt: "",
        audio: data.audio || "",
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
