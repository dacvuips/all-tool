import logger from "../../../helpers/logger";
import { ArtStyleModel } from "../../../libs/dal/art-style/art-style.model";
import { credentialService } from "../../../libs/dal/credential";
import { CustomerModel, CustomerStatusEnum, SubscriptionPlanEnum } from "../../../libs/dal/customer";
import { SettingModel } from "../../../libs/dal/setting";
import { ObjectToPersonifyModel } from "../../../libs/dal/objectToPersonify/objectToPersonify.model";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import { decryptProviderSecret } from "../../../packages/encryption/encrypt-provider";
import { fetchImageAsBase64 } from "../../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData } from "../../helpers/validateApiKey";
import { parseGeminiCredentialKeys } from "./_gemini";

export * from "./_ai-retry";
export * from "./_ai-scene.constants";
export * from "./_ai-scene";
export * from "./_chatgpt";
export * from "./_chatgpt.constants";
export * from "./_gemini";
export * from "./_gemini.constants";

/** Generate a simple UUID v4 string */
export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export enum TrendingModeTypeEnum {
  single_variant = "single_variant",
  story_script = "story_script",
}

/** Gỡ markdown fence và cắt JSON object/array từ text AI. */
export function extractJsonTextFromAIResponse(text: string): string {
  let s = text.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    s = fenceMatch[1].trim();
  }
  if (s.startsWith("{") || s.startsWith("[")) return s;
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return s.slice(firstBrace, lastBrace + 1);
  }
  const firstBracket = s.indexOf("[");
  const lastBracket = s.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    return s.slice(firstBracket, lastBracket + 1);
  }
  return s;
}

/** JSON storyboard bị cắt trước khi có mảng scenes (thường do hết token ở metadata giọng đọc). */
export function isIncompleteStoryboardJson(text: string): boolean {
  const s = extractJsonTextFromAIResponse(text);
  if (!s.includes('"scenes"') && (s.includes('"topicTitle"') || s.includes('"voiceGender"'))) {
    return true;
  }
  if ((s.startsWith("{") || s.startsWith("[")) && !s.trimEnd().endsWith("}") && !s.trimEnd().endsWith("]")) {
    return true;
  }
  return false;
}

/** Bóc envelope OpenAI/Gateway (choices[].message.content) hoặc { data: {...} }. */
export function unwrapAiJsonPayload(parsed: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(parsed.scenes) || parsed.topicTitle != null || parsed.characters != null) {
    return parsed;
  }

  const nestedData = parsed.data;
  if (nestedData && typeof nestedData === "object" && !Array.isArray(nestedData)) {
    return unwrapAiJsonPayload(nestedData as Record<string, unknown>);
  }

  const choices = parsed.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
    if (content && typeof content === "object" && !Array.isArray(content)) {
      return content as Record<string, unknown>;
    }
    if (typeof content === "string" && content.trim()) {
      try {
        const inner = JSON.parse(content);
        if (inner && typeof inner === "object" && !Array.isArray(inner)) {
          return unwrapAiJsonPayload(inner as Record<string, unknown>);
        }
        if (Array.isArray(inner)) {
          return { scenes: inner };
        }
      } catch {
        // giữ parsed gốc
      }
    }
  }

  return parsed;
}

/** Parse JSON từ AI text (Gemini/ChatGPT); hỗ trợ markdown fence và JSON nhúng trong text. */
export function parseGeminiJsonResponse(responseText: string): Record<string, unknown> {
  const candidates = [responseText.trim(), extractJsonTextFromAIResponse(responseText)];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) {
        return { scenes: parsed };
      }
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      return unwrapAiJsonPayload(parsed as Record<string, unknown>);
    } catch {
      // thử candidate tiếp theo
    }
  }

  const extracted = extractJsonTextFromAIResponse(responseText);
  const incomplete = isIncompleteStoryboardJson(responseText);

  logger.warn(
    `[parseGeminiJsonResponse] Không parse được JSON, length=${responseText.length}, preview: ${responseText.slice(0, 300)}${
      incomplete ? " (thiếu scenes / bị cắt ngắn)" : ""
    }`
  );
  const err: any = new Error(
    incomplete
      ? "AI trả kết quả bị cắt ngắn (thiếu phân cảnh). Vui lòng thử lại hoặc dùng ảnh có ít panel hơn."
      : "AI trả kết quả không đúng định dạng JSON"
  );
  err.statusCode = 502;
  throw err;
}

