import {
  ApiMediaGuideConfig,
  DEFAULT_API_MEDIA_GUIDE_CONFIG,
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

export const ROUTE_HIGHLIGHT: Record<ApiMediaRouteId, { ring: string; bg: string; text: string }> =
  {
    create_image: {
      ring: "ring-orange-400",
      bg: "bg-orange-50",
      text: "text-orange-600",
    },
    create_video: {
      ring: "ring-red-500",
      bg: "bg-red-50",
      text: "text-red-600",
    },
    poll_job: {
      ring: "ring-green-400",
      bg: "bg-green-50",
      text: "text-green-600",
    },
    upsample_image: {
      ring: "ring-purple-400",
      bg: "bg-purple-50",
      text: "text-purple-600",
    },
    upsample_video: {
      ring: "ring-rose-400",
      bg: "bg-rose-50",
      text: "text-rose-600",
    },
  };

export const ROUTE_LOOP_MS = 900;
