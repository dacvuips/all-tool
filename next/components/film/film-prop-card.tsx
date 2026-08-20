/**
 * Card hình ảnh vật phẩm — giống Nhân vật: clone, tập, vật phẩm kèm, gen + ref.
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiTrash } from "react-icons/hi";
import { HiDocumentDuplicate } from "react-icons/hi2";
import { useToast } from "../../lib/providers/toast-provider";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { SceneCardImageTab } from "../app/affiliate-video/shared/scene-card-image-tab";
import { FILM_CHARACTER_PROP_ASPECT_RATIO } from "./film-aspect";
import { filmEntityToGeneratedImage } from "./film-entity-to-generated-image";
import FilmImageGalleryDialog from "./film-image-gallery-dialog";
import FilmLinkedPropsBlock from "./film-linked-props-block";
import type { FilmCatalogKind } from "./film-catalog-pick-dialog";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import { FilmEpisodeRecord, FilmPropRecord, filmPropCategoryLabel } from "./film-types";

type Props = {
  prop: FilmPropRecord;
  linkedProps?: FilmPropRecord[];
  episodes?: FilmEpisodeRecord[];
  suggestingProps?: boolean;
  onEdit?: (p: FilmPropRecord) => void;
  onDelete?: (p: FilmPropRecord) => void;
  onClone?: (p: FilmPropRecord) => void;
  onCreate?: (p: FilmPropRecord) => void;
  onStopGeneration?: () => void;
  generationActionPending?: boolean;
  onSetImage?: (p: FilmPropRecord, image: GeneratedImageData) => void;
  onSuggestProps?: (p: FilmPropRecord) => void | Promise<void>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onCreatePropWithCompanionRefs?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onAddLinkedProp?: (input: {
    prop: FilmPropRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  onOpenCatalog?: (prop: FilmPropRecord) => void;
  onMoveLinkedProp?: (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => void;
  onUnlinkLinkedProp?: (prop: FilmPropRecord) => void;
  onToggleEpisode?: (p: FilmPropRecord, episodeId: string) => void;
};

export default function FilmPropCard({
  prop,
  linkedProps = [],
  episodes = [],
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
  onCreatePropWithCompanionRefs,
  onAddLinkedProp,
  onOpenCatalog,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onToggleEpisode,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const ar = FILM_CHARACTER_PROP_ASPECT_RATIO;
  const categoryLabel = filmPropCategoryLabel(prop.category);
  const creating = prop.status === "creating";
  const progress =
    typeof prop.mediaJobProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(prop.mediaJobProgress)))
      : creating
      ? 5
      : 0;
  const generatedImage = filmEntityToGeneratedImage(prop);
  const busy = creating || suggestingProps;

  /** Không liệt kê chính prop này trong list kèm */
  const companions = useMemo(
    () => linkedProps.filter((p) => p.id !== prop.id),
    [linkedProps, prop.id]
  );

  const applyImage = (image: GeneratedImageData) => {
    if (onSetImage) {
      onSetImage(prop, image);
      return;
    }
    toast.info(t("Gán ảnh vật phẩm chưa được hỗ trợ."));
  };

  return (
    <div
      id={`film-entity-card-${prop.id}`}
      className="flex overflow-hidden relative flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm group transition-all hover:border-primary"
    >
      <div className="flex relative gap-2 items-center px-3 py-2 min-w-0 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-sm font-bold text-gray-900 truncate">{prop.name}</h4>
          {categoryLabel ? (
            <p className="m-0 mt-0.5 text-10 text-gray-400 truncate">{categoryLabel}</p>
          ) : null}
        </div>
        <div className="flex absolute top-0 right-1 z-10 gap-1 items-center opacity-0 transition duration-200 ease-out transform translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
          {onClone ? (
            <button
              type="button"
              title={t("Clone vật phẩm")}
              onClick={(e) => {
                e.stopPropagation();
                onClone(prop);
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
              onEdit?.(prop);
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
                onDelete(prop);
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
            const on = (prop.episodeIds || []).includes(ep.id);
            const label =
              episodes.length > 4 ? String(ep.index) : ep.title || t("Tập {{n}}", { n: ep.index });
            return (
              <button
                key={ep.id}
                type="button"
                disabled={busy || !onToggleEpisode}
                title={ep.title || t("Tập {{n}}", { n: ep.index })}
                onClick={() => onToggleEpisode?.(prop, ep.id)}
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
          {!(prop.episodeIds && prop.episodeIds.length) ? (
            <span className="font-medium text-amber-600 text-10">
              {t("Chưa gán tập — không hiện trong gắn VP")}
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
            sceneNumber={(prop.sortOrder ?? 0) + 1}
            errorMessage={prop.mediaError}
            onGenerateImage={() => onCreate?.(prop)}
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
          suggestLabel={t("Gợi ý vật phẩm kèm")}
          regenWithRefsLabel={t("Gen lại ảnh VP + ref kèm")}
          emptyHint={t("Chưa có vật phẩm kèm — gợi ý AI hoặc thêm thủ công.")}
          onSuggest={onSuggestProps ? () => onSuggestProps(prop) : undefined}
          onCreatePropImage={onCreatePropImage}
          onAddLinkedProp={
            onAddLinkedProp
              ? async ({ name, description }) => {
                  await onAddLinkedProp({ prop, name, description });
                }
              : undefined
          }
          onOpenCatalog={onOpenCatalog ? () => onOpenCatalog(prop) : undefined}
          ownerKind="prop"
          ownerId={prop.id}
          onMoveLinkedProp={onMoveLinkedProp}
          onUnlinkLinkedProp={onUnlinkLinkedProp}
          onRegenWithPropRefs={
            onCreatePropWithCompanionRefs
              ? async ({ propIds, propNamesInPrompt }) => {
                  await onCreatePropWithCompanionRefs({
                    prop,
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
        title={t("Gallery ảnh vật phẩm")}
        onSelect={(image) => {
          setGalleryOpen(false);
          applyImage(image);
        }}
      />
    </div>
  );
}
