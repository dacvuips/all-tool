/**
 * Gallery ảnh generated (IndexedDB `generated-images`) — chọn gán vào entity Film.
 * Cùng nguồn với tool Scene Batch ImageGalleryDialog.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiImageFill, RiLoader4Line, RiSearchLine } from "react-icons/ri";
import { Dialog } from "../shared/utilities/dialog/dialog";
import { Input } from "../shared/utilities/form";
import { Img } from "../shared/utilities/misc";
import type { GeneratedImageData } from "../app/affiliate-video/copy-video/hook/useCopyVideoApi";
import { DB_NAME } from "../app/affiliate-video/constants";
import { useIndexedDB } from "../app/affiliate-video/hook/useIndexedDB";
import {
  getGeneratedImagePreviewSrc,
  hasGeneratedImageData,
  toUiGeneratedImage,
} from "../app/affiliate-video/shared/generatedMediaUtils";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageData: GeneratedImageData) => void;
  /** Nhãn phụ (vd. "bối cảnh") */
  title?: string;
};

export default function FilmImageGalleryDialog({
  isOpen,
  onClose,
  onSelect,
  title,
}: Props) {
  const { t } = useTranslation();
  const imageDB = useIndexedDB<GeneratedImageData>("generated-images", DB_NAME.generateImage);
  const [images, setImages] = useState<{ key: string; data: GeneratedImageData }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await imageDB.getAllWithKeys();
      const items = entries
        .filter((e) => hasGeneratedImageData(e.value))
        .map((e) => ({
          key: String(e.key),
          data: toUiGeneratedImage(e.value),
        }))
        .reverse();
      setImages(items);
    } catch (err) {
      console.error("[FilmImageGalleryDialog] load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [imageDB]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      void loadImages();
    }
  }, [isOpen, loadImages]);

  const filteredImages = searchQuery.trim()
    ? images.filter((img) => img.key.toLowerCase().includes(searchQuery.toLowerCase()))
    : images;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title || t("Chọn ảnh từ Gallery")}
      width="90vw"
      maxWidth="800px"
    >
      <div className="p-4">
        <div className="relative mb-4">
          <Input
            prefix={<RiSearchLine />}
            placeholder={t("Tìm theo key...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="py-2 pr-3 w-full text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>

        {loading && (
          <div className="flex justify-center items-center py-16">
            <RiLoader4Line className="text-3xl animate-spin text-primary" />
          </div>
        )}

        {!loading && filteredImages.length === 0 && (
          <div className="flex flex-col justify-center items-center py-16 text-gray-400">
            <RiImageFill className="mb-3 text-5xl" />
            <p className="text-base m-0">{t("Chưa có ảnh nào")}</p>
            <p className="mt-1 text-sm m-0">
              {t("Ảnh AI đã tạo (tool / film) sẽ xuất hiện ở đây")}
            </p>
          </div>
        )}

        {!loading && filteredImages.length > 0 && (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 max-h-[60vh] overflow-y-auto pr-1">
            {filteredImages.map((item) => (
              <div
                key={item.key}
                role="button"
                tabIndex={0}
                className="overflow-hidden relative rounded-xl border-2 border-transparent transition-all cursor-pointer group hover:border-primary hover:shadow-lg"
                onClick={() => onSelect(item.data)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(item.data);
                  }
                }}
              >
                <div className="relative aspect-[9/16] bg-gray-50">
                  <Img
                    showImageOnClick
                    lazyload={false}
                    src={getGeneratedImagePreviewSrc(item.data)}
                    alt={item.key}
                    className="object-cover rounded-md border border-green-300 border-dashed shadow-sm"
                    ratio916
                  />
                  <div className="flex absolute inset-0 justify-center items-center rounded-xl opacity-0 transition-opacity bg-black/30 group-hover:opacity-100 pointer-events-none">
                    <span className="px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-full shadow-lg">
                      {t("Chọn ảnh")}
                    </span>
                  </div>
                </div>
                <div className="px-2 py-1.5 bg-white">
                  <span
                    className="text-[10px] text-gray-500 truncate block max-w-full"
                    title={item.key}
                  >
                    {item.key}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredImages.length > 0 && (
          <div className="mt-3 text-sm text-center text-gray-400">
            {t("Tổng")}: {filteredImages.length} {t("ảnh")}
          </div>
        )}
      </div>
    </Dialog>
  );
}
