import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import {
  RiCloseLine,
  RiFileTextFill,
  RiImageFill,
  RiMusicFill,
  RiSoundModuleLine,
} from "react-icons/ri";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../../lib/providers/global-provider";
import { Button, Field, Form, Select, Switch, Textarea } from "../../../shared/utilities/form";
import { ASPECT_RATIOS, CACHE_KEY, DB_NAME, STORE_NAME } from "../constants";
import { ElementAudioUpload, ElementImagesUpload } from "../elements/sibar/element-images-upload";
import { useIndexedDB } from "../hook/useIndexedDB";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { ArtStylePickerDialog } from "../shared/art-style-picker-dialog";
import {
  AffiliateVideoProvider,
  useAffiliateVideoContext,
} from "../storyboard/providers/affiliate-video-provider";
import {
  AUDIO_IMAGE_RHYTHM_OPTIONS,
  type AudioImageToVideoFormState,
  type SourceTab,
} from "./audio-image-types";
import { AudioImageRightPanel } from "./right-panel/audio-image-right-panel";
import { useAudioImagePipeline } from "./use-audio-image-pipeline";

const DEFAULT_SOURCE_TAB: SourceTab = "audio";

const SOURCE_TABS: {
  value: SourceTab;
  label: string;
  icon: typeof RiMusicFill;
}[] = [
  { value: "audio", label: "Audio", icon: RiMusicFill },
  { value: "image", label: "Image", icon: RiImageFill },
  { value: "text", label: "Text", icon: RiFileTextFill },
];

const DEFAULT_FORM: AudioImageToVideoFormState = {
  sourceTab: DEFAULT_SOURCE_TAB,
  aspectRatio: "9:16",
  language: "Vietnamese",
  artStyle: "",
  artStyleId: "",
  rhythm: AUDIO_IMAGE_RHYTHM_OPTIONS[3].value,
  showDrawingHand: true,
  useAiReferenceImage: true,
  textContent: "",
  imageRefs: [],
  audioRefs: [],
};

