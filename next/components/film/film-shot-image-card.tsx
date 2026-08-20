/**
 * Card Ảnh / Video cảnh quay — tái dụng SceneCardTabs + SceneCardImageTab + SceneCardVideoTab (tool).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiSparkles } from "react-icons/hi";
import { useToast } from "../../lib/providers/toast-provider";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import {
  getGeneratedImagePreviewSrc,
  getOrCreateBlobPreviewUrl,
} from "../app/affiliate-video/shared/generatedMediaUtils";
import { isMediaContentPolicyError } from "../app/affiliate-video/shared/media-error-message";
import { SceneCardImageTab } from "../app/affiliate-video/shared/scene-card-image-tab";
import { SceneCardTabs, type SceneTabKey } from "../app/affiliate-video/shared/scene-card-tabs";
import {
  SceneCardVideoTab,
  type GeneratedVideoData,
} from "../app/affiliate-video/shared/scene-card-video-tab";
import { Button } from "../shared/utilities/form";
import {
  FilmAttachOption,
  FilmSceneMissingAttachChips,
} from "./film-attach-fields";
import {
  detachFilmSceneAttachName,
  isFilmAttachErrorMessage,
  listFilmSceneAttachIssues,
  type FilmAttachIssueKind,
} from "./film-attachment-validate";
import FilmImageGalleryDialog from "./film-image-gallery-dialog";
import {
  buildFilmShotFrameDefaultPrompt
} from "./film-shot-frame-dialog";
import {
  FilmAspectRatio,
  FilmCharacterRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
  FilmSceneRecord,
} from "./film-types";
import type { FilmVideoRefMode, FilmVideoRefSlot } from "./film-video-ref-mode";
import FilmVideoRefSlots from "./film-video-ref-slots";

type Props = {
  scene: FilmSceneRecord;
  aspectRatio?: FilmAspectRatio;
  /** Style prompt chung (Setting) — resolve prompt chính */
  storyboardImagePromptStyle?: string | null;
  /** Tạo / tạo lại khung hình ngay (không mở modal) */
  onCreateFrame?: (scene: FilmSceneRecord) => void;
  onStopFrame?: (scene: FilmSceneRecord) => void;
  generationActionPending?: boolean;
  /** Upload / chọn gallery → ghi frame */
  onSetFrameImage?: (scene: FilmSceneRecord, image: GeneratedImageData) => void;
  onCreateVideo?: (scene: FilmSceneRecord) => void;
  onStopVideo?: (scene: FilmSceneRecord) => void;
  videoActionPending?: boolean;
  /** Ép tab (panel Tạo video) */
  forcedTab?: SceneTabKey | null;
  /** Ẩn tab Ảnh (panel Tạo video) */
  hideImageTab?: boolean;
  /** Ẩn tab Video (panel Ảnh Cảnh quay) */
  hideVideoTab?: boolean;
  /** Giữ tab Video nối như tool; mặc định ẩn vì film chưa nối */
  hideExtendTab?: boolean;
  /** Click tiêu đề → mở phân cảnh tương ứng (Chuỗi Cảnh quay) */
  onTitleClick?: (scene: FilmSceneRecord) => void;
  characters?: FilmCharacterRecord[];
  propsList?: FilmPropRecord[];
  sceneImages?: FilmSceneImageRecord[];
  onOpenAttachEntity?: (kind: FilmAttachIssueKind, option: FilmAttachOption) => void;
  onDetachAttach?: (scene: FilmSceneRecord, kind: FilmAttachIssueKind, name: string) => void;
  /** AI viết lại prompt tránh content policy */
  onSuggestSafePrompt?: (scene: FilmSceneRecord) => void;
  /** Chọn prompt chính | đề xuất khi gen */
  onFramePromptSourceChange?: (
    scene: FilmSceneRecord,
    source: "main" | "suggested"
  ) => void;
  /** Chế độ Ảnh tham chiếu (Tạo video) */
  videoRefMode?: FilmVideoRefMode | null;
  onVideoRefSlotsChange?: (
    scene: FilmSceneRecord,
    slots: Array<FilmVideoRefSlot | null>
  ) => void;
};

export function sceneFrameReady(scene: FilmSceneRecord): boolean {
  return (
    scene.frameStatus === "ready" ||
    !!scene.frameImageBlob ||
    !!scene.frameImageUrl ||
    scene.mediaStatus === "ready"
  );
}

