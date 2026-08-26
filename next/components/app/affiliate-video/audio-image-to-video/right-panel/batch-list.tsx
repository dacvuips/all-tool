import { NotifyText } from "../../../../shared/common/notify-text";
import { IntroGuideKey } from "../../../../shared/utilities/intro/intro-guide-storage";
import {
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
import { useAffiliateBatchListIntro } from "../../shared/use-affiliate-batch-list-intro";
import { useAffiliateVideoContext } from "../../storyboard/providers/affiliate-video-provider";
import { BatchActionBar } from "../../storyboard/right-panel/batch-action-bar";
import { SceneRowGroup } from "../../storyboard/right-panel/scene-batch-row";
import { registerAudioImageBatchActions } from "../audio-image-batch-bridge";

function AudioImageBatchActionBar({ scenes }: { scenes: SceneScript[] }) {
  return (
    <BatchActionBar scenes={scenes} onActionsReady={registerAudioImageBatchActions} />
  );
}

interface BatchListPanelProps {
  scenes: SceneScript[];
  characters: CharacterItem[];
  storyModeType: StoryModeTypeEnum;
  scriptCacheKey: string;
  /** Sau khi chọn bản lịch sử khác — vd. seed lại Studio */
  onHistorySelect?: (id: string) => void;
}

export function BatchListPanel({
  scenes,
  characters,
  storyModeType,
  scriptCacheKey,
  onHistorySelect,
}: BatchListPanelProps) {
  const {
    scriptData,
    setScriptData,
    selectedHistoryId,
    sceneHistory,
    selectHistoryItem,
    clearSceneHistory,
    renameHistoryItem,
  } = useAffiliateVideoContext();
  const db = useIndexedDB<ScriptData>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const { insertScene } = useAffiliateVideoApi();

  const { introElement, openIntro } = useAffiliateBatchListIntro({
    sidebarIntroKey: IntroGuideKey.STORYBOARD_SIDEBAR,
    sceneCount: scenes.length,
    hasProductImages: !!scriptData?.productImages?.length,
  });

  const handlePersistScenes = async (updatedScenes: any[]) => {
    try {
      const current = await db.get(scriptCacheKey);
      await db.set(scriptCacheKey, {
        ...(current ?? scriptData),
        scenes: updatedScenes as any,
      });
    } catch (err) {
      console.error("[audio-image/BatchListPanel] Failed to persist to IndexedDB:", err);
    }
  };

  const handleSyncScenes = async (updatedScenes: any[]) => {
    try {
      await db.set(scriptCacheKey, {
        ...scriptData,
        scenes: updatedScenes as any,
      });
      setScriptData({ ...scriptData, scenes: updatedScenes as any });
    } catch (err) {
      console.error("[audio-image/BatchListPanel] Failed to sync:", err);
    }
  };

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
      console.error("[audio-image/handleInsert] API error:", err);
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
    <>
      {introElement}
      <NotifyText
        text="Chức năng này đang xây dựng , sẽ có nhiều sai sót và chưa được tối ưu đầy đủ"
        color="red"
      />
      <SharedBatchListPanel
        scenes={scenes}
        characters={characters}
        hideImageColumn={false}
        selectedHistoryId={selectedHistoryId}
        history={
          sceneHistory?.length
            ? {
                items: sceneHistory,
                selectedId: selectedHistoryId ?? null,
                onSelect: (id) => {
                  selectHistoryItem?.(id);
                  onHistorySelect?.(id);
                },
                onClear: () => clearSceneHistory?.(),
                onRename: (id, label) => renameHistoryItem?.(id, label),
              }
            : undefined
        }
        onPersistScenes={handlePersistScenes}
        onSyncScenes={handleSyncScenes}
        onBuildInsertedScene={handleBuildInsertedScene}
        ActionBarComponent={AudioImageBatchActionBar}
        SceneRowComponent={SceneRowGroup}
        showBatchVideoVoice
        sceneRowExtraProps={{
          storyModeType,
          hideImageColumn: false,
          forceShowImageTab: true,
        }}
        onOpenIntro={openIntro}
      />
    </>
  );
}
