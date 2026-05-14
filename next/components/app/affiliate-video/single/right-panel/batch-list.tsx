/**
 * batch-list.tsx (single)
 * Thin wrapper around SharedBatchListPanel for the "single" module.
 * Handles context-specific persistence (IndexedDB) and API calls.
 */
import {
  CACHE_KEY,
  CharacterItem,
  DB_NAME,
  SceneScript,
  ScriptData,
  STORE_NAME,
  StoryModeTypeEnum,
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
  storyModeType: StoryModeTypeEnum;
}

export function BatchListPanel({ scenes, characters, storyModeType }: BatchListPanelProps) {
  const { scriptData, setScriptData, selectedHistoryId } = useAffiliateVideoContext();
  const db = useIndexedDB<ScriptData>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const { insertScene } = useAffiliateVideoApi();

  /** Persist scenes to IndexedDB (read-merge-write, no parent state sync) */
  const handlePersistScenes = async (updatedScenes: any[]) => {
    try {
      const current = await db.get(CACHE_KEY.lastScript);
      await db.set(CACHE_KEY.lastScript, { ...(current ?? scriptData), scenes: updatedScenes as any });
    } catch (err) {
      console.error("[single/BatchListPanel] Failed to persist to IndexedDB:", err);
    }
  };

  /** Persist scenes + sync parent context state */
  const handleSyncScenes = async (updatedScenes: any[]) => {
    try {
      await db.set(CACHE_KEY.lastScript, { ...scriptData, scenes: updatedScenes as any });
      setScriptData({ ...scriptData, scenes: updatedScenes as any });
    } catch (err) {
      console.error("[single/BatchListPanel] Failed to sync:", err);
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
        scriptContext: scriptData
          ? {
              cast: scriptData.characterName
                ? [
                    {
                      name: scriptData.characterName,
                      tag: "main",
                      description: scriptData.characterBaseDescription || "",
                    },
                  ]
                : undefined,
              environment: scriptData.environment,
              artStyle: scriptData.artStyle,
              voiceGender: scriptData.voiceGender,
              voiceTone: scriptData.voiceTone,
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
      console.error("[single/handleInsert] API error:", err);
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
      hideImageColumn={storyModeType === StoryModeTypeEnum.prompt_to_video}
      selectedHistoryId={selectedHistoryId}
      onPersistScenes={handlePersistScenes}
      onSyncScenes={handleSyncScenes}
      onBuildInsertedScene={handleBuildInsertedScene}
      ActionBarComponent={BatchActionBar}
      SceneRowComponent={SceneRowGroup}
      sceneRowExtraProps={{ storyModeType: scriptData?.storyModeType }}
    />
  );
}
