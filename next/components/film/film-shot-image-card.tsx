/**
 * Card Ảnh / Video cảnh quay — tái dụng SceneCardTabs + SceneCardImageTab + SceneCardVideoTab (tool).
 */
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiExternalLink, HiSparkles } from "react-icons/hi";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
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
import {
  FREE_GEN_AUDIO_VOICES,
  freeGenAudioVoiceLabel,
} from "../app/voice/free-voice-voices";
import { Button } from "../shared/utilities/form";
import { Popover } from "../shared/utilities/popover/popover";
import { getFilmEntityVideoSrc } from "./api/generate-film-media";
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
import FilmVideoGalleryDialog from "./film-video-gallery-dialog";
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
  /** Upload / chọn gallery → ghi video cảnh */
  onSetSceneVideo?: (scene: FilmSceneRecord, video: GeneratedVideoData) => void;
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
  /** Click tiêu đề → mở modal sửa phân cảnh */
  onEditScene?: (scene: FilmSceneRecord) => void;
  /** Icon cạnh tiêu đề → mở phân cảnh trong Chuỗi phân cảnh */
  onOpenStoryboardScene?: (scene: FilmSceneRecord) => void;
  /** @deprecated Dùng onEditScene / onOpenStoryboardScene */
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
  /** Bật/tắt: nhép miệng theo thoại, không nói tiếng */
  onToggleSilentLipSync?: (scene: FilmSceneRecord) => void;
  /**
   * Chọn giọng Flow2 (miễn phí) — chỉ hiện khi videoRefMode=component.
   * Voice id (vd. achernar) được gửi kèm generate video.
   */
  onVideoVoiceChange?: (scene: FilmSceneRecord, voiceId: string) => void;
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
  const src = getFilmEntityVideoSrc(scene);
  if (!src && !(scene.videoBlob && scene.videoBlob.size > 0)) return null;
  const url = src || (scene.videoUrl || "").trim();
  if (!url && !(scene.videoBlob && scene.videoBlob.size > 0)) return null;
  return {
    videoUri: url || null,
    mimeType: scene.videoBlob?.type || "video/mp4",
    previewUrl: url || undefined,
    mediaBlob: scene.videoBlob,
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
  onSetSceneVideo,
  onCreateVideo,
  onStopVideo,
  videoActionPending = false,
  forcedTab = null,
  hideImageTab = false,
  hideVideoTab = false,
  hideExtendTab = true,
  onEditScene,
  onOpenStoryboardScene,
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
  onToggleSilentLipSync,
  onVideoVoiceChange,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [videoGalleryOpen, setVideoGalleryOpen] = useState(false);
  const videoVoiceBtnRef = useRef<HTMLButtonElement>(null);
  const showComponentVoicePicker =
    videoRefMode === "component" && !!onVideoVoiceChange;
  const selectedVideoVoice = String(scene.videoVoice || "").trim().toLowerCase();
  const selectedVideoVoiceLabel = selectedVideoVoice
    ? freeGenAudioVoiceLabel(selectedVideoVoice).split(" — ")[0] || selectedVideoVoice
    : "";
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
    [scene.videoUrl, scene.videoBlob, aspectRatio]
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

  const handleSetVideo = (videoData: GeneratedVideoData) => {
    if (onSetSceneVideo) {
      onSetSceneVideo(scene, videoData);
      return;
    }
    toast.info(t("Tải lên video chưa được hỗ trợ ở đây."));
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
      <div className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 min-w-0">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-10 font-bold bg-gray-800 text-white flex-shrink-0 mt-0.5">
          {indexLabel}
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
          {onEditScene || onTitleClick ? (
            <button
              type="button"
              className="min-w-0 w-full text-left text-xs font-semibold text-gray-800 truncate border-0 bg-transparent p-0 cursor-pointer hover:text-blue-600 hover:underline"
              title={t("Sửa phân cảnh")}
              onClick={() => (onEditScene || onTitleClick)?.(scene)}
            >
              {sceneTitle}
            </button>
          ) : (
            <span className="text-xs font-semibold text-gray-800 truncate" title={sceneTitle}>
              {sceneTitle}
            </span>
          )}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {!hideImageTab && scene.shotSize ? (
              <span className="inline-flex self-start text-10 font-medium text-gray-600 leading-none truncate max-w-full">
                {scene.shotSize}
              </span>
            ) : null}
            {showComponentVoicePicker ? (
              <>
                <button
                  ref={videoVoiceBtnRef}
                  type="button"
                  disabled={generatingVideo}
                  className={`inline-flex items-center gap-0.5  h-4 max-w-32 px-1.5 rounded text-10 font-medium border-0 cursor-pointer truncate ${
                    selectedVideoVoice
                      ? " text-primary hover:bg-primary-light"
                      : " text-gray-500 hover:bg-gray-100"
                  } ${generatingVideo ? "opacity-60 cursor-not-allowed" : ""}`}
                  title={
                    selectedVideoVoice
                      ? freeGenAudioVoiceLabel(selectedVideoVoice)
                      : t("Chọn giọng miễn phí cho video Thành phần")
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <MdRecordVoiceOver className="text-xs flex-shrink-0 opacity-80" />
                  <span className="truncate min-w-0">
                    {selectedVideoVoiceLabel || t("Chọn giọng")}
                  </span>
                  <HiChevronDown className="text-xs flex-shrink-0 opacity-70" />
                </button>
                <Popover
                  reference={videoVoiceBtnRef}
                  trigger="click"
                  placement="bottom-start"
                  theme="light"
                  arrow={false}
                >
                  <div className="w-56 py-1">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="m-0 text-10 font-semibold text-gray-500 uppercase tracking-wide">
                        {t("Giọng miễn phí")}
                      </p>
                      <p className="m-0 text-10 text-gray-500">
                        {t("Giọng sẽ được thêm trực tiếp vào video sau khi gen.") }
                      </p>
                    </div>
                    <div className="max-h-56 overflow-y-auto py-1">
                      {FREE_GEN_AUDIO_VOICES.map((voice) => {
                        const selected = selectedVideoVoice === voice.id;
                        return (
                          <button
                            key={voice.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 border-0 cursor-pointer transition-colors ${
                              selected
                                ? "bg-emerald-50"
                                : "bg-transparent hover:bg-gray-50"
                            }`}
                            onClick={() => {
                              onVideoVoiceChange?.(scene, voice.id);
                              (videoVoiceBtnRef.current as any)?._tippy?.hide();
                            }}
                          >
                            <span className="block text-xs font-semibold text-gray-800">
                              {voice.name}
                            </span>
                            <span className="block text-10 text-gray-400 truncate">
                              {voice.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Popover>
              </>
            ) : null}
          </div>
        </div>
        {onOpenStoryboardScene ? (
          <button
            type="button"
            className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border-0 bg-transparent text-gray-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
            title={t("Mở trong Chuỗi phân cảnh")}
            aria-label={t("Mở trong Chuỗi phân cảnh")}
            onClick={(e) => {
              e.stopPropagation();
              onOpenStoryboardScene(scene);
            }}
          >
            <HiExternalLink className="text-base" />
          </button>
        ) : null}
        {onToggleSilentLipSync ? (
          <button
            type="button"
            className={`flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md border-0 cursor-pointer ${
              scene.videoSilentLipSync
                ? "text-red-500 bg-red-50 hover:bg-red-100"
                : "text-gray-400 bg-transparent hover:text-red-500 hover:bg-red-50"
            }`}
            title={
              scene.videoSilentLipSync
                ? t("Đang: nhép miệng, không tiếng — bấm để bật tiếng lại")
                : t("Nhép miệng theo thoại, không nói tiếng")
            }
            aria-label={t("Nhép miệng, không tiếng")}
            aria-pressed={!!scene.videoSilentLipSync}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSilentLipSync(scene);
            }}
          >
            {scene.videoSilentLipSync ? (
              <MdVoiceOverOff className="text-base" />
            ) : (
              <MdRecordVoiceOver className="text-base" />
            )}
          </button>
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
            onSetVideo={onSetSceneVideo ? handleSetVideo : undefined}
            onOpenGallery={
              onSetSceneVideo ? () => setVideoGalleryOpen(true) : undefined
            }
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

      <FilmVideoGalleryDialog
        isOpen={videoGalleryOpen}
        onClose={() => setVideoGalleryOpen(false)}
        title={t("Gallery video cảnh quay")}
        onSelect={(video) => {
          setVideoGalleryOpen(false);
          handleSetVideo(video);
        }}
      />
    </div>
  );
}

/** URL preview từ GeneratedImageData (upload) để lưu frameImageUrl */
export function generatedImageDataToFrameUrl(image: GeneratedImageData): string {
  return getGeneratedImagePreviewSrc(image) || image.imageUrl || image.fifeUrl || "";
}
