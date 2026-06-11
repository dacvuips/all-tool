import {
  AffiliateVideoFormConfig,
  ElementFormImage,
  SceneScript,
  ScriptData,
  StoryboardAnalysisData,
  StoryModeTypeEnum,
} from "../../constants";
import { cropStoryboardRegion } from "./storyboardCropUtils";

/** Map kết quả AI + ảnh storyboard gốc → ScriptData cho right panel. */
export async function mapStoryboardAnalysisToScriptData(
  analysis: StoryboardAnalysisData,
  config: AffiliateVideoFormConfig,
  storyboardImage: ElementFormImage
): Promise<ScriptData> {
  const scenes: SceneScript[] = await Promise.all(
    analysis.scenes.map(async (scene) => {
      const id = crypto.randomUUID();
      const cropImage = await cropStoryboardRegion(
        storyboardImage,
        scene.cropRegion,
        scene.sceneNumber
      );

      const globalAudio = [
        analysis.voiceGender,
        analysis.voiceTone,
        analysis.voiceStyle,
        analysis.voicePacing,
      ]
        .filter(Boolean)
        .join(", ");

      return {
        id,
        sceneNumber: scene.sceneNumber,
        camera: scene.camera || "WIDE SHOT",
        dialogue: scene.dialogue || "",
        motionPrompt: scene.motionPrompt || "",
        visualPrompt: scene.visualDescription || "",
        imageGenPrompt: scene.visualDescription || "",
        audio: scene.audio || globalAudio,
        cropRegion: scene.cropRegion,
        storyboardCropImage: cropImage,
      };
    })
  );

  const scriptData: ScriptData = {
    storyModeType: config.storyModeType || StoryModeTypeEnum.image_to_video,
    topicTitle: analysis.topicTitle || config.tipContent || "",
    artStyle: config.artStyle || "",
    environment: "",
    characterName: "",
    characterBaseDescription: "",
    voiceGender: analysis.voiceGender || "",
    voiceTone: analysis.voiceTone || "",
    voiceStyle: analysis.voiceStyle || "",
    aspectRatio: config.aspectRatio,
    scenes,
    productImages: config.productImages,
    storyboardImage: [storyboardImage],
    voicePacing: analysis.voicePacing,
    audioPrompt: analysis.audioPrompt,
  };

  return scriptData;
}