/** AI đôi khi trả audio dạng object { gender, personality, pace, sfx } thay vì string. */
export function normalizeSceneAudioField(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const orderedKeys = [
      "gender",
      "personality",
      "tone",
      "mood",
      "style",
      "pace",
      "pacing",
      "sfx",
      "sound",
    ];
    const seen = new Set<string>();
    const parts: string[] = [];
    for (const key of orderedKeys) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) {
        parts.push(v.trim());
        seen.add(key);
      }
    }
    for (const [key, v] of Object.entries(obj)) {
      if (!seen.has(key) && typeof v === "string" && v.trim()) {
        parts.push(v.trim());
      }
    }
    return parts.join(", ");
  }
  return String(value);
}

/** Scene generation phải có ít nhất 1 scene — không thì không tính quota. */
export function assertNonEmptyScenesArray(
  scenes: unknown,
  opts?: { label?: string; parsed?: Record<string, unknown> }
): void {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    if (opts?.label) {
      const keys = opts.parsed ? Object.keys(opts.parsed).join(", ") : "n/a";
      logger.warn(
        `[${opts.label}] AI trả scenes rỗng/không hợp lệ. parsed keys: ${keys}`
      );
    }
    const err: any = new Error("AI không trả danh sách scene hợp lệ");
    err.statusCode = 502;
    throw err;
  }
}

/** Style-text generation phải có field text không rỗng. */
export function assertNonEmptyTextField(text: unknown): void {
  if (typeof text !== "string" || !text.trim()) {
    const err: any = new Error("AI không trả nội dung text hợp lệ");
    err.statusCode = 502;
    throw err;
  }
}

export async function getCustomerGoogleLabsCredentials(): Promise<{
  googleLabsApiKey: string;
  geminiAPIKeys: string[];
}> {
  const [apiKeyDoc, geminiAPIKeyDoc] = await Promise.all([
    credentialService.findOne({
      key: AiProviderKeyEnum.GOOGLE_LABS_API_KEY,
      isAdminCredential: true,
    }),

    credentialService.findOne({
      key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
      isAdminCredential: true,
    }),
  ]);
  const apiKeyCred = (apiKeyDoc as any)?._doc;

  if (!apiKeyCred?.value) {
    const err: any = new Error("Chưa cấu hình Google Labs Access Token");
    err.statusCode = 403;
    throw err;
  }

  const geminiCred = (geminiAPIKeyDoc as any)?._doc;
  const geminiAPIKeys = geminiCred?.value ? parseGeminiCredentialKeys(geminiCred.value) : [];
  return {
    googleLabsApiKey: decryptProviderSecret(apiKeyCred.value),
    geminiAPIKeys,
  };
}

/** Kiểm tra customer ACTIVE và sàn chưa bị ngưng hoạt động trước khi generate image/video. */
export async function assertCustomerMediaGenerationAllowed(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId).select("status").lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }

  if (customer.status !== CustomerStatusEnum.ACTIVE) {
    const err: any = new Error("Tài khoản bị khóa hoặc ngừng kích hoạt");
    err.statusCode = 403;
    throw err;
  }

  const pageBlockSetting = await SettingModel.findOne({ key: "pa-b-page" }).select("isActive").lean();
  if (pageBlockSetting?.isActive === true) {
    const err: any = new Error(
      "Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!"
    );
    err.statusCode = 403;
    throw err;
  }
}

