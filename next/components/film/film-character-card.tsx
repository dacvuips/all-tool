/**
 * Card hình ảnh nhân vật + list vật phẩm kèm.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPencil, HiTrash } from "react-icons/hi";
import { HiDocumentDuplicate } from "react-icons/hi2";
import { useToast } from "../../lib/providers/toast-provider";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { SceneCardImageTab } from "../app/affiliate-video/shared/scene-card-image-tab";
import {
  readFilmLinkedPropDnd,
  type FilmCatalogKind,
} from "./film-catalog-pick-dialog";
import { FILM_CHARACTER_PROP_ASPECT_RATIO } from "./film-aspect";
import type { FilmCharacterImageGenerateInput } from "./film-character-image-dialog";
import { filmEntityToGeneratedImage } from "./film-entity-to-generated-image";
import FilmImageGalleryDialog from "./film-image-gallery-dialog";
import FilmLinkedPropsBlock from "./film-linked-props-block";
import type { FilmPropImageGenerateInput } from "./film-prop-image-dialog";
import {
  FilmCharacterRecord,
  FilmEpisodeRecord,
  FilmPropRecord,
  filmCharacterRoleLabel,
} from "./film-types";

/** Tối đa ảnh reference gửi khi gen ảnh NV */
export const FILM_CHARACTER_PROP_REF_LIMIT = 10;

type Props = {
  character: FilmCharacterRecord;
  linkedProps?: FilmPropRecord[];
  episodes?: FilmEpisodeRecord[];
  aspectRatio?: "16:9" | "9:16";
  suggestingProps?: boolean;
  onEdit?: (c: FilmCharacterRecord) => void;
  onDelete?: (c: FilmCharacterRecord) => void;
  onClone?: (c: FilmCharacterRecord) => void;
  onCreate?: (c: FilmCharacterRecord) => void;
  onStopGeneration?: () => void;
  generationActionPending?: boolean;
  onSetImage?: (c: FilmCharacterRecord, image: GeneratedImageData) => void;
  onSuggestProps?: (c: FilmCharacterRecord) => void | Promise<void>;
  onCreatePropImage?: (input: FilmPropImageGenerateInput) => Promise<void>;
  onCreateCharacterWithPropRefs?: (input: FilmCharacterImageGenerateInput) => Promise<void>;
  /** Thêm vật phẩm thủ công (tên + mô tả) và gắn vào nhân vật */
  onAddCharacterProp?: (input: {
    character: FilmCharacterRecord;
    name: string;
    description: string;
  }) => Promise<void>;
  onOpenCatalog?: (character: FilmCharacterRecord) => void;
  onMoveLinkedProp?: (input: {
    fromKind: FilmCatalogKind;
    fromId: string;
    toKind: FilmCatalogKind;
    toId: string;
    propName: string;
  }) => void;
  onUnlinkLinkedProp?: (prop: FilmPropRecord) => void;
  /** Bật/tắt gắn thẻ tập phim */
  onToggleEpisode?: (c: FilmCharacterRecord, episodeId: string) => void;
};