export function sceneFrameCreating(scene: FilmSceneRecord): boolean {
  return scene.frameStatus === "creating";
}

function sceneToGeneratedImage(scene: FilmSceneRecord): GeneratedImageData | null {
  if (scene.frameImageBlob instanceof Blob && scene.frameImageBlob.size > 0) {
    const previewUrl = getOrCreateBlobPreviewUrl(scene.frameImageBlob);
    return {
      mimeType: scene.frameImageBlob.type || "image/jpeg",
      fifeUrl: previewUrl,
      imageUrl: scene.frameImageUrl || previewUrl,
      previewUrl,
      mediaBlob: scene.frameImageBlob,
    };
  }
  const url = (scene.frameImageUrl || "").trim();
  if (!url) return null;
  return {
    mimeType: "image/jpeg",
    fifeUrl: url,
    imageUrl: url,
    previewUrl: url,
  };
}

function sceneToGeneratedVideo(
  scene: FilmSceneRecord,
  aspectRatio: FilmAspectRatio
): GeneratedVideoData | null {
  const url = (scene.videoUrl || "").trim();
  if (!url) return null;
  return {
    videoUri: url,
    mimeType: "video/mp4",
    previewUrl: url,
    aspectRatio,
  };
}

export default function FilmShotImageCard({
  scene,
  aspectRatio = "9:16",
  storyboardImagePromptStyle,
  onCreateFrame,
  onStopFrame,
  generationActionPending = false,
  onSetFrameImage,
  onCreateVideo,
  onStopVideo,
  videoActionPending = false,
  forcedTab = null,
  hideImageTab = false,
  hideVideoTab = false,
  hideExtendTab = true,
  onTitleClick,
  characters = [],
  propsList = [],
  sceneImages = [],
  onOpenAttachEntity,
  onDetachAttach,
  onSuggestSafePrompt,
  onFramePromptSourceChange,
  videoRefMode = null,
  onVideoRefSlotsChange,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const ar: "16:9" | "9:16" = aspectRatio === "16:9" ? "16:9" : "9:16";
  const indexLabel = `#${scene.index}`;
  const sceneTitle =
    scene.title?.trim() ||
    scene.summary?.trim() ||
    `${t("Cảnh quay")} ${indexLabel}`;

  const generatingImage = sceneFrameCreating(scene);
  const generatingVideo = scene.videoStatus === "creating";
  const imageProgress =
    typeof scene.frameMediaProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(scene.frameMediaProgress)))
      : generatingImage
        ? 5
        : 0;
  const videoProgress =
    typeof scene.videoMediaProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(scene.videoMediaProgress)))
      : generatingVideo
        ? 5
        : 0;

  const generatedImage = useMemo(
    () => sceneToGeneratedImage(scene),
    [scene.frameImageUrl, scene.frameImageBlob, scene.frameStatus]
  );
  const generatedVideo = useMemo(
    () => sceneToGeneratedVideo(scene, aspectRatio),
    [scene.videoUrl, aspectRatio]
  );
  const hasImage = !!generatedImage || sceneFrameReady(scene);

  const mainPrompt = useMemo(
    () => buildFilmShotFrameDefaultPrompt(scene, storyboardImagePromptStyle),
    [
      scene.imagePrompt,
      scene.id,
      storyboardImagePromptStyle,
      scene.visualDescription,
      scene.action,
    ]
  );
  const suggestedPrompt = String(scene.frameSuggestedPrompt || "").trim();
  const hasSuggested = !!suggestedPrompt;
  const promptSource: "main" | "suggested" =
    scene.framePromptSource === "main" ? "main" : hasSuggested ? "suggested" : "main";
  const suggestLoading = scene.frameSuggestStatus === "loading";
  const isImagePolicyError = isMediaContentPolicyError(scene.frameError);
  const attachIssues = useMemo(
    () => listFilmSceneAttachIssues(scene, characters, propsList, sceneImages),
    [
      scene.characterNames,
      scene.propNames,
      scene.locationNames,
      scene.sceneTag,
      scene.location,
      scene.episodeId,
      characters,
      propsList,
      sceneImages,
    ]
  );
  const attachError = isFilmAttachErrorMessage(scene.frameError);
  const showAttachChips = attachError && attachIssues.length > 0;
  const imageErrorMessage = showAttachChips ? null : scene.frameError;
  /** Chỉ tab Ảnh — không hiện khi đang xem tab Video. */
  const showImagePolicyAssist =
    isImagePolicyError ||
    hasSuggested ||
    (suggestLoading && isImagePolicyError) ||
    (scene.frameSuggestStatus === "error" && isImagePolicyError);
  const showImageSuggestButton =
    !!onSuggestSafePrompt && isImagePolicyError && !generatingImage;

  const handleSetImage = (imageData: GeneratedImageData) => {
    if (onSetFrameImage) {
      onSetFrameImage(scene, imageData);
      return;
    }
    toast.info(t("Tải lên ảnh khung hình chưa được hỗ trợ ở đây."));
  };

  const renderImagePolicyAssist = () => {
    if (!showImagePolicyAssist) return null;
    return (
      <div className="space-y-1.5 pt-1">
        {showImageSuggestButton && !hasSuggested && !suggestLoading ? (
          <Button
            outline
            text={t("AI Gợi ý tránh lỗi")}
            icon={<HiSparkles />}
            iconClassName="!text-sm"
            className="!rounded-md w-full !text-xs !font-medium !py-1 !px-2 !min-h-0 !h-auto !leading-tight !border-primary !text-primary-dark hover:!bg-primary-light"
            onClick={() => onSuggestSafePrompt?.(scene)}
          />
        ) : null}

        {suggestLoading && isImagePolicyError ? (
          <p className="m-0 py-1 text-xs font-medium text-center text-blue-600">
            {t("Đang gợi ý prompt an toàn...")}
          </p>
        ) : null}

        {scene.frameSuggestStatus === "error" &&
        scene.frameSuggestError &&
        isImagePolicyError ? (
          <div className="space-y-1.5">
            <p className="m-0 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-2 py-1.5">
              {scene.frameSuggestError}
            </p>
            {showImageSuggestButton ? (
              <Button
                outline
                text={t("AI Gợi ý tránh lỗi")}
                icon={<HiSparkles />}
                iconClassName="!text-sm"
                className="!rounded-md w-full !text-xs !font-medium !py-1 !px-2 !min-h-0 !h-auto !leading-tight !border-primary !text-primary-dark hover:!bg-primary-light"
                onClick={() => onSuggestSafePrompt?.(scene)}
              />
            ) : null}
          </div>
        ) : null}

        {hasSuggested && !suggestLoading ? (
          <div className="rounded-lg border border-green-200 bg-green-50 p-2 space-y-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-10 font-bold tracking-wide text-green-700 uppercase flex-shrink-0">
                {t("Prompt đề xuất")}
              </span>
              {scene.frameSuggestSummary ? (
                <span
                  className="min-w-0 flex-1 text-10 text-green-800 truncate"
                  title={scene.frameSuggestSummary}
                >
                  {scene.frameSuggestSummary}
                </span>
              ) : (
                <span className="flex-1" />
              )}
              {showImageSuggestButton ? (
                <button
                  type="button"
                  title={t("Đề xuất lại")}
                  onClick={() => onSuggestSafePrompt?.(scene)}
                  className="inline-flex items-center gap-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md border border-green-200 bg-white text-10 font-semibold text-green-700 hover:bg-green-100 cursor-pointer"
                >
                  <HiSparkles className="text-xs" />
                  {t("Lại")}
                </button>
              ) : null}
            </div>

            <div className="flex rounded-md border border-green-200 bg-white p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => onFramePromptSourceChange?.(scene, "suggested")}
                className={`flex-1 min-w-0 px-1.5 py-1 rounded text-10 font-semibold border-0 cursor-pointer transition-colors ${
                  promptSource === "suggested"
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                title={suggestedPrompt}
              >
                {t("Đề xuất AI")}
              </button>
              <button
                type="button"
                onClick={() => onFramePromptSourceChange?.(scene, "main")}
                className={`flex-1 min-w-0 px-1.5 py-1 rounded text-10 font-semibold border-0 cursor-pointer transition-colors ${
                  promptSource === "main"
                    ? "bg-green-600 text-white shadow-sm"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                title={mainPrompt || t("(trống)")}
              >
                {t("Prompt chính")}
              </button>
            </div>

            <p
              className="m-0 max-h-24 overflow-y-auto text-10 leading-snug text-gray-600 pr-0.5 break-words"
              title={
                promptSource === "suggested"
                  ? suggestedPrompt
                  : mainPrompt || t("(trống)")
              }
            >
              {promptSource === "suggested"
                ? suggestedPrompt
                : mainPrompt || t("(trống)")}
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm flex flex-col h-full transition-all hover:border-primary">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-10 font-bold bg-gray-800 text-white flex-shrink-0">
          {indexLabel}
        </span>
        {onTitleClick ? (
          <button
            type="button"
            className="min-w-0 flex-1 text-left text-xs font-semibold text-gray-800 truncate border-0 bg-transparent p-0 cursor-pointer hover:text-blue-600 hover:underline"
            title={t("Mở phân cảnh trong Chuỗi Cảnh quay")}
            onClick={() => onTitleClick(scene)}
          >
            {sceneTitle}
          </button>
        ) : (
          <span className="text-xs font-semibold text-gray-800 truncate" title={sceneTitle}>
            {sceneTitle}
          </span>
        )}
        {scene.shotSize ? (
          <span className="ml-auto flex-shrink-0 text-10 font-medium text-gray-400 truncate max-w-[40%]">
            {scene.shotSize}
          </span>
        ) : null}
      </div>

      {videoRefMode && onVideoRefSlotsChange ? (
        <div className="px-2.5 pt-2 pb-1">
          <FilmVideoRefSlots
            mode={videoRefMode}
            slots={scene.videoRefSlots}
            disabled={generatingVideo}
            onChange={(slots) => onVideoRefSlotsChange(scene, slots)}
          />
        </div>
      ) : null}

      <SceneCardTabs
        hideImageTab={hideImageTab}
        hideExtendTab={hideExtendTab}
        hideVideoTab={hideVideoTab}
        forcedTab={forcedTab}
        tabStatus={{
          image: {
            loading: generatingImage,
            progress: imageProgress,
            done: !!generatedImage,
          },
          video: {
            loading: generatingVideo,
            progress: videoProgress,
            done: !!generatedVideo,
          },
        }}
        renderImageTab={() => (
          <SceneCardImageTab
            aspectRatio={ar}
            uniformFrame
            generatedImage={generatedImage}
            generatingImage={generatingImage}
            imageProgress={imageProgress}
            sceneNumber={scene.index}
            errorMessage={imageErrorMessage}
            errorSlot={
              showAttachChips ? (
                <FilmSceneMissingAttachChips
                  scene={scene}
                  characters={characters}
                  props={propsList}
                  sceneImages={sceneImages}
                  onOpen={(kind, issue) => {
                    onOpenAttachEntity?.(kind, {
                      id: issue.id || "",
                      name: issue.name,
                      imageBlob: issue.imageBlob,
                      imageUrl: issue.imageUrl,
                      imageUrls: issue.imageUrls,
                    });
                  }}
                  onRemove={(kind, name) => {
                    if (onDetachAttach) {
                      onDetachAttach(scene, kind, name);
                      return;
                    }
                    detachFilmSceneAttachName(scene, kind, name);
                  }}
                />
              ) : undefined
            }
            onGenerateImage={() => onCreateFrame?.(scene)}
            onStopGeneration={
              onStopFrame ? () => onStopFrame(scene) : undefined
            }
            generationActionPending={generationActionPending}
            onSetImage={handleSetImage}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        )}
        renderVideoTab={() => (
          <SceneCardVideoTab
            generatedVideo={generatedVideo}
            generatingVideo={generatingVideo}
            videoProgress={videoProgress}
            hasImage={hasImage}
            aspectRatio={ar}
            uniformFrame
            sceneNumber={scene.index}
            errorMessage={scene.videoError}
            onImageRequired={() =>
              toast.info(t("Cần tạo ảnh trước khi tạo video"))
            }
            onGenerateVideo={() => onCreateVideo?.(scene)}
            onStopGeneration={
              onStopVideo ? () => onStopVideo(scene) : undefined
            }
            generationActionPending={videoActionPending}
          />
        )}
        renderExtendTab={() => null}
        renderImagePrompt={
          showImagePolicyAssist ? () => renderImagePolicyAssist() : undefined
        }
      />

      <FilmImageGalleryDialog
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={t("Gallery ảnh cảnh quay")}
        onSelect={(image) => {
          setGalleryOpen(false);
          handleSetImage(image);
        }}
      />
    </div>
  );
}

/** URL preview từ GeneratedImageData (upload) để lưu frameImageUrl */
export function generatedImageDataToFrameUrl(image: GeneratedImageData): string {
  return getGeneratedImagePreviewSrc(image) || image.imageUrl || image.fifeUrl || "";
}