export async function checkImageLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.imageCount googlePackage.imageLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.imageCount || 0;
  const limit = customer.googlePackage?.imageLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn ảnh (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

export async function checkVideoLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.videoCount googlePackage.videoLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.videoCount || 0;
  const limit = customer.googlePackage?.videoLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn video (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

export async function incrementImageCount(customerId: string, amount = 1): Promise<void> {
  const n = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.imageCount": n } });
}

export async function incrementVideoCount(customerId: string, amount = 1): Promise<void> {
  const n = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1;
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.videoCount": n } });
}

/** Gói Basic trở lên (không dùng cho FREE / TRIAL). */
const PAID_SUBSCRIPTION_PLANS = new Set<string>([
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.ENTERPRISE,
]);

export function isPaidSubscriptionPlan(subscription?: string | null): boolean {
  return !!subscription && PAID_SUBSCRIPTION_PLANS.has(subscription);
}

/** Xóa Logo AI chỉ dành cho gói Basic trở lên. */
export async function assertPaidPackageForWatermark(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("status googlePackage.subscription")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  if (customer.status !== CustomerStatusEnum.ACTIVE) {
    const err: any = new Error("Tài khoản bị khóa hoặc ngừng kích hoạt");
    err.statusCode = 403;
    throw err;
  }
  const subscription = customer.googlePackage?.subscription;
  if (!isPaidSubscriptionPlan(subscription)) {
    const err: any = new Error(
      "Chức năng Xóa Logo AI chỉ dành cho gói Basic trở lên. Vui lòng nâng cấp gói để sử dụng."
    );
    err.statusCode = 403;
    throw err;
  }
}

/** Số slot còn lại (limit -1 hoặc không set limit hợp lệ → unlimited). */
export function calcQuotaRemaining(count?: number, limit?: number): number {
  const used = count || 0;
  if (limit == null || limit < 0) return Number.MAX_SAFE_INTEGER;
  return Math.max(0, limit - used);
}

export async function getImageVideoQuotaRemaining(customerId: string): Promise<{
  imageRemaining: number;
  videoRemaining: number;
  imageCount: number;
  imageLimit: number;
  videoCount: number;
  videoLimit: number;
}> {
  const customer = await CustomerModel.findById(customerId)
    .select(
      "googlePackage.imageCount googlePackage.imageLimit googlePackage.videoCount googlePackage.videoLimit"
    )
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const imageCount = customer.googlePackage?.imageCount || 0;
  const imageLimit = customer.googlePackage?.imageLimit ?? 0;
  const videoCount = customer.googlePackage?.videoCount || 0;
  const videoLimit = customer.googlePackage?.videoLimit ?? 0;
  return {
    imageCount,
    imageLimit,
    videoCount,
    videoLimit,
    imageRemaining: calcQuotaRemaining(imageCount, imageLimit),
    videoRemaining: calcQuotaRemaining(videoCount, videoLimit),
  };
}

function buildRequestLimitExceededError(currentCount: number, limit: number): Error {
  const err: any = new Error(
    `Bạn đã vượt quá giới hạn generation text (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
  );
  err.statusCode = 403;
  return err;
}

export async function checkRequestLimit(customerId: string, count = 1): Promise<void> {
  const slotCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.requestCount googlePackage.requestLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.requestCount || 0;
  const limit = customer.googlePackage?.requestLimit || 0;
  if (currentCount + slotCount > limit) {
    throw buildRequestLimitExceededError(currentCount, limit);
  }
}

/** Giữ chỗ request quota nguyên tử – dùng trước khi gọi AI (thay cho check + increment tách rời). */
export async function reserveRequestSlots(customerId: string, count = 1): Promise<void> {
  const slotCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  const result = await CustomerModel.findOneAndUpdate(
    {
      _id: customerId,
      $expr: {
        $lte: [
          { $add: [{ $ifNull: ["$googlePackage.requestCount", 0] }, slotCount] },
          { $ifNull: ["$googlePackage.requestLimit", 0] },
        ],
      },
    },
    { $inc: { "googlePackage.requestCount": slotCount } }
  );

  if (!result) {
    const customer = await CustomerModel.findById(customerId)
      .select("googlePackage.requestCount googlePackage.requestLimit")
      .lean();
    if (!customer) {
      const err: any = new Error("Không tìm thấy thông tin khách hàng");
      err.statusCode = 404;
      throw err;
    }
    const currentCount = customer.googlePackage?.requestCount || 0;
    const limit = customer.googlePackage?.requestLimit || 0;
    throw buildRequestLimitExceededError(currentCount, limit);
  }
}

/** Hoàn trả quota khi request thất bại sau khi đã reserve. */
export async function releaseRequestSlots(customerId: string, count = 1): Promise<void> {
  const slotCount = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  await CustomerModel.findByIdAndUpdate(customerId, {
    $inc: { "googlePackage.requestCount": -slotCount },
  });
}

export async function incrementRequestCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.requestCount": 1 } });
}

export async function resolveObjectToPersonifyPrompt(opts: {
  objectToPersonifyCode?: string;
  objectToPersonify?: string;
}): Promise<{ prompt?: string; error?: { status: number; message: string } }> {
  if (!opts.objectToPersonifyCode) {
    return { prompt: opts.objectToPersonify };
  }

  const objectDoc = await ObjectToPersonifyModel.findOne({
    code: opts.objectToPersonifyCode,
  }).lean();

  if (!objectDoc) {
    return { prompt: opts.objectToPersonify };
  }

  if (opts.objectToPersonify && opts.objectToPersonify !== objectDoc.name) {
    return { prompt: opts.objectToPersonify };
  }

  return { prompt: objectDoc.prompt || opts.objectToPersonify };
}

export async function resolveArtStylePrompt(opts: {
  artStyleId?: string;
  artStyle?: string;
}): Promise<{ prompt?: string; name?: string }> {
  if (!opts.artStyleId) {
    return { prompt: opts.artStyle };
  }

  try {
    const artStyleDoc = await ArtStyleModel.findById(opts.artStyleId).lean();
    if (!artStyleDoc) {
      return { prompt: opts.artStyle };
    }

    return { prompt: artStyleDoc.prompt || opts.artStyle, name: artStyleDoc.name };
  } catch {
    return { prompt: opts.artStyle };
  }
}

/**
 * Chọn text art style để gắn vào prompt gen ảnh/video:
 * - Có artStyleId → lấy prompt từ DB theo ID
 * - Không có ID, hoặc user đã sửa value khác name/prompt của style → dùng value ô nhập
 */
export async function resolveArtStyleTextForGeneration(opts: {
  artStyleId?: string;
  artStyle?: string;
}): Promise<string> {
  const freeText = String(opts.artStyle || "").trim();
  if (!opts.artStyleId) return freeText;

  const { prompt, name } = await resolveArtStylePrompt(opts);
  const dbPrompt = String(prompt || "").trim();
  if (!dbPrompt) return freeText;

  const styleName = String(name || "").trim();
  if (!freeText || freeText === styleName || freeText === dbPrompt) {
    return dbPrompt;
  }
  return freeText;
}

export interface MediaImageBytes {
  name: string;
  imageBytes: string;
  fifeUrl?: string;
  mimeType?: string;
}

export interface AffiliateVideoFormConfig {
  category: string;
  objectToPersonify: string;
  tipContent: string;
  mood: string;
  language: string;
  artStyle: string;
  storyModeType: "prompt_to_video" | "image_to_video";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  batchSize: number;
  artStyleId?: string;
}

export interface ReviewFormConfig extends AffiliateVideoFormConfig {
  prompt: string;
  artStyle: string;
  artStyleId?: string;
  serviceImageType?: string;
  batchSize: number;
  objectToPersonify: string;
  artStyleImg?: MediaImageBytes[];
  artStyleImgNames?: string[];
  objectToPersonifyImage?: MediaImageBytes;
  objectImg?: MediaImageBytes;
  itemImg?: MediaImageBytes;
}

export interface TrendingVideoFormConfig {
  tipContent: string;
  batchSize: number;
  productImages?: string[];
  trendingModeType: TrendingModeTypeEnum;
  category?: string;
  mood: string;
  language: string;
  artStyle: string;
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  promptId: string;
  artStyleId?: string;
}

const IMAGE_REFERENCE_ORDER_RULE =
  "IMPORTANT: The first reference image is always the character; from the second reference image onward, the images are product images.";

const PRODUCT_IMAGE_REFERENCE_RULES =
  "place ALL products into ONE single unified image. Each product must preserve its exact appearance, shape, color, brand, and packaging as shown in the reference image. Arrange all products naturally within a single, cohesive composition. Every product must be clearly visible and easily recognizable in the final image. Some random product items must be shown being held in the character's hand";

const OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES =
  "preserve the character's exact appearance, shape, color, material, and identifying features—including the face with the correct proportions of eyes, nose, and mouth—as well as the character's size, 100% identical to the first reference image when generating images. Do NOT transform the character into a personified/anthropomorphized version, and do not arbitrarily add or remove anything. For example, if the first image shows a young man, the second image must also be a young man (a different one is not allowed; it must not be a woman). Do not change the accessories or clothing the man is wearing, and do not change his hairstyle. For example, if the accessory in the first scene is a hat, the second image must also feature a hat, not a shirt";

export const DEFAULT_PRODUCT_IMAGE_REFERENCE_NOTE = `\nIMPORTANT: This prompt applies to the 2nd image onward. You MUST ${PRODUCT_IMAGE_REFERENCE_RULES}.`;

export const DEFAULT_OBJECT_PERSONIFY_IMAGE_REFERENCE_NOTE = `\nIMPORTANT: This prompt applies to the first image. You MUST ${OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES}. ${IMAGE_REFERENCE_ORDER_RULE}`;

function buildCombinedImageReferenceNote(productCustomPrompt?: string): string {
  const productSection = productCustomPrompt
    ? productCustomPrompt
    : `You MUST ${PRODUCT_IMAGE_REFERENCE_RULES}.`;
  return (
    `\nIMPORTANT — REFERENCE IMAGES:\n` +
    `${IMAGE_REFERENCE_ORDER_RULE}\n\n` +
    `• Image 1 (character/personification): You MUST ${OBJECT_PERSONIFY_IMAGE_REFERENCE_RULES}.\n\n` +
    `• Image 2 onward (products): ${productSection}`
  );
}

export function buildImageReferenceNotes(opts: {
  productUrls?: string[];
  productImages?: ReferenceImageInput[];
  productCustomPrompt?: string;
  personifyImages?: ReferenceImageInput[];
}): string {
  const productUrls = opts.productUrls?.filter(Boolean) || [];
  const hasProduct = productUrls.length > 0 || filterReferenceImages(opts.productImages).length > 0;
  const hasPersonify = filterReferenceImages(opts.personifyImages).length > 0;

  if (!hasProduct && !hasPersonify) return "";
  if (hasProduct && hasPersonify) {
    return buildCombinedImageReferenceNote(opts.productCustomPrompt);
  }
  if (hasPersonify) return buildObjectPersonifyImageReferenceNote(opts.personifyImages);
  if (productUrls.length > 0) {
    return buildProductImageReferenceNote(productUrls, opts.productCustomPrompt);
  }
  if (opts.productCustomPrompt) return `\n${opts.productCustomPrompt}`;
  return DEFAULT_PRODUCT_IMAGE_REFERENCE_NOTE;
}

export function collectOrderedReviewReferenceImages(
  config: ReviewFormConfig
): ReferenceImageInput[] {
  const out: ReferenceImageInput[] = [];
  for (const img of config.artStyleImg ?? []) {
    out.push(img);
  }
  if (config.objectToPersonifyImage) out.push(config.objectToPersonifyImage);
  if (config.objectImg) out.push(config.objectImg);
  if (config.itemImg) out.push(config.itemImg);
  return out;
}

export async function resolveReferenceImagesForGemini(
  images?: ReferenceImageInput[]
): Promise<{ imageBytes: string; mimeType: string }[]> {
  const filtered = filterReferenceImages(images);
  return Promise.all(
    filtered.map(async (item) => {
      if (typeof item === "string") {
        return fetchImageAsBase64(item);
      }
      return {
        imageBytes: item.imageBytes,
        mimeType: item.mimeType || "image/png",
      };
    })
  );
}

export function buildProductImageReferenceNote(urls: string[], customPrompt?: string): string {
  const filtered = urls?.filter(Boolean) || [];
  if (filtered.length === 0) return "";
  if (customPrompt) return `\n${customPrompt}`;
  return DEFAULT_PRODUCT_IMAGE_REFERENCE_NOTE;
}

export type ReferenceImageInput =
  | string
  | {
      imageBytes?: string;
      mimeType?: string;
      fifeUrl?: string;
      name?: string;
    };

export type UploadableReferenceImage = string | { imageBytes: string; mimeType?: string };

function stripDataUrlBase64(
  input: string,
  fallbackMimeType = "image/png"
): { imageBytes: string; mimeType: string } {
  const trimmed = input.trim();
  const base64Marker = ";base64,";
  if (trimmed.startsWith("data:")) {
    const idx = trimmed.indexOf(base64Marker);
    if (idx !== -1) {
      return {
        mimeType: trimmed.slice(5, idx) || fallbackMimeType,
        imageBytes: trimmed.slice(idx + base64Marker.length),
      };
    }
  }
  return { imageBytes: trimmed, mimeType: fallbackMimeType };
}

function normalizeReferenceImageItem(item: ReferenceImageInput): UploadableReferenceImage | null {
  if (!item) return null;

  if (typeof item === "string") {
    const s = item.trim();
    if (!s) return null;
    if (s.startsWith("data:")) return stripDataUrlBase64(s);
    return s;
  }

  let bytes = item.imageBytes?.trim();
  if (!bytes && item.fifeUrl?.trim()) {
    const url = item.fifeUrl.trim();
    if (url.startsWith("data:")) return stripDataUrlBase64(url);
    return url;
  }
  if (!bytes) return null;

  if (bytes.startsWith("data:")) {
    return stripDataUrlBase64(bytes, item.mimeType || "image/png");
  }
  return { imageBytes: bytes, mimeType: item.mimeType || "image/png" };
}

export function filterReferenceImages(images?: ReferenceImageInput[]): UploadableReferenceImage[] {
  const out: UploadableReferenceImage[] = [];
  for (const item of images || []) {
    const normalized = normalizeReferenceImageItem(item);
    if (normalized) out.push(normalized);
  }
  return out;
}

export function buildObjectPersonifyImageReferenceNote(images?: ReferenceImageInput[]): string {
  if (filterReferenceImages(images).length === 0) return "";
  return DEFAULT_OBJECT_PERSONIFY_IMAGE_REFERENCE_NOTE;
}

export function buildProductImageScriptNote(urls: string[]): string {
  const filtered = urls?.filter(Boolean).map((u) => u.trim()).filter(Boolean) || [];
  if (filtered.length === 0) return "";

  // Chỉ liệt kê http(s); data:/base64 không được nhét vào prompt text.
  const httpUrls = filtered.filter((u) => /^https?:\/\//i.test(u));
  const hasAttached =
    filtered.some((u) => u.startsWith("data:") || !/^https?:\/\//i.test(u)) || httpUrls.length > 0;

  if (!hasAttached) return "";

  let note =
    "\n\n*** ẢNH SẢN PHẨM THAM CHIẾU ***\n" +
    "Các ảnh sản phẩm đính kèm là tham chiếu cho sản phẩm chính trong video. " +
    "Hãy sử dụng chúng để mô tả chính xác hơn các props / sản phẩm trong visual_prompt.";
  if (httpUrls.length > 0) {
    note += `\nURLs: ${httpUrls.join(", ")}`;
  }
  return note;
}

export function buildObjectPersonifyImageScriptNote(images?: ReferenceImageInput[]): string {
  const filtered = filterReferenceImages(images);
  if (filtered.length === 0) return "";
  const httpUrls = filtered.filter(
    (i): i is string => typeof i === "string" && /^https?:\/\//i.test(i.trim())
  );
  let note =
    "\n\n*** ẢNH THAM CHIẾU NHÂN HOÁ ĐỒ VẬT ***\n" +
    "Có ảnh tham chiếu nhân hoá đồ vật đính kèm. Hãy dùng để mô tả chính xác hơn nhân vật nhân hoá trong visual_prompt.";
  if (httpUrls.length > 0) {
    note += `\nURLs: ${httpUrls.join(", ")}`;
  }
  return note;
}

/** Resolve productImages (http URL hoặc data URL) thành media base64 cho Gemini/ChatGPT. */
export async function resolveProductImagesForAi(
  productImages?: string[]
): Promise<{ imageBytes: string; mimeType: string }[]> {
  const filtered = productImages?.filter(Boolean).map((u) => u.trim()).filter(Boolean) || [];
  if (filtered.length === 0) return [];

  return Promise.all(
    filtered.map(async (item) => {
      if (item.startsWith("data:")) {
        return stripDataUrlBase64(item);
      }
      if (/^https?:\/\//i.test(item)) {
        return fetchImageAsBase64(item);
      }
      // Raw base64 (không kèm data: prefix)
      return { imageBytes: item, mimeType: "image/jpeg" };
    })
  );
}

export {
  assertFlow2VideoImageCount,
  FLOW2_VIDEO_MODE,
  mapServiceImageTypeToFlow2VideoMode,
  normalizeFlow2VideoMode,
  resolveFlow2VideoMode,
} from "../../api-media/flow2/video-mode";
export type { Flow2VideoMode } from "../../api-media/flow2/video-mode";

export function interpolateTemplate(text: string, config: AffiliateVideoFormConfig): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (config as any)[key];
    return value !== undefined && value !== null ? `"${String(value)}"` : "";
  });
}

export function interpolateTrendingTemplate(text: string, config: TrendingVideoFormConfig): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (config as any)[key];
    return value !== undefined && value !== null ? `"${String(value)}"` : "";
  });
}

export enum ActionEnum {
  VIDEO_GENERATION = "VIDEO_GENERATION",
  IMAGE_GENERATION = "IMAGE_GENERATION",
}

export async function getReCaptchaCredentials(
  action: ActionEnum
): Promise<CaptchaResponseData & { projectId: string; accessToken: string }> {
  const url = `https://capcha.viettheo.site/captcha${
    action === ActionEnum.VIDEO_GENERATION ? "" : "?action=IMAGE_GENERATION"
  }`;
  const { googleLabsApiKey } = await getCustomerGoogleLabsCredentials();
  const captchaResp = await fetch(url, {
    headers: {
      "X-API-Key": googleLabsApiKey,
    },
  });

  const captchaData = (await captchaResp.json()) as CaptchaResponseData;

  if (!captchaData?.captcha || !captchaData?.accessToken) {
    const err: any = new Error("Không lấy được captcha/credentials từ server");
    err.statusCode = 500;
    throw err;
  }

  return {
    ...captchaData,
    sessionId: captchaData.sessionId,
    projectId: captchaData.ProjectID,
    accessToken: captchaData.accessToken,
  };
}

export function getImageDisplayName(img: MediaImageBytes): string {
  const raw = (img.name || "").trim();
  if (!raw) return "";
  return raw.replace(/\.[^./\\]+$/, "").trim();
}
