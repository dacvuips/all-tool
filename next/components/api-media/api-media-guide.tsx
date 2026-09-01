import copy from "copy-to-clipboard";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi";
import { RiFileCopy2Line } from "react-icons/ri";
import { useToast } from "../../lib/providers/toast-provider";
import {
  ApiMediaGuideConfig,
  clampComponentImageCount,
  CreationType,
  DEFAULT_API_MEDIA_GUIDE_CONFIG,
  FrameImageCount,
  getComponentImageCountRange,
  getCreateJobTitle,
  getVideoModeHint,
  IMAGE_INPUT_COUNT_MAX,
  IMAGE_MODEL_OPTIONS,
  ImageAspectRatio,
  ImageModelId,
  InputSource,
  isOmniQuality,
  OMNI_DURATIONS,
  OMNI_WITH_VIDEO_DURATION_S,
  OmniComponentInput,
  OmniDuration,
  showImageInputCountDropdown,
  showOmniComponentInput,
  showOmniDuration,
  showOmniDurationFixed,
  showReferenceCountDropdown,
  showUpsampleImageCard,
  showUpsampleVideoCard,
  VIDEO_MODEL_OPTIONS,
  VideoAspectRatio,
  VideoMode,
  VideoQualityId,
} from "./api-media-guide-config";
import {
  buildCreateJobSnippet,
  buildPollJobSnippet,
  buildUpsampleImageSnippet,
  buildUpsampleVideoSnippet,
  CodeLang,
} from "./api-media-guide-snippets";

const IMAGE_ASPECT_RATIOS: ImageAspectRatio[] = ["16:9", "9:16"];
const VIDEO_ASPECT_RATIOS: VideoAspectRatio[] = ["16:9", "9:16"];

function SegmentGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-gray-50 rounded-full border border-gray-100">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2 px-3 rounded-full text-sm font-semibold transition-all duration-200 ${
              active
                ? "text-white bg-blue-600 shadow-md shadow-blue-200"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AspectIcon({ ratio, active }: { ratio: string; active: boolean }) {
  const isPortrait = ratio === "9:16";
  return (
    <div
      className={`mx-auto mb-1.5 border-2 rounded-sm ${isPortrait ? "w-3.5 h-6" : "w-6 h-3.5"} ${
        active ? "border-white" : "border-gray-400"
      }`}
    />
  );
}

