import { AffiliateVideoFormConfig, ElementFormImage, SceneScript, ScriptData, StoryModeTypeEnum } from "../../constants";

export function getStoryboardImagesWithBytes(
  images?: ElementFormImage[]
): ElementFormImage[] {
  return (images ?? []).filter((img) => img?.imageBytes);
}

export function renumberScenes(scenes: SceneScript[]): SceneScript[] {
  return scenes.map((scene, index) => ({ ...scene, sceneNumber: index + 1 }));
}

function createStoryboardPendingScene(imageIndex: number): SceneScript {
  return {
    id: `storyboard-pending-${imageIndex}`,
    sceneNumber: 0,
    camera: "",
    visualPrompt: "",
    imageGenPrompt: "",
    motionPrompt: "",
    dialogue: "",
    disabled: true,
    storyboardPending: true,
    storyboardSourceIndex: imageIndex,
  };
}

/** Ghép phân cảnh theo thứ tự ảnh upload — không đẩy ảnh xong nhanh lên đầu. */
export function buildStoryboardScriptInImageOrder(params: {
  indices: number[];
  resultsByIndex: Map<number, ScriptData>;
  errorIndices: Set<number>;
  config: AffiliateVideoFormConfig;
  includePendingPlaceholders: boolean;
}): ScriptData | null {
  const { indices, resultsByIndex, errorIndices, config, includePendingPlaceholders } = params;
  const scenes: SceneScript[] = [];
  let baseMeta: ScriptData | null = null;

  for (const imageIndex of indices) {
    if (errorIndices.has(imageIndex)) continue;

    const partial = resultsByIndex.get(imageIndex);
    if (partial) {
      if (!baseMeta) baseMeta = partial;
      scenes.push(...partial.scenes);
      continue;
    }

    if (includePendingPlaceholders) {
      scenes.push(createStoryboardPendingScene(imageIndex));
    }
  }

  if (!scenes.length) return null;

  const realScenes = scenes.filter((scene) => !scene.storyboardPending);
  if (!realScenes.length && !includePendingPlaceholders) return null;

  const meta = baseMeta ?? resultsByIndex.values().next().value ?? null;
  if (!meta && !includePendingPlaceholders) return null;

  return {
    ...(meta ?? {
      storyModeType: config.storyModeType ?? StoryModeTypeEnum.image_to_video,
      topicTitle: config.tipContent || "",
      artStyle: config.artStyle || "",
      environment: "",
      characterName: "",
      characterBaseDescription: "",
      voiceGender: "",
      voiceTone: "",
      voiceStyle: "",
      aspectRatio: config.aspectRatio,
      scenes: [],
    }),
    scenes: renumberScenes(scenes),
    storyboardImage: getStoryboardImagesWithBytes(config.storyboardImage),
    productImages: config.productImages,
  };
}

/** Gộp kết quả phân tích ảnh mới vào ScriptData đã có. */
export function mergeStoryboardScriptResults(
  accumulated: ScriptData | null,
  partial: ScriptData,
  config: AffiliateVideoFormConfig
): ScriptData {
  const allImages = getStoryboardImagesWithBytes(config.storyboardImage);

  if (!accumulated) {
    return {
      ...partial,
      scenes: renumberScenes(partial.scenes),
      storyboardImage: allImages,
    };
  }

  return {
    ...accumulated,
    scenes: renumberScenes([...accumulated.scenes, ...partial.scenes]),
    storyboardImage: allImages,
  };
}

/** Thay thế phân cảnh của một ảnh storyboard (dùng khi retry). */
export function replaceStoryboardImageScenes(
  scriptData: ScriptData,
  imageIndex: number,
  newScenes: SceneScript[]
): ScriptData {
  const scenesBefore = scriptData.scenes.filter(
    (scene) => (scene.storyboardSourceIndex ?? 0) < imageIndex
  );
  const scenesAfter = scriptData.scenes.filter(
    (scene) => (scene.storyboardSourceIndex ?? 0) > imageIndex
  );

  return {
    ...scriptData,
    scenes: renumberScenes([...scenesBefore, ...newScenes, ...scenesAfter]),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
