/**
 * Card ảnh bối cảnh — giống Nhân vật: clone, tập, vật phẩm set dressing, gen + ref.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiTrash } from "react-icons/hi";
import { HiDocumentDuplicate } from "react-icons/hi2";
import { useToast } from "../../lib/providers/toast-provider";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { SceneCardImageTab } from "../app/affiliate-video/shared/scene-card-image-tab";
import { filmEntityToGeneratedImage } from "./film-entity-to-generated-image";
import FilmImageGalleryDialog from "./film-image-gallery-dialog";
import FilmLinkedPropsBlock from "./film-linked-props-block";
import type { FilmCatalogKind } from "./film-catalog-pick-dialog";
import type { FilmLocationImageGenerateInput } from "./film-location-image-dialog";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import {
  FilmAspectRatio,
  FilmEpisodeRecord,
  FilmPropRecord,
  FilmSceneImageRecord,
} from "./film-types";

type Props = {
  item: FilmSceneImageRecord;
  linkedProps?: FilmPropRecord[];
  episodes?: FilmEpisodeRecord[];
  aspectRatio?: FilmAspectRatio;
  suggestingProps?: boolean;
  onEdit?: (item: FilmSceneImageRecord) => void;
  onDelete?: (item: FilmSceneImageRecord) => void;
  onClone?: (item: FilmSceneImageRecord) => void;
  onCreate?: (item: FilmSceneImageRecord) => void;
  onStopGeneration?: () => void;
  generationActionPending?: boolean;
  onSetImage?: (item: FilmSceneImageRecord, image: GeneratedImageData) => void;
  onSuggestProps?: (item: FilmSceneImageRecord) => void | Promise<void>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onCreateLocationWithPropRefs?: (input: FilmLocationImageGenerateInput) => Promise<void>;
  onAddLinkedProp?: (input: {
    item: FilmSceneImageRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  onOpenCatalog?: (item: FilmSceneImageRecord) => void;
  onMoveLinkedProp?: (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => void;
  onUnlinkLinkedProp?: (prop: FilmPropRecord) => void;
  onToggleEpisode?: (item: FilmSceneImageRecord, episodeId: string) => void;
};

export default function FilmSceneImageCard({
  item,
  linkedProps = [],
  episodes = [],
  aspectRatio = "16:9",
  suggestingProps = false,
  onEdit,
  onDelete,
  onClone,
  onCreate,
  onStopGeneration,
  generationActionPending = false,
  onSetImage,
  onSuggestProps,
  onCreatePropImage,
  onCreateLocationWithPropRefs,
  onAddLinkedProp,
  onOpenCatalog,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onToggleEpisode,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const ar: "16:9" | "9:16" = aspectRatio === "9:16" ? "9:16" : "16:9";
  const creating = item.status === "creating";
  const progress =
    typeof item.mediaJobProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(item.mediaJobProgress)))
      : creating
      ? 5
      : 0;
  const context = (item.context || "").trim();
  const timeOfDay = (item.timeOfDay || "").trim();
  const subtitle = [timeOfDay, context].filter(Boolean).join(" · ") || t("Ngày");
  const generatedImage = filmEntityToGeneratedImage(item);
  const busy = creating || suggestingProps;

  const companions = useMemo(() => linkedProps, [linkedProps]);

  const applyImage = (image: GeneratedImageData) => {
    if (onSetImage) {
      onSetImage(item, image);
      return;
    }
    toast.info(t("Gán ảnh bối cảnh chưa được hỗ trợ."));
  };

  return (
    <div
      id={`film-entity-card-${item.id}`}
      className="flex overflow-hidden relative flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm group transition-all hover:border-primary"
    >
      <div className="flex relative gap-2 items-center px-3 py-2 min-w-0 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-sm font-bold text-gray-900 truncate">{item.name}</h4>
          <p className="m-0 mt-0.5 text-xs text-gray-400 truncate">{subtitle}</p>
        </div>
        <div className="flex absolute top-0 right-1 z-10 gap-1 items-center opacity-0 transition duration-200 ease-out transform translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
          {onClone ? (
            <button
              type="button"
              title={t("Clone bối cảnh")}
              onClick={(e) => {
                e.stopPropagation();
                onClone(item);
              }}
              disabled={busy}
              className="flex justify-center items-center w-7 h-7 text-gray-500 bg-white bg-opacity-95 rounded-lg border border-gray-100 shadow-sm cursor-pointer hover:text-blue-600 hover:border-blue-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <HiDocumentDuplicate className="text-sm" />
            </button>
          ) : null}
          <button
            type="button"
            title={t("Sửa")}
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(item);
            }}
            className="flex justify-center items-center w-7 h-7 text-gray-500 bg-white bg-opacity-95 rounded-lg border border-gray-100 shadow-sm cursor-pointer hover:text-blue-600 hover:border-blue-200"
          >
            <HiPencil className="text-sm" />
          </button>
          {onDelete ? (
            <button
              type="button"
              title={t("Xóa")}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item);
              }}
              disabled={busy}
              className="flex justify-center items-center w-7 h-7 text-gray-500 bg-white bg-opacity-95 rounded-lg border border-gray-100 shadow-sm cursor-pointer hover:text-red-600 hover:border-red-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <HiTrash className="text-sm" />
            </button>
          ) : null}
        </div>
      </div>

      {episodes.length > 0 ? (
        <div className="px-3 py-1.5 border-b border-gray-50 flex flex-wrap gap-1 items-center">
          <span className="text-10 font-semibold text-gray-400 uppercase tracking-wide mr-0.5">
            {t("Tập hiển thị")}
          </span>
          {episodes.map((ep) => {
            const on = (item.episodeIds || []).includes(ep.id);
            const label =
              episodes.length > 4 ? String(ep.index) : ep.title || t("Tập {{n}}", { n: ep.index });
            return (
              <button
                key={ep.id}
                type="button"
                disabled={busy || !onToggleEpisode}
                title={ep.title || t("Tập {{n}}", { n: ep.index })}
                onClick={() => onToggleEpisode?.(item, ep.id)}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-10 font-semibold border cursor-pointer disabled:opacity-40 ${
                  on
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-white text-gray-400 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            );
          })}
          {!(item.episodeIds && item.episodeIds.length) ? (
            <span className="font-medium text-amber-600 text-10">
              {t("Chưa gán tập — không hiện trong gắn Cảnh")}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col flex-1 gap-2 p-2 min-h-0 sm:p-3">
        <div className="flex-shrink-0">
          <SceneCardImageTab
            aspectRatio={ar}
            uniformFrame
            generatedImage={generatedImage}
            generatingImage={creating}
            imageProgress={progress}
            sceneNumber={(item.sortOrder ?? 0) + 1}
            errorMessage={item.mediaError}
            onGenerateImage={() => onCreate?.(item)}
            onStopGeneration={onStopGeneration}
            generationActionPending={generationActionPending}
            onSetImage={applyImage}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        </div>

        <FilmLinkedPropsBlock
          linkedProps={companions}
          suggesting={suggestingProps}
          parentBusy={creating}
          suggestLabel={t("Gợi ý vật phẩm bối cảnh")}
          regenWithRefsLabel={t("Gen lại bối cảnh + ref VP")}
          emptyHint={t("Chưa có set dressing — gợi ý AI hoặc thêm thủ công.")}
          onSuggest={onSuggestProps ? () => onSuggestProps(item) : undefined}
          onCreatePropImage={onCreatePropImage}
          onAddLinkedProp={
            onAddLinkedProp
              ? async ({ name, description }) => {
                  await onAddLinkedProp({ item, name, description });
                }
              : undefined
          }
          onOpenCatalog={onOpenCatalog ? () => onOpenCatalog(item) : undefined}
          ownerKind="location"
          ownerId={item.id}
          onMoveLinkedProp={onMoveLinkedProp}
          onUnlinkLinkedProp={onUnlinkLinkedProp}
          onRegenWithPropRefs={
            onCreateLocationWithPropRefs
              ? async ({ propIds, propNamesInPrompt }) => {
                  await onCreateLocationWithPropRefs({
                    item,
                    prompt: "",
                    propIds,
                    propNamesInPrompt,
                  });
                }
              : undefined
          }
        />
      </div>

      <FilmImageGalleryDialog
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        title={t("Gallery ảnh bối cảnh")}
        onSelect={(image) => {
          setGalleryOpen(false);
          applyImage(image);
        }}
      />
    </div>
  );
}
