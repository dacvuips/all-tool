/**
 * Dialog tạo ảnh Prop — prompt instruction product shot.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineX } from "react-icons/hi";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Button } from "../shared/utilities/form";
import { buildFilmPropImagePrompt } from "./film-prop-image-prompt";
import { FilmPropRecord, filmPropCategoryLabel } from "./film-types";

export type FilmPropImageGenerateInput = {
  prop: FilmPropRecord;
  prompt: string;
  /** Ảnh tham chiếu (vật phẩm kèm) */
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  propNamesInPrompt?: string[];
  propIds?: string[];
};

type Props = {
  isOpen: boolean;
  prop: FilmPropRecord | null;
  /** Prompt mẫu Setting dự án */
  promptTemplate?: string | null;
  onClose: () => void;
  onGenerate: (input: FilmPropImageGenerateInput) => Promise<void>;
};

export default function FilmPropImageDialog({
  isOpen,
  prop,
  promptTemplate,
  onClose,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !prop) return;
    const next =
      prop.imagePrompt?.trim() || buildFilmPropImagePrompt(prop, promptTemplate);
    setPrompt(next);
    setSubmitting(false);
  }, [isOpen, prop, promptTemplate]);

  if (!prop) return null;

  const alreadyCreated =
    prop.status === "created" || !!prop.imageUrl || (prop.imageUrls?.length || 0) > 0;
  const title = alreadyCreated ? t("Tạo lại ảnh Vật phẩm") : t("Tạo ảnh Vật phẩm");

  const handleGenerate = async () => {
    if (submitting) return;
    const finalPrompt = prompt.trim();
    if (!finalPrompt) return;
    setSubmitting(true);
    try {
      // Parent chỉ enqueue + mark creating — job chạy nền; đóng dialog ngay.
      await onGenerate({ prop, prompt: finalPrompt });
      onClose();
    } catch {
      // parent toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      width={560}
      maxWidth="95vw"
      slideFromBottom="none"
      dialogClass="relative overflow-hidden rounded-2xl bg-white shadow-xl"
      bodyClass="relative bg-white"
      hasCloseIcon={false}
    >
      <Dialog.Body>
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-gray-900 m-0">{title}</h3>
              <p className="text-xs text-gray-500 m-0 mt-1">
                <span className="font-semibold text-gray-700">{prop.name}</span>
                {prop.category ? (
                  <span className="text-gray-400">
                    {" · "}
                    {filmPropCategoryLabel(prop.category)}
                  </span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-50 border-0 bg-transparent cursor-pointer flex-shrink-0"
              aria-label={t("Đóng")}
            >
              <HiOutlineX className="text-lg" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs">
              <div className="text-10 font-semibold text-gray-400 uppercase mb-0.5">
                {t("Physical Characteristics")}
              </div>
              <div className="text-gray-700 line-clamp-3">
                {prop.description?.trim() || t("Chưa có mô tả")}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-700 m-0">
                  {t("Prompt instruction")}
                </label>
                <button
                  type="button"
                  onClick={() => setPrompt(buildFilmPropImagePrompt(prop, promptTemplate))}
                  className="text-10 font-medium text-blue-600 hover:text-blue-700 border-0 bg-transparent cursor-pointer p-0"
                >
                  {t("Reset template")}
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={10}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-xs leading-relaxed text-gray-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 resize-y font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button outline text={t("Hủy")} className="!rounded-xl" onClick={onClose} />
            <Button
              primary
              text={t("Tạo ảnh")}
              className="!rounded-xl !bg-blue-600 hover:!bg-blue-700"
              onClick={handleGenerate}
              isLoading={submitting}
              disabled={!prompt.trim()}
            />
          </div>
        </div>
      </Dialog.Body>
    </Dialog>
  );
}