function GuideCodeCard({
  title,
  code,
  lang,
  onLangChange,
  headerExtra,
  showLangTabs = true,
}: {
  title: string;
  code: string;
  lang: CodeLang;
  onLangChange: (lang: CodeLang) => void;
  headerExtra?: React.ReactNode;
  showLangTabs?: boolean;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    copy(code);
    setCopied(true);
    toast.success(t("Đã sao chép mã nguồn"));
    setTimeout(() => setCopied(false), 2000);
  }, [code, t, toast]);

  return (
    <div className="overflow-hidden bg-white rounded-2xl border border-gray-200 shadow-sm">
      <div className="flex flex-wrap gap-2 items-center px-4 py-3 bg-white border-b border-gray-100">
        <h3 className="flex-1 min-w-0 text-sm font-semibold text-gray-800 truncate">{title}</h3>
        {headerExtra}
        {showLangTabs && (
          <div className="flex items-center gap-1 p-0.5 bg-gray-50 rounded-lg border border-gray-100">
            {(["curl", "python"] as CodeLang[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onLangChange(tab)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  lang === tab
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "curl" ? "Curl" : "Python"}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {copied ? <HiCheck className="text-emerald-500" /> : <RiFileCopy2Line />}
          {t("Copy")}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 m-0 font-mono text-xs leading-relaxed text-blue-900 whitespace-pre bg-slate-900">
        {code}
      </pre>
    </div>
  );
}

export default function ApiMediaGuide() {
  const { t } = useTranslation();

  const [config, setConfig] = useState<ApiMediaGuideConfig>(DEFAULT_API_MEDIA_GUIDE_CONFIG);
  const [createLang, setCreateLang] = useState<CodeLang>("curl");
  const [pollLang, setPollLang] = useState<CodeLang>("curl");
  const [upsampleLang, setUpsampleLang] = useState<CodeLang>("curl");

  const patch = useCallback((partial: Partial<ApiMediaGuideConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };

      if (partial.videoQuality === "omni_flash") {
        next.frameImageCount = "1";
        if (next.inputSource === "image" && next.videoMode === "component") {
          next.componentImageCount = clampComponentImageCount(next, next.componentImageCount || 1);
        }
      }

      if (
        partial.videoQuality &&
        partial.videoQuality !== "omni_flash" &&
        prev.videoQuality === "omni_flash"
      ) {
        next.componentImageCount = Math.min(3, Math.max(1, next.componentImageCount));
      }

      if (next.videoQuality === "omni_flash") {
        if (next.videoMode === "frame" && next.inputSource === "image") {
          next.frameImageCount = "1";
        }
      }

      if (
        partial.videoMode === "component" ||
        partial.omniComponentInput != null ||
        partial.videoQuality != null ||
        partial.inputSource != null
      ) {
        next.componentImageCount = clampComponentImageCount(next, next.componentImageCount);
      }

      if (next.omniComponentInput === "with_video") {
        next.omniDuration = OMNI_WITH_VIDEO_DURATION_S;
      }

      return next;
    });
  }, []);

  const createCode = useMemo(
    () => buildCreateJobSnippet(config, createLang),
    [config, createLang]
  );
  const pollCode = useMemo(() => buildPollJobSnippet(pollLang), [pollLang]);
  const upsampleImageCode = useMemo(
    () => buildUpsampleImageSnippet(config, upsampleLang),
    [config, upsampleLang]
  );
  const upsampleVideoCode = useMemo(
    () => buildUpsampleVideoSnippet(upsampleLang),
    [upsampleLang]
  );

  const createTitle = useMemo(() => getCreateJobTitle(config), [config]);
  const videoModeHint = useMemo(() => getVideoModeHint(config), [config]);
  const componentRange = useMemo(() => getComponentImageCountRange(config), [config]);

  const showVideoMode = config.creationType === "video" && config.inputSource === "image";
  const aspectRatios = config.creationType === "image" ? IMAGE_ASPECT_RATIOS : VIDEO_ASPECT_RATIOS;
  const currentAspect =
    config.creationType === "image" ? config.imageAspectRatio : config.videoAspectRatio;

  return (
    <div className="flex flex-col gap-5 min-h-0 lg:flex-row">
      <aside className="flex-shrink-0 w-full lg:w-72">
        <div className="sticky top-4 p-5 space-y-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {t("Loại tạo")}
            </p>
            <SegmentGroup<CreationType>
              value={config.creationType}
              onChange={(creationType) => patch({ creationType })}
              options={[
                { value: "image", label: t("Hình ảnh") },
                { value: "video", label: t("Video") },
              ]}
            />
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {t("Nguồn đầu vào")}
            </p>
            <SegmentGroup<InputSource>
              value={config.inputSource}
              onChange={(inputSource) => patch({ inputSource })}
              options={[
                { value: "text", label: "Text" },
                { value: "image", label: "Image" },
              ]}
            />
          </div>

          {showVideoMode && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("Chế độ video (image)")}
              </p>
              <SegmentGroup<VideoMode>
                value={config.videoMode}
                onChange={(videoMode) => patch({ videoMode })}
                options={[
                  { value: "frame", label: t("Khung hình") },
                  { value: "component", label: t("Thành phần") },
                ]}
              />
              {videoModeHint && (
                <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">{videoModeHint}</p>
              )}
            </div>
          )}

          {showOmniComponentInput(config) && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("Video đầu vào (Omni thành phần)")}
              </p>
              <SegmentGroup<OmniComponentInput>
                value={config.omniComponentInput}
                onChange={(omniComponentInput) => patch({ omniComponentInput })}
                options={[
                  { value: "images_only", label: t("Chỉ ảnh") },
                  { value: "with_video", label: t("Có video") },
                ]}
              />
            </div>
          )}

          {showOmniDuration(config) && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("Thời lượng Omni (giây)")}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {OMNI_DURATIONS.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    onClick={() => patch({ omniDuration: duration as OmniDuration })}
                    className={`py-2 rounded-lg text-sm font-semibold border transition-all ${
                      config.omniDuration === duration
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {showOmniDurationFixed(config) && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("Thời lượng Omni (giây)")}
              </p>
              <div className="px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                {OMNI_WITH_VIDEO_DURATION_S}s ({t("cố định khi có video")})
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              {t("Tỉ lệ")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {aspectRatios.map((ratio) => {
                const active = currentAspect === ratio;
                return (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() =>
                      patch(
                        config.creationType === "image"
                          ? { imageAspectRatio: ratio as ImageAspectRatio }
                          : { videoAspectRatio: ratio as VideoAspectRatio }
                      )
                    }
                    className={`flex flex-col items-center py-3 px-1 rounded-xl border-2 text-xs font-semibold transition-all ${
                      active
                        ? "text-white bg-blue-600 border-blue-600 shadow-md shadow-blue-200"
                        : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <AspectIcon ratio={ratio} active={active} />
                    {ratio}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
              Model
            </p>
            <select
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              value={config.creationType === "image" ? config.imageModel : config.videoQuality}
              onChange={(e) => {
                if (config.creationType === "image") {
                  patch({ imageModel: e.target.value as ImageModelId });
                } else {
                  patch({ videoQuality: e.target.value as VideoQualityId });
                }
              }}
            >
              {(config.creationType === "image"
                ? IMAGE_MODEL_OPTIONS
                : VIDEO_MODEL_OPTIONS.filter((m) => !m.disabled)
              ).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
            </select>
          </div>

          {showUpsampleImageCard(config) && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {t("Upscale ảnh")}
              </p>
              <select
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-800"
                value={config.upsampleImageResolution}
                onChange={(e) =>
                  patch({
                    upsampleImageResolution: e.target
                      .value as ApiMediaGuideConfig["upsampleImageResolution"],
                  })
                }
              >
                <option value="2K">2K</option>
                <option value="4K">4K</option>
              </select>
            </div>
          )}
        </div>
      </aside>

      <div className="flex-1 space-y-4 min-w-0">
        <GuideCodeCard
          title={createTitle}
          code={createCode}
          lang={createLang}
          onLangChange={setCreateLang}
          headerExtra={
            showImageInputCountDropdown(config) ? (
              <select
                className="px-2 py-1 text-xs text-gray-700 bg-white rounded-lg border border-gray-200"
                value={config.imageInputCount}
                onChange={(e) => patch({ imageInputCount: Number(e.target.value) })}
              >
                {Array.from({ length: IMAGE_INPUT_COUNT_MAX }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {t("ảnh (reference)")}
                  </option>
                ))}
              </select>
            ) : showReferenceCountDropdown(config) ? (
              config.videoMode === "frame" ? (
                <select
                  className="px-2 py-1 text-xs text-gray-700 bg-white rounded-lg border border-gray-200"
                  value={config.frameImageCount}
                  onChange={(e) => patch({ frameImageCount: e.target.value as FrameImageCount })}
                >
                  <option value="1">{t("1 ảnh (startImage)")}</option>
                  <option value="2">{t("2 ảnh (start + end)")}</option>
                </select>
              ) : (
                <select
                  className="px-2 py-1 text-xs text-gray-700 bg-white rounded-lg border border-gray-200"
                  value={config.componentImageCount}
                  onChange={(e) => patch({ componentImageCount: Number(e.target.value) })}
                >
                  {Array.from(
                    { length: componentRange.max - componentRange.min + 1 },
                    (_, i) => componentRange.min + i
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} {t("ảnh (reference)")}
                    </option>
                  ))}
                </select>
              )
            ) : isOmniQuality(config.videoQuality) &&
              showVideoMode &&
              config.videoMode === "frame" ? (
              <span className="px-2 py-1 text-xs text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                {t("1 ảnh (startImage)")}
              </span>
            ) : undefined
          }
        />

        <GuideCodeCard
          title={t("Check status")}
          code={pollCode}
          lang={pollLang}
          onLangChange={setPollLang}
        />

        {showUpsampleImageCard(config) && (
          <GuideCodeCard
            title={`Upscale ảnh ${config.upsampleImageResolution}`}
            code={upsampleImageCode}
            lang={upsampleLang}
            onLangChange={setUpsampleLang}
          />
        )}

        {showUpsampleVideoCard(config) && (
          <GuideCodeCard
            title={t("Upscale video 1080p")}
            code={upsampleVideoCode}
            lang={upsampleLang}
            onLangChange={setUpsampleLang}
          />
        )}

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <p className="mb-3 text-xs font-semibold tracking-wider text-gray-500 uppercase">
            {t("Phản hồi khi thành công")} — 202 / SUCCEEDED
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">POST (tạo / upscale job)</p>
              <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap">{`{
  "success": true,
  "jobId": "...",
  "status": "QUEUED"
}`}</pre>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">GET (poll job)</p>
              <pre className="text-[11px] font-mono text-gray-700 whitespace-pre-wrap">{`{
  "success": true,
  "data": {
    "status": "SUCCEEDED",
    "progress": 100,
    "resultData": {
      "images": [{ "imageUrl": "https://flow2.../image/...", "flow2RequestId": "..." }],
      "videoUri": "https://flow2.../video/...",
      "flow2RequestId": "...",
      "imageUrl": "https://flow2.../image/...",
      "mimeType": "image/jpeg"
    }
  }
}`}</pre>
              <p className="mt-2 text-[10px] text-gray-500 leading-snug">
                {t(
                  "Gen ảnh: images[].imageUrl + flow2RequestId — Gen video: videoUri + flow2RequestId — Upscale ảnh: imageUrl — Upscale video: videoUri"
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