export default function FilmCharacterCard({
  character,
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
  onCreateCharacterWithPropRefs,
  onAddCharacterProp,
  onOpenCatalog,
  onMoveLinkedProp,
  onUnlinkLinkedProp,
  onToggleEpisode,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const ar = FILM_CHARACTER_PROP_ASPECT_RATIO;
  const roleLabel = filmCharacterRoleLabel(character.role);
  const creating = character.status === "creating";
  const progress =
    typeof character.mediaJobProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(character.mediaJobProgress)))
      : creating
      ? 5
      : 0;
  const generatedImage = filmEntityToGeneratedImage(character);
  const busy = creating || suggestingProps;

  const applyImage = (image: GeneratedImageData) => {
    if (onSetImage) {
      onSetImage(character, image);
      return;
    }
    toast.info(t("Gán ảnh nhân vật chưa được hỗ trợ."));
  };

  return (
    <div
      id={`film-entity-card-${character.id}`}
      className={`flex overflow-hidden relative flex-col h-full min-h-0 bg-white rounded-lg border border-gray-200 shadow-sm group transition-all hover:border-primary ${
        dropActive ? "!border-primary ring-2 ring-primary/30" : ""
      }`}
      onDragOver={
        onMoveLinkedProp
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setDropActive(true);
            }
          : undefined
      }
      onDragLeave={
        onMoveLinkedProp
          ? (e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return;
              setDropActive(false);
            }
          : undefined
      }
      onDrop={
        onMoveLinkedProp
          ? (e) => {
              e.preventDefault();
              setDropActive(false);
              const payload = readFilmLinkedPropDnd(e);
              if (!payload || payload.fromKind !== "character") return;
              if (payload.fromId === character.id) return;
              onMoveLinkedProp({
                ...payload,
                toKind: "character",
                toId: character.id,
              });
            }
          : undefined
      }
    >
      <div className="flex relative gap-2 items-center px-3 py-2 min-w-0 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h4 className="m-0 text-sm font-bold text-gray-900 truncate">{character.name}</h4>
          {roleLabel ? (
            <p className="m-0 mt-0.5 text-10 text-gray-400 truncate">{roleLabel}</p>
          ) : null}
        </div>
        <div className="flex absolute top-0 right-1 z-10 gap-1 items-center opacity-0 transition duration-200 ease-out transform translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
          {onClone ? (
            <button
              type="button"
              title={t("Clone nhân vật")}
              onClick={(e) => {
                e.stopPropagation();
                onClone(character);
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
              onEdit?.(character);
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
                onDelete(character);
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
            const on = (character.episodeIds || []).includes(ep.id);
            const label =
              episodes.length > 4 ? String(ep.index) : ep.title || t("Tập {{n}}", { n: ep.index });
            return (
              <button
                key={ep.id}
                type="button"
                disabled={busy || !onToggleEpisode}
                title={ep.title || t("Tập {{n}}", { n: ep.index })}
                onClick={() => onToggleEpisode?.(character, ep.id)}
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
          {!(character.episodeIds && character.episodeIds.length) ? (
            <span className="font-medium text-amber-600 text-10">
              {t("Chưa gán tập — không hiện trong gắn NV")}
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
            sceneNumber={(character.sortOrder ?? 0) + 1}
            errorMessage={character.mediaError}
            onGenerateImage={() => onCreate?.(character)}
            onStopGeneration={onStopGeneration}
            generationActionPending={generationActionPending}
            onSetImage={applyImage}
            onOpenGallery={() => setGalleryOpen(true)}
          />
        </div>

        <FilmLinkedPropsBlock
          linkedProps={linkedProps}
          suggesting={suggestingProps}
          parentBusy={creating}
          suggestLabel={t("Gợi ý vật phẩm nhân vật")}
          regenWithRefsLabel={t("Gen lại ảnh NV + ref vật phẩm")}
          emptyHint={
            onSuggestProps
              ? t("Chưa có phụ kiện — gợi ý AI hoặc thêm thủ công.")
              : t("Chưa có phụ kiện — bấm Thêm để nhập tên và mô tả.")
          }
          onSuggest={onSuggestProps ? () => onSuggestProps(character) : undefined}
          onCreatePropImage={onCreatePropImage}
          onAddLinkedProp={
            onAddCharacterProp
              ? async ({ name, description }) => {
                  await onAddCharacterProp({ character, name, description });
                }
              : undefined
          }
          onOpenCatalog={onOpenCatalog ? () => onOpenCatalog(character) : undefined}
          ownerKind="character"
          ownerId={character.id}
          onMoveLinkedProp={onMoveLinkedProp}
          onUnlinkLinkedProp={onUnlinkLinkedProp}
          onRegenWithPropRefs={
            onCreateCharacterWithPropRefs
              ? async ({ propIds, propNamesInPrompt }) => {
                  await onCreateCharacterWithPropRefs({
                    character,
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
        title={t("Gallery ảnh nhân vật")}
        onSelect={(image) => {
          setGalleryOpen(false);
          applyImage(image);
        }}
      />
    </div>
  );
}
