import {
  ApiMediaGuideConfig,
  DEFAULT_API_MEDIA_GUIDE_CONFIG,
  IMAGE_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from "../../../../api-media/api-media-guide-config";

export type ApiMediaRouteId =
  | "create_image"
  | "create_video"
  | "poll_job"
  | "upsample_image"
  | "upsample_video";

export type ConsoleCodeLang = "node" | "curl" | "python";

export type ApiMediaRoute = {
  id: ApiMediaRouteId;
  method: "POST" | "GET";
  path: string;
  label: string;
};

export const API_MEDIA_ROUTES: ApiMediaRoute[] = [
  {
    id: "create_image",
    method: "POST",
    path: "/api/api-media?type=IMAGE_GENERATION",
    label: "Image generation",
  },
  {
    id: "create_video",
    method: "POST",
    path: "/api/api-media?type=VIDEO_GENERATION",
    label: "Video generation",
  },
  {
    id: "poll_job",
    method: "GET",
    path: "/api/api-media/job/:jobId",
    label: "Poll job",
  },
  {
    id: "upsample_image",
    method: "POST",
    path: "/api/api-media/upsample-image",
    label: "Upscale image",
  },
  {
    id: "upsample_video",
    method: "POST",
    path: "/api/api-media/upsample-video",
    label: "Upscale video",
  },
];

export type ConsoleModel = {
  id: string;
  label: string;
  kind: "image" | "video";
  meta: string;
  ready: boolean;
};

export const API_MEDIA_CONSOLE_MODELS: ConsoleModel[] = [
  ...IMAGE_MODEL_OPTIONS.map((m) => ({
    id: m.id,
    label: m.label,
    kind: "image" as const,
    meta: m.id === "NANO_BANANA_PRO" ? "Pro image" : "Image gen",
    ready: true,
  })),
  ...VIDEO_MODEL_OPTIONS.filter((m) => !m.disabled).map((m) => ({
    id: m.id,
    label: m.label,
    kind: "video" as const,
    meta: "Video gen",
    ready: true,
  })),
  ...VIDEO_MODEL_OPTIONS.filter((m) => m.disabled)
    .slice(0, 2)
    .map((m) => ({
      id: m.id,
      label: m.label,
      kind: "video" as const,
      meta: "Coming soon",
      ready: false,
    })),
];

export const ROUTE_CONFIG: Record<ApiMediaRouteId, ApiMediaGuideConfig> = {
  create_image: DEFAULT_API_MEDIA_GUIDE_CONFIG,
  create_video: { ...DEFAULT_API_MEDIA_GUIDE_CONFIG, creationType: "video" },
  poll_job: DEFAULT_API_MEDIA_GUIDE_CONFIG,
  upsample_image: DEFAULT_API_MEDIA_GUIDE_CONFIG,
  upsample_video: { ...DEFAULT_API_MEDIA_GUIDE_CONFIG, creationType: "video" },
};

export const CONSOLE_STATS = [
  {
    id: "models",
    label: "Model surface",
    value: "Banana / Veo",
  },
  {
    id: "speed",
    label: "Default speed",
    value: "Async poll",
  },
  {
    id: "free",
    label: "Free test",
    value: "100 requests",
  },
  {
    id: "access",
    label: "Access",
    value: "One API key",
  },
] as const;
