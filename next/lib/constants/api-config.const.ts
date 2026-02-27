/**
 * Cấu hình preset cho form gọi API tạo ảnh, video, file từ các nền tảng AI.
 * Có thể mở rộng thêm provider/model.
 */

export const API_OUTPUT_TYPES = [
  { value: "IMAGE", label: "Ảnh (Image)" },
  { value: "VIDEO", label: "Video" },
  { value: "FILE", label: "File / Tài liệu" },
  { value: "AUDIO", label: "Audio" },
] as const;

export type ApiOutputTypeValue = typeof API_OUTPUT_TYPES[number]["value"];

/** Model theo từng provider và outputType */
export interface ApiModelOption {
  value: string;
  label: string;
  /** Gợi ý endpoint hoặc base path */
  endpointHint?: string;
  /** Gợi ý response path để lấy URL kết quả */
  responsePathHint?: string;
}

export interface ApiProviderOption {
  value: string;
  label: string;
  baseUrlHint?: string;
  /** Models theo outputType: IMAGE, VIDEO, FILE, AUDIO */
  models: Partial<Record<ApiOutputTypeValue, ApiModelOption[]>>;
}

export const API_PROVIDERS: ApiProviderOption[] = [
  {
    value: "openai",
    label: "OpenAI",
    baseUrlHint: "https://api.openai.com/v1",
    models: {
      IMAGE: [
        {
          value: "dall-e-3",
          label: "DALL-E 3",
          endpointHint: "/images/generations",
          responsePathHint: "data[0].url",
        },
        {
          value: "dall-e-2",
          label: "DALL-E 2",
          endpointHint: "/images/generations",
          responsePathHint: "data[0].url",
        },
      ],
      AUDIO: [
        {
          value: "tts-1",
          label: "TTS-1",
          endpointHint: "/audio/speech",
          responsePathHint: "body (stream)",
        },
        {
          value: "tts-1-hd",
          label: "TTS-1-HD",
          endpointHint: "/audio/speech",
          responsePathHint: "body (stream)",
        },
      ],
    },
  },
  {
    value: "google",
    label: "Google AI (Vertex / Gemini)",
    baseUrlHint: "https://generativelanguage.googleapis.com",
    models: {
      IMAGE: [
        {
          value: "imagen-3",
          label: "Imagen 3",
          endpointHint: "/v1beta/models/imagen-3:generateImages",
          responsePathHint: "generatedImages[0].image.bytesBase64Encoded",
        },
      ],
      VIDEO: [
        {
          value: "veo-3",
          label: "Veo 3",
          endpointHint: "/v1beta/models/veo-3:generateVideo",
          responsePathHint: "generatedSamples[0].video.uri",
        },
        {
          value: "veo-2",
          label: "Veo 2",
          endpointHint: "/v1beta/models/veo-2:generateVideo",
          responsePathHint: "generatedSamples[0].video.uri",
        },
      ],
    },
  },
  {
    value: "replicate",
    label: "Replicate",
    baseUrlHint: "https://api.replicate.com/v1",
    models: {
      IMAGE: [
        {
          value: "flux-schnell",
          label: "Flux Schnell",
          endpointHint: "/predictions",
          responsePathHint: "outputs[0]",
        },
        {
          value: "flux-dev",
          label: "Flux Dev",
          endpointHint: "/predictions",
          responsePathHint: "outputs[0]",
        },
        { value: "sdxl", label: "SDXL", endpointHint: "/predictions", responsePathHint: "output" },
        {
          value: "stable-diffusion",
          label: "Stable Diffusion",
          endpointHint: "/predictions",
          responsePathHint: "output[0]",
        },
      ],
      VIDEO: [
        {
          value: "stable-video-diffusion",
          label: "Stable Video Diffusion",
          endpointHint: "/predictions",
          responsePathHint: "output",
        },
        {
          value: "minimax-video",
          label: "Minimax Video",
          endpointHint: "/predictions",
          responsePathHint: "output",
        },
      ],
    },
  },
  {
    value: "stability",
    label: "Stability AI",
    baseUrlHint: "https://api.stability.ai/v1",
    models: {
      IMAGE: [
        {
          value: "stable-diffusion-xl",
          label: "Stable Diffusion XL",
          endpointHint: "/generation/stable-diffusion-xl/text-to-image",
          responsePathHint: "artifacts[0].base64",
        },
        {
          value: "stable-diffusion-v1",
          label: "Stable Diffusion v1",
          endpointHint: "/generation/stable-diffusion-v1/text-to-image",
          responsePathHint: "artifacts[0].base64",
        },
      ],
    },
  },
  {
    value: "runway",
    label: "Runway",
    baseUrlHint: "https://api.runwayml.com/v1",
    models: {
      VIDEO: [
        {
          value: "gen3a-turbo",
          label: "Gen-3 Alpha Turbo",
          endpointHint: "/image_to_video",
          responsePathHint: "output[0]",
        },
        {
          value: "gen3a",
          label: "Gen-3 Alpha",
          endpointHint: "/image_to_video",
          responsePathHint: "output[0]",
        },
      ],
    },
  },
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    baseUrlHint: "https://api.anthropic.com/v1",
    models: {
      IMAGE: [
        {
          value: "claude-sonnet-4",
          label: "Claude (Sonnet 4 - with vision)",
          endpointHint: "/messages",
          responsePathHint: "content[].image",
        },
      ],
      FILE: [
        {
          value: "claude-sonnet-4",
          label: "Claude Sonnet 4",
          endpointHint: "/messages",
          responsePathHint: "content[].text",
        },
      ],
    },
  },
  {
    value: "fal",
    label: "Fal.ai",
    baseUrlHint: "https://queue.fal.run",
    models: {
      IMAGE: [
        {
          value: "fal-ai/flux",
          label: "Flux",
          endpointHint: "/fal-ai/flux",
          responsePathHint: "images[0].url",
        },
        {
          value: "fal-ai/recraft-v3",
          label: "Recraft v3",
          endpointHint: "/fal-ai/recraft-v3",
          responsePathHint: "images[0].url",
        },
      ],
      VIDEO: [
        {
          value: "fal-ai/minimax-video",
          label: "Minimax Video",
          endpointHint: "/fal-ai/minimax-video",
          responsePathHint: "video.url",
        },
      ],
    },
  },
  {
    value: "custom",
    label: "Custom (API tùy chỉnh)",
    models: {},
  },
];

/** Lấy danh sách model theo provider và outputType */
export function getModelsForProviderAndOutput(
  provider: string,
  outputType: ApiOutputTypeValue
): ApiModelOption[] {
  const p = API_PROVIDERS.find((x) => x.value === provider);
  if (!p || p.value === "custom") return [];
  const models = p.models[outputType];
  return models ?? [];
}
