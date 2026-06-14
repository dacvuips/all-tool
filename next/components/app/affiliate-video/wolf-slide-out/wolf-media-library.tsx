import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiArrowDownSLine,
  RiFolderUploadLine,
  RiImageLine,
  RiLayoutGridLine,
  RiLoader4Line,
  RiMicLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiUploadCloud2Line,
  RiUser3Line,
  RiUserLine,
} from "react-icons/ri";

import { VideoDialog } from "../../../shared/common/video-dialog";
import { useDevice } from "../../../../lib/hooks/useDevice";
import { useToast } from "../../../../lib/providers/toast-provider";
import { ImageDialog } from "../../../shared/utilities/dialog/image-dialog";
import { Popover } from "../../../shared/utilities/popover/popover";
import { DB_NAME, STORE_NAME, uid } from "../constants";
import { useIndexedDB } from "../hook/useIndexedDB";
import { WolfPixelFlower } from "./wolf-pixel-flower";

export type WolfMediaAssetType = "image" | "video";

export type WolfMediaAsset = {
  id: string;
  projectId: string;
  name: string;
  type: WolfMediaAssetType;
  mimeType: string;
  dataBase64: string;
  createdAt: number;
};

type MediaFilter = "all" | "image" | "video" | "voice" | "character" | "avatar" | "uploaded";

const PREVIEW_ASPECT_PADDING = "56.25%";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
const ACCEPTED_EXTENSIONS =
  ".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mkv,image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([byteNumbers], { type: mimeType }));
}

function getAssetPreviewSrc(asset: WolfMediaAsset): string {
  if (asset.type === "image") {
    return `data:${asset.mimeType};base64,${asset.dataBase64}`;
  }
  return base64ToBlobUrl(asset.dataBase64, asset.mimeType);
}

function detectMediaType(file: File): WolfMediaAssetType | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name)) {
    return "image";
  }
  if (ACCEPTED_VIDEO_TYPES.includes(file.type) || /\.(mp4|webm|mov|mkv)$/i.test(file.name)) {
    return "video";
  }
  return null;
}

