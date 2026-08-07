import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineX } from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import FilmMediaZoom from "./film-media-zoom";
import {
  FilmCharacterRecord,
  FilmSceneRecord,
  filmCharacterRoleLabel,
} from "./film-types";

export type FilmShotFrameGenerateInput = {
  scene: FilmSceneRecord;
  prompt: string;
  characterIds: string[];
};

type Props = {
  isOpen: boolean;
  scene: FilmSceneRecord | null;
  characters: FilmCharacterRecord[];
  onClose: () => void;
  onGenerate: (input: FilmShotFrameGenerateInput) => Promise<void>;
};

function buildDefaultPrompt(scene: FilmSceneRecord): string {
  const raw =
    scene.imagePrompt?.trim() ||
    scene.visualDescription?.trim() ||
    scene.summary?.trim() ||
    scene.action?.trim() ||
    "";
  if (raw) return raw;
  const shot = scene.shotSize || "wide shot";
  const loc = scene.location || "scene";
  return `${shot}, ${loc}, cinematic lighting, film still`;
}

function defaultSelectedIds(scene: FilmSceneRecord, characters: FilmCharacterRecord[]): string[] {
  const names = new Set(
    (scene.characterNames || []).map((n) => n.trim().toLowerCase()).filter(Boolean)
  );
  if (names.size === 0) {
    return characters.slice(0, 2).map((c) => c.id);
  }
  return characters.filter((c) => names.has(c.name.trim().toLowerCase())).map((c) => c.id);
}

export default function FilmShotFrameDialog({
  isOpen,
  scene,
  characters,
  onClose,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [zoomThumb, setZoomThumb] = useState<string | null>(null);

  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.sortOrder - b.sortOrder),
    [characters]
  );

  useEffect(() => {
    if (!isOpen || !scene) return;
    setPrompt(buildDefaultPrompt(scene));
    setSelectedIds(defaultSelectedIds(scene, sortedCharacters));
    setSubmitting(false);
  }, [isOpen, scene, sortedCharacters]);

  const title = scene && sceneFrameReadyForTitle(scene) ? t("Tạo lại Khung hình") : t("Tạo Khung hình");

  const toggleCharacter = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGenerate = async () => {
    if (!scene || submitting) return;
    const text = prompt.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await onGenerate({
        scene,
        prompt: text,
        characterIds: selectedIds,
      });
      onClose();
    } catch (err) {
      console.error("[FilmShotFrameDialog] generate failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen && !!scene}
      onClose={onClose}
      width={520}
      maxWidth="94vw"
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-xl"
      bodyClass="relative bg-white"
      hasCloseIcon={false}
    >
      <Dialog.Body>
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-start justify-between gap-3 mb-5">
            <h2 className="text-lg font-bold text-gray-900 m-0 leading-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 border-0 bg-transparent cursor-pointer flex-shrink-0"
              aria-label={t("Đóng")}
            >
              <HiOutlineX className="text-xl" />
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                {t("Prompt hình ảnh")}
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder={t("Mô tả khung hình cần tạo...")}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-800 leading-relaxed outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y min-h-24"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                {t("Nhân vật xuất hiện (Tham chiếu ảnh)")}
              </label>
              {sortedCharacters.length === 0 ? (
                <p className="text-sm text-gray-400 m-0 py-2">
                  {t("Chưa có nhân vật. Tạo Hình ảnh Nhân vật trước để tham chiếu.")}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sortedCharacters.map((ch) => {
                    const selected = selectedIds.includes(ch.id);
                    const thumb = ch.imageUrl || ch.imageUrls?.[0];
                    const initial = (ch.name || "?").trim().charAt(0).toUpperCase() || "?";
                    return (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => toggleCharacter(ch.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors cursor-pointer bg-white ${
                          selected
                            ? "border-blue-500 ring-1 ring-blue-200 shadow-sm"
                            : "border-gray-200 hover:border-blue-200 hover:bg-blue-50"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                          {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumb}
                              alt={ch.name}
                              className="w-full h-full object-cover cursor-zoom-in"
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomThumb(thumb);
                              }}
                            />
                          ) : (
                            <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-500 text-white text-sm font-bold">
                              {initial}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-gray-900 truncate">{ch.name}</div>
                          <div className="text-xs text-gray-400 m-0 mt-0.5">
                            {filmCharacterRoleLabel(ch.role)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <Button
            outline
            text={t("Hủy")}
            className="!rounded-xl !px-4"
            onClick={onClose}
            disabled={submitting}
          />
          <Button
            primary
            text={t("Tạo hình ảnh")}
            className="!rounded-xl !px-4 !bg-blue-600 hover:!bg-blue-700"
            onClick={handleGenerate}
            isLoading={submitting}
            disabled={!prompt.trim()}
          />
        </div>
      </Dialog.Body>
      <FilmMediaZoom
        media={zoomThumb ? { src: zoomThumb, type: "image" } : null}
        onClose={() => setZoomThumb(null)}
      />
    </Dialog>
  );
}

function sceneFrameReadyForTitle(scene: FilmSceneRecord): boolean {
  return (
    scene.frameStatus === "ready" ||
    !!scene.frameImageUrl ||
    scene.mediaStatus === "ready"
  );
}