function AudioImageToVideoSidebar({
  form,
  onChange,
  onClose,
  onCreate,
  isRunning,
}: {
  form: AudioImageToVideoFormState;
  onChange: (patch: Partial<AudioImageToVideoFormState>) => void;
  onClose?: () => void;
  onCreate: () => void;
  isRunning: boolean;
}) {
  const { t } = useTranslation();
  const { LANGUAGE_OPTIONS } = useOptionsTranslation();
  const sourceTab = form.sourceTab || DEFAULT_SOURCE_TAB;

  return (
    <Form defaultValues={DEFAULT_FORM} className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500">
            <RiSoundModuleLine className="text-base text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-800">{t("Audio/Image to Video")}</span>
            <span className="text-xs text-gray-500">
              {t("Tạo video từ audio kết hợp ảnh hoặc văn bản")}
            </span>
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200 md:hidden"
          >
            <RiCloseLine className="text-lg text-gray-600" />
          </button>
        ) : null}
      </div>

      <div className="v-scrollbar min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="px-4 pt-3 pb-2">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-gray-100 p-1">
            {SOURCE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = sourceTab === tab.value;
              return (
                <div
                  key={tab.value}
                  onClick={() => onChange({ sourceTab: tab.value })}
                  className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border-0 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className={isActive ? "text-pink-500" : "text-gray-400"} />
                  {t(tab.label)}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 px-4 pb-4">
          <div id="aspect-ratio-section">
            <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((ar) => {
                  const isPortrait = ar.value === "9:16";
                  const isActive = form.aspectRatio === ar.value;
                  return (
                    <Button
                      key={ar.value}
                      onClick={() => onChange({ aspectRatio: ar.value })}
                      className={`flex items-center justify-center gap-1 rounded-lg border py-2 text-xs font-semibold transition-all ${
                        isActive
                          ? "border-blue-400 bg-blue-50 text-blue-600"
                          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-base">
                        {isPortrait ? (
                          <BsFile />
                        ) : (
                          <BsFile style={{ transform: "rotate(90deg)" }} />
                        )}
                      </span>
                      {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                    </Button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div id="language-section">
            <Field noError name="language" label={t("Ngôn ngữ lời thoại")}>
              <Select
                native
                value={form.language}
                className="border-gray-200"
                options={LANGUAGE_OPTIONS}
                onChange={(value) => onChange({ language: value })}
              />
            </Field>
          </div>

          <div id="art-style-section">
            <ArtStylePickerDialog
              value={form.artStyle}
              onChange={(value) => onChange({ artStyle: value })}
              onCodeChange={(value) => onChange({ artStyleId: value || "" })}
            />
          </div>
          <div id="rhythm-section">
            <Field noError name="rhythm" label={t("Nhịp ảnh")}>
              <Select
                native
                value={form.rhythm}
                className="border-gray-200"
                options={AUDIO_IMAGE_RHYTHM_OPTIONS.map((item) => ({
                  value: item.value,
                  label: t(item.label),
                }))}
                onChange={(value) => onChange({ rhythm: value })}
              />
            </Field>
          </div>

          <div id="drawing-hand-section">
            <Field
              noError
              name="showDrawingHand"
              label={t("Bàn tay đang vẽ")}
              description={t("Có bàn tay cầm bút đang vẽ")
              }
            >
              <Switch
                value={form.showDrawingHand}
                onChange={(value) => onChange({ showDrawingHand: !!value })}
              />
            </Field>
          </div>

          <div id="ai-reference-image-section">
            <Field
              noError
              name="useAiReferenceImage"
              label={t("Lấy ảnh tham chiếu từ AI")}
              description={t("Bật để bắt buộc lấy ảnh từ tab gen 'Ảnh'")}
            >
              <Switch
                value={form.useAiReferenceImage}
                onChange={(value) => onChange({ useAiReferenceImage: !!value })}
              />
            </Field>
          </div>

          {sourceTab === "image" && (
            <div id="image-upload-section">
              <ElementImagesUpload
                label={t("Upload image")}
                artStyleImg={form.imageRefs}
                onArtStyleImgChange={(value) => onChange({ imageRefs: value || [] })}
                maxImages={12}
              />
            </div>
          )}

          {sourceTab === "audio" && (
            <div id="audio-upload-section">
              <ElementAudioUpload
                audioRef={form.audioRefs}
                onAudioRefChange={(value) => onChange({ audioRefs: value || [] })}
                maxFiles={1}
              />
            </div>
          )}

          {sourceTab === "text" && (
            <div id="text-content-section">
              <Field noError name="textContent" label={t("Nội dung văn bản")}>
                <Textarea
                  maxRows={8}
                  className="border-gray-200"
                  value={form.textContent}
                  placeholder={t("Nhập nội dung văn bản để tạo video")}
                  onChange={(value) => onChange({ textContent: value })}
                />
              </Field>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-gray-100 bg-white px-4 py-3">
        <button
          type="button"
          disabled={isRunning}
          onClick={onCreate}
          className="w-full rounded-xl border-0 bg-primary px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRunning ? t("Đang tạo video...") : t("Tạo Video")}
        </button>
      </div>
    </Form>
  );
}

export function AudioImageToVideoPage() {
  return (
    <AffiliateVideoProvider
      cacheKeys={{
        lastScript: CACHE_KEY.lastAudioImageScript,
        input: CACHE_KEY.audioImageInput,
        history: CACHE_KEY.audioImageHistory,
      }}
    >
      <AudioImageToVideoBody />
    </AffiliateVideoProvider>
  );
}

function AudioImageToVideoBody() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [form, setForm] = useState<AudioImageToVideoFormState>(DEFAULT_FORM);
  const [formReady, setFormReady] = useState(false);
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog } = useGlobalContext();
  const { setScriptData, patchConfig } = useAffiliateVideoContext();
  const scriptDB = useIndexedDB<any>(STORE_NAME.generateScene, DB_NAME.generateScene);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await scriptDB.get(CACHE_KEY.audioImageForm);
        if (!cancelled && cached && typeof cached === "object") {
          setForm((prev) => ({
            ...prev,
            ...cached,
            showDrawingHand: cached.showDrawingHand ?? true,
            useAiReferenceImage: cached.useAiReferenceImage ?? true,
          }));
          if (
            cached.artStyle ||
            cached.artStyleId ||
            cached.aspectRatio ||
            cached.useAiReferenceImage !== undefined
          ) {
            patchConfig?.({
              ...(cached.artStyle !== undefined ? { artStyle: cached.artStyle } : {}),
              ...(cached.artStyleId !== undefined ? { artStyleId: cached.artStyleId } : {}),
              ...(cached.aspectRatio !== undefined ? { aspectRatio: cached.aspectRatio } : {}),
              requireImageBeforeVideo: cached.useAiReferenceImage ?? true,
            });
          }
        } else if (!cancelled) {
          patchConfig?.({ requireImageBeforeVideo: true });
        }
      } catch {
        if (!cancelled) patchConfig?.({ requireImageBeforeVideo: true });
      } finally {
        if (!cancelled) setFormReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scriptDB, patchConfig]);

  useEffect(() => {
    if (!formReady) return;
    scriptDB.set(CACHE_KEY.audioImageForm, form).catch(() => {});
  }, [form, formReady, scriptDB]);

  useEffect(() => {
    if (!formReady) return;
    patchConfig?.({ requireImageBeforeVideo: form.useAiReferenceImage });
  }, [form.useAiReferenceImage, formReady, patchConfig]);

  const pipeline = useAudioImagePipeline({
    useAiReferenceImage: form.useAiReferenceImage,
    getForm: () => form,
    onTranscribed: (text) => {
      setForm((prev) => ({ ...prev, textContent: text }));
    },
    onAnalyzed: (script) => {
      setScriptData?.(script);
      scriptDB.set(CACHE_KEY.lastAudioImageScript, script).catch(() => {});
      patchConfig?.({
        artStyle: script.artStyle || "",
        artStyleId: script.artStyleId || form.artStyleId || "",
      });
      if (!form.artStyle?.trim() && script.artStyle) {
        setForm((prev) => ({ ...prev, artStyle: script.artStyle || prev.artStyle }));
      }
    },
  });

  const handleFormChange = (patch: Partial<AudioImageToVideoFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if (patch.artStyle !== undefined || patch.artStyleId !== undefined) {
      patchConfig?.({
        ...(patch.artStyle !== undefined ? { artStyle: patch.artStyle } : {}),
        ...(patch.artStyleId !== undefined ? { artStyleId: patch.artStyleId } : {}),
      });
    }
    if (patch.aspectRatio !== undefined) {
      patchConfig?.({ aspectRatio: patch.aspectRatio });
    }
    if (patch.useAiReferenceImage !== undefined) {
      patchConfig?.({ requireImageBeforeVideo: patch.useAiReferenceImage });
    }
  };

  const handleCreate = () => {
    if (!customer) {
      setOpenCustomerLoginDialog(true);
      return;
    }
    void pipeline.start();
  };

  return (
    <AffiliateVideoSidebarLayout
      isOpen={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
      sidebar={
        <AudioImageToVideoSidebar
          form={form}
          onChange={handleFormChange}
          onClose={() => setIsSidebarOpen(false)}
          onCreate={handleCreate}
          isRunning={pipeline.isRunning}
        />
      }
    >
      <AudioImageRightPanel pipeline={pipeline} />
    </AffiliateVideoSidebarLayout>
  );
}