function AssetListThumb({
  asset,
  className = "w-full h-full",
}: {
  asset: WolfMediaAsset;
  className?: string;
}) {
  const src = useMemo(() => getAssetPreviewSrc(asset), [asset.id, asset.dataBase64, asset.type]);

  useEffect(() => {
    return () => {
      if (asset.type === "video" && src.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
  }, [asset.type, src]);

  if (asset.type === "image") {
    return <img src={src} alt={asset.name} className={`object-cover ${className}`} />;
  }

  return (
    <div className={`relative ${className}`}>
      <video
        src={src}
        className="object-cover w-full h-full"
        muted
        playsInline
        preload="metadata"
      />
      <RiPlayCircleLine className="absolute inset-0 m-auto text-xl drop-shadow text-white/80" />
    </div>
  );
}

type WolfMediaLibraryProps = {
  reference: MutableRefObject<HTMLElement | null>;
  visible: boolean;
  projectId?: string | null;
  projectName?: string;
  onClose: () => void;
  onAddToCommand?: (asset: WolfMediaAsset) => void;
};

export function WolfMediaLibrary({
  reference,
  visible,
  projectId,
  projectName,
  onClose,
  onAddToCommand,
}: WolfMediaLibraryProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isMobile } = useDevice();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBlobRef = useRef<string | null>(null);
  const previewSurvivesCloseRef = useRef(false);

  const [assets, setAssets] = useState<WolfMediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  const assetDB = useIndexedDB<WolfMediaAsset>(STORE_NAME.wolfAssets, DB_NAME.wolf);
  const scopedProjectId = projectId || "default";

  const filterItems: { id: MediaFilter; label: string; icon: JSX.Element }[] = [
    { id: "all", label: t("Tất cả"), icon: <RiLayoutGridLine className="text-base" /> },
    { id: "image", label: t("Hình ảnh"), icon: <RiImageLine className="text-base" /> },
    { id: "video", label: t("Video"), icon: <RiPlayCircleLine className="text-base" /> },
    { id: "voice", label: t("Giọng nói"), icon: <RiMicLine className="text-base" /> },
    { id: "character", label: t("Nhân vật"), icon: <RiUserLine className="text-base" /> },
    { id: "avatar", label: t("Hình đại diện"), icon: <RiUser3Line className="text-base" /> },
    { id: "uploaded", label: t("Tệp tải lên"), icon: <RiFolderUploadLine className="text-base" /> },
  ];

  const activeFilterLabel = filterItems.find((item) => item.id === filter)?.label ?? t("Tất cả");

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    try {
      const records = await assetDB.getAll();
      const scoped = records
        .filter((item) => item.projectId === scopedProjectId)
        .sort((a, b) => b.createdAt - a.createdAt);
      setAssets(scoped);
      setSelectedId((prev) => {
        if (prev && scoped.some((item) => item.id === prev)) return prev;
        return scoped[0]?.id ?? null;
      });
    } finally {
      setIsLoading(false);
    }
  }, [assetDB, scopedProjectId]);

  useEffect(() => {
    if (!visible) return;
    void loadAssets();
  }, [visible, loadAssets]);

  const filteredAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return assets.filter((asset) => {
      if (filter === "image" && asset.type !== "image") return false;
      if (filter === "video" && asset.type !== "video") return false;
      if (filter === "uploaded") return true;
      if (filter === "voice" || filter === "character" || filter === "avatar") return false;
      if (!query) return true;
      return asset.name.toLowerCase().includes(query);
    });
  }, [assets, filter, searchQuery]);

  useEffect(() => {
    if (filteredAssets.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!isMobile && (!selectedId || !filteredAssets.some((item) => item.id === selectedId))) {
      setSelectedId(filteredAssets[0].id);
    }
  }, [filteredAssets, selectedId, isMobile]);

  const selectedAsset = useMemo(
    () => filteredAssets.find((item) => item.id === selectedId) ?? null,
    [filteredAssets, selectedId]
  );

  const previewSrc = useMemo(() => {
    if (previewBlobRef.current) {
      URL.revokeObjectURL(previewBlobRef.current);
      previewBlobRef.current = null;
    }
    if (!selectedAsset) return null;
    const src = getAssetPreviewSrc(selectedAsset);
    if (selectedAsset.type === "video" && src.startsWith("blob:")) {
      previewBlobRef.current = src;
    }
    return src;
  }, [selectedAsset]);

  useEffect(() => {
    return () => {
      if (previewBlobRef.current) {
        URL.revokeObjectURL(previewBlobRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setShowFilterMenu(false);
      if (!previewSurvivesCloseRef.current) {
        setShowVideoModal(false);
        setShowImageModal(false);
      }
      previewSurvivesCloseRef.current = false;
    }
  }, [visible]);

  const openImagePreview = () => {
    previewSurvivesCloseRef.current = true;
    setShowImageModal(true);
    onClose();
  };

  const openVideoPreview = () => {
    previewSurvivesCloseRef.current = true;
    setShowVideoModal(true);
    onClose();
  };

  const handleSelectAsset = (asset: WolfMediaAsset) => {
    if (isMobile) {
      onAddToCommand?.(asset);
      onClose();
      return;
    }
    setSelectedId(asset.id);
  };

  const processFile = async (file: File) => {
    const type = detectMediaType(file);
    if (!type) {
      toast.error(t("Chỉ hỗ trợ file ảnh hoặc video"));
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    const maxSize = type === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
    if (sizeMB > maxSize) {
      toast.error(
        `${t("File quá lớn")}. ${t("Tối đa")}: ${maxSize}MB, ${t("file")}: ${sizeMB.toFixed(1)}MB`
      );
      return;
    }

    try {
      setIsUploading(true);
      const dataBase64 = await fileToBase64(file);
      const asset: WolfMediaAsset = {
        id: uid(),
        projectId: scopedProjectId,
        name: file.name,
        type,
        mimeType: file.type || (type === "image" ? "image/png" : "video/mp4"),
        dataBase64,
        createdAt: Date.now(),
      };
      await assetDB.set(asset.id, asset);
      await loadAssets();
      setSelectedId(asset.id);
      setFilter("all");
      setSearchQuery("");
      toast.success(t("Đã tải lên thành công"));
    } catch (err) {
      console.error("[WolfMediaLibrary] upload error", err);
      toast.error(t("Lỗi khi xử lý file. Vui lòng thử lại."));
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      void Promise.all(Array.from(files).map((file) => processFile(file)));
    }
    e.target.value = "";
  };

  const handleAddToCommand = () => {
    if (!selectedAsset) return;
    onAddToCommand?.(selectedAsset);
    onClose();
  };

  const renderAssetList = (variant: "desktop" | "mobile") => (
    <div className={`overflow-y-auto flex-1 v-scrollbar ${variant === "mobile" ? "p-2" : "p-2"}`}>
      {isLoading ? (
        <div className="flex justify-center items-center h-full text-neutral-500">
          <RiLoader4Line className="text-lg animate-spin" />
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="flex flex-col justify-center items-center px-2 h-full text-center">
          <WolfPixelFlower className="mb-2 w-8 h-8 text-neutral-600" />
          <p className="text-xs text-neutral-500">{t("Không tìm thấy kết quả nào")}</p>
        </div>
      ) : variant === "mobile" ? (
        <div className="space-y-2">
          {filteredAssets.map((asset) => {
            const bgSrc =
              asset.type === "image"
                ? `data:${asset.mimeType};base64,${asset.dataBase64}`
                : undefined;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleSelectAsset(asset)}
                className="overflow-hidden relative w-full text-left rounded-2xl"
              >
                {bgSrc ? (
                  <div
                    className="absolute inset-0 bg-center bg-cover opacity-30 blur-2xl scale-110"
                    style={{ backgroundImage: `url(${bgSrc})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-neutral-800" />
                )}
                <div className="flex relative gap-3 items-center px-3 py-3 bg-black/50">
                  <div className="overflow-hidden flex-shrink-0 w-16 h-16 rounded-xl bg-neutral-800">
                    <AssetListThumb asset={asset} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-neutral-100">{asset.name}</p>
                    <p className="text-xs text-neutral-400">
                      {asset.type === "image" ? t("Hình ảnh") : t("Video")}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {filteredAssets.map((asset) => {
            const isSelected = asset.id === selectedId;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleSelectAsset(asset)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
                  isSelected ? "bg-neutral-700" : "hover:bg-neutral-800/70"
                }`}
              >
                <div className="overflow-hidden flex-shrink-0 w-14 h-14 rounded-lg bg-neutral-800">
                  <AssetListThumb asset={asset} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs truncate text-neutral-200">{asset.name}</p>
                  <p className="text-[11px] text-neutral-500">
                    {asset.type === "image" ? t("Hình ảnh") : t("Video")}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <Popover
        key={visible ? "wolf-media-open" : "wolf-media-closed"}
        reference={reference as MutableRefObject<HTMLElement>}
        trigger="click"
        placement="top-start"
        arrow={false}
        maxWidth={isMobile ? "100vw" : 720}
        visible={visible}
        hideOnClickOutside={!showFilterMenu}
        zIndex={120}
        theme="light"
        onHidden={onClose}
        onClickOutside={() => {
          if (showFilterMenu) {
            setShowFilterMenu(false);
            return;
          }
          onClose();
        }}
      >
        <div
          className={`relative overflow-hidden bg-[#1a1a1a] text-neutral-100 ${
            isMobile ? "w-[calc(100vw-1.25rem)]" : "w-[min(680px,calc(100vw-2rem))]"
          }`}
        >
          {isMobile ? (
            <div className="flex h-[500px] flex-col">
              {/* Mobile toolbar */}
              <div className="flex items-center gap-2 px-2 py-2.5">
                <div className="relative flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu((prev) => !prev)}
                    className="flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#262626] px-2.5 py-2 text-xs text-neutral-200"
                  >
                    <RiLayoutGridLine className="text-sm" />
                    <span>{activeFilterLabel}</span>
                    <RiArrowDownSLine className="text-sm opacity-70" />
                  </button>

                  {showFilterMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-[40]"
                        onClick={() => setShowFilterMenu(false)}
                      />
                      <div className="absolute left-0 top-full z-[50] mt-1.5 w-52 overflow-hidden rounded-2xl border border-neutral-700 bg-[#262626] py-1.5 shadow-xl">
                        {filterItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setFilter(item.id);
                              setShowFilterMenu(false);
                            }}
                            className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors ${
                              filter === item.id
                                ? "bg-neutral-600 text-white"
                                : "text-neutral-300 hover:bg-neutral-700"
                            }`}
                          >
                            {item.icon}
                            <span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex relative flex-1 items-center min-w-0">
                  <RiSearchLine className="absolute left-3 pointer-events-none text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("Tìm kiếm thành phần")}
                    className="w-full rounded-xl border border-neutral-700 bg-[#262626] py-2 pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
                  />
                </div>

                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-[#262626] text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
                >
                  {isUploading ? (
                    <RiLoader4Line className="text-lg animate-spin" />
                  ) : (
                    <RiUploadCloud2Line className="text-lg" />
                  )}
                </button>
              </div>

              {/* Mobile list */}
              <div className="flex flex-col flex-1 min-h-0">{renderAssetList("mobile")}</div>
            </div>
          ) : (
            <>
              {/* Desktop header */}
              <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2.5">
                <button
                  type="button"
                  className="flex max-w-[88px] flex-shrink-0 items-center gap-0.5 truncate rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
                >
                  <span className="truncate">{projectName || t("Dự án")}</span>
                  <RiArrowDownSLine className="flex-shrink-0 text-sm" />
                </button>

                <div className="flex relative flex-1 items-center min-w-0">
                  <RiSearchLine className="absolute left-3 pointer-events-none text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("Tìm kiếm thành phần")}
                    className="w-full rounded-xl border border-neutral-700 bg-[#262626] py-2 pl-9 pr-3 text-sm text-neutral-100 outline-none placeholder:text-neutral-500 focus:border-neutral-600"
                  />
                </div>

                <button
                  type="button"
                  className="flex flex-shrink-0 items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
                >
                  {t("Gần đây")}
                  <RiArrowDownSLine className="text-sm" />
                </button>
              </div>

              {/* Desktop 3-column body */}
              <div className="flex h-[min(400px,58vh)]">
                <aside className="flex w-[148px] flex-shrink-0 flex-col border-r border-neutral-800 bg-[#161616] py-2">
                  <div className="flex-1 space-y-0.5 overflow-y-auto px-2 v-scrollbar">
                    {filterItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFilter(item.id)}
                        className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition-colors ${
                          filter === item.id
                            ? "bg-neutral-600/80 text-neutral-100"
                            : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
                        }`}
                      >
                        {item.icon}
                        <span className="leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="px-2 pt-2 mt-1">
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs leading-tight text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <RiLoader4Line className="flex-shrink-0 text-base animate-spin" />
                      ) : (
                        <RiUploadCloud2Line className="flex-shrink-0 text-base" />
                      )}
                      <span>{t("Tải nội dung nghe nhìn lên")}</span>
                    </button>
                  </div>
                </aside>

                <div className="flex w-[196px] flex-shrink-0 flex-col border-r border-neutral-800 bg-[#1a1a1a]">
                  {renderAssetList("desktop")}
                </div>

                <div className="flex min-w-0 flex-1 flex-col bg-[#121212] p-3">
                  {selectedAsset && previewSrc ? (
                    <>
                      <div className="flex flex-1 justify-center items-center min-h-0">
                        <div className="w-full max-w-[220px]">
                          <div
                            className="overflow-hidden relative w-full bg-black rounded-2xl"
                            style={{ paddingTop: PREVIEW_ASPECT_PADDING }}
                          >
                            {selectedAsset.type === "image" ? (
                              <img
                                src={previewSrc}
                                alt={selectedAsset.name}
                                className="object-cover absolute inset-0 w-full h-full cursor-pointer"
                                onClick={openImagePreview}
                              />
                            ) : (
                              <>
                                <video
                                  src={previewSrc}
                                  className="object-cover absolute inset-0 w-full h-full cursor-pointer"
                                  muted
                                  loop
                                  playsInline
                                  preload="metadata"
                                  onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                                  onMouseLeave={(e) => {
                                    const v = e.target as HTMLVideoElement;
                                    v.pause();
                                    v.currentTime = 0;
                                  }}
                                  onClick={openVideoPreview}
                                />
                                <div className="flex absolute inset-0 justify-center items-center pointer-events-none bg-black/20">
                                  <RiPlayCircleLine className="text-3xl text-white/90" />
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddToCommand}
                        className="mt-3 w-full flex-shrink-0 rounded-xl bg-white py-2.5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
                      >
                        {t("Thêm vào câu lệnh")}
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-1 justify-center items-center" />
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </Popover>

      {previewSrc && selectedAsset?.type === "image" && (
        <ImageDialog
          isOpen={showImageModal}
          image={previewSrc}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {previewSrc && selectedAsset?.type === "video" && (
        <VideoDialog
          videoUrl={previewSrc}
          isOpen={showVideoModal}
          onClose={() => setShowVideoModal(false)}
          aspectRatio="16:9"
        />
      )}
    </>
  );
}
