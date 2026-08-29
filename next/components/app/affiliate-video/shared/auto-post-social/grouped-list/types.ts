import { SocialPlatform } from "../types";

/** Metadata đăng MXH — map sang PostYoutubeVideoInput khi đăng YouTube */
export interface SocialPostPlatformFields {
  title: string;
  description: string;
  hashtag: string;
  link: string;
  /** private | public | unlisted */
  privacyStatus: string;
  /** "true" | "false" */
  madeForKids: string;
  /** YouTube categoryId, mặc định 22 */
  categoryId: string;
}

export type SocialPostGroupPlatformMeta = Record<SocialPlatform, SocialPostPlatformFields>;

/** Trạng thái đăng MXH đã lưu (persist scriptData + IndexedDB video). */
export type SocialPostPublishStatus = "posted" | "ready";

export interface SocialPostPublishInfo {
  status: SocialPostPublishStatus;
  /** Key IndexedDB (generated-videos store) */
  videoStorageKey?: string;
  youtubeUrl?: string;
  facebookUrl?: string;
  postedAt?: number;
  videoCount?: number;
  message?: string;
}

export interface SocialPostGroup {
  id: string;
  platforms: SocialPostGroupPlatformMeta;
  sceneIds: string[];
  publish?: SocialPostPublishInfo;
}

/** Thứ tự field trong dòng **a|b|c...** — khớp YouTube API có thể gửi */
export const SOCIAL_POST_HEADER_FIELD_KEYS = [
  "title",
  "description",
  "hashtag",
  "link",
  "privacyStatus",
  "madeForKids",
  "categoryId",
] as const;

export type SocialPostHeaderFieldKey = (typeof SOCIAL_POST_HEADER_FIELD_KEYS)[number];

export const SOCIAL_POST_HEADER_FIELD_META: Record<
  SocialPostHeaderFieldKey,
  { label: string; hint: string; templateValue: string }
> = {
  title: {
    label: "Tiêu đề",
    hint: "Là nơi ghi tiêu đề của video (gửi API: title).",
    templateValue: "Tiêu đề",
  },
  description: {
    label: "Mô tả",
    hint: "Là nơi ghi nội dung mô tả bài đăng / video (gửi API: description).",
    templateValue: "Mô tả",
  },
  hashtag: {
    label: "Hashtag",
    hint: "Là nơi ghi các hashtag, ví dụ #affiliate #review (gửi API: tags).",
    templateValue: "Hashtag",
  },
  link: {
    label: "Link",
    hint: "Link affiliate — nối vào mô tả video và đăng thêm comment trên video (cần scope youtube.force-ssl). Card/end screen YouTube không hỗ trợ qua API chính thức.",
    templateValue: "Link",
  },
  privacyStatus: {
    label: "Riêng tư",
    hint: "Quyền riêng tư video: private | public | unlisted (gửi API: privacyStatus).",
    templateValue: "Riêng tư",
  },
  madeForKids: {
    label: "Trẻ em",
    hint: "Nội dung dành cho trẻ em hay không: true | false hoặc có | không (gửi API: madeForKids).",
    templateValue: "Trẻ em",
  },
  categoryId: {
    label: "Danh mục",
    hint: "YouTube categoryId, ví dụ 22 = People & Blogs (gửi API: categoryId).",
    templateValue: "Danh mục",
  },
};

export function createEmptySocialPostFields(): SocialPostPlatformFields {
  return {
    title: "",
    description: "",
    hashtag: "",
    link: "",
    privacyStatus: "",
    madeForKids: "",
    categoryId: "",
  };
}

export function createEmptyGroupPlatformMeta(): SocialPostGroupPlatformMeta {
  return {
    youtube: createEmptySocialPostFields(),
    facebook: createEmptySocialPostFields(),
    tiktok: createEmptySocialPostFields(),
  };
}

export function createSocialPostGroup(id?: string, sceneIds: string[] = []): SocialPostGroup {
  return {
    id: id || `spg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    platforms: createEmptyGroupPlatformMeta(),
    sceneIds,
  };
}

function asTrimmed(raw: unknown): string {
  return String(raw ?? "").trim();
}

function normalizePrivacyStatus(raw: unknown): string {
  const v = asTrimmed(raw).toLowerCase();
  if (!v) return "";
  if (["private", "riêng tư", "rieng tu"].includes(v)) return "private";
  if (["public", "công khai", "cong khai"].includes(v)) return "public";
  if (["unlisted", "không công khai", "khong cong khai"].includes(v)) return "unlisted";
  if (["private", "public", "unlisted"].includes(v)) return v;
  return asTrimmed(raw);
}

function normalizeMadeForKids(raw: unknown): string {
  const v = asTrimmed(raw).toLowerCase();
  if (!v) return "";
  if (["true", "1", "yes", "có", "co", "trẻ em", "tre em"].includes(v)) return "true";
  if (["false", "0", "no", "không", "khong"].includes(v)) return "false";
  return asTrimmed(raw);
}

/** Bổ sung field thiếu cho data cũ (chỉ có 4 field). */
export function normalizeSocialPostFields(
  fields?: Partial<SocialPostPlatformFields> | null
): SocialPostPlatformFields {
  const empty = createEmptySocialPostFields();
  if (!fields) return empty;
  return {
    title: asTrimmed(fields.title),
    description: asTrimmed(fields.description),
    hashtag: asTrimmed(fields.hashtag),
    link: asTrimmed(fields.link),
    privacyStatus: normalizePrivacyStatus(fields.privacyStatus),
    madeForKids: normalizeMadeForKids(fields.madeForKids),
    categoryId: asTrimmed(fields.categoryId),
  };
}

export function normalizeSocialPostPublish(
  publish?: Partial<SocialPostPublishInfo> | null
): SocialPostPublishInfo | undefined {
  if (!publish) return undefined;
  const status = publish.status === "posted" || publish.status === "ready" ? publish.status : "ready";
  const videoStorageKey = asTrimmed(publish.videoStorageKey) || undefined;
  const youtubeUrl = asTrimmed(publish.youtubeUrl) || undefined;
  const facebookUrl = asTrimmed(publish.facebookUrl) || undefined;
  const message = asTrimmed(publish.message) || undefined;
  const postedAt =
    typeof publish.postedAt === "number" && Number.isFinite(publish.postedAt)
      ? publish.postedAt
      : undefined;
  const videoCount =
    typeof publish.videoCount === "number" && publish.videoCount > 0
      ? publish.videoCount
      : undefined;
  if (!videoStorageKey && !youtubeUrl && !facebookUrl && !postedAt) return undefined;
  return { status, videoStorageKey, youtubeUrl, facebookUrl, postedAt, videoCount, message };
}

/** Dòng header: **Tiêu đề|Mô tả|Hashtag|Link|Riêng tư|Trẻ em|Danh mục**
 * Giá trị trong header dùng trực tiếp làm metadata bài đăng
 * (kể cả chữ "Tiêu đề", "Mô tả", …).
 */
export function parseSocialPostHeaderLine(line: string): SocialPostPlatformFields | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^\*\*\s*(.+?)\s*\*\*$/);
  if (!match) return null;
  const parts = match[1].split("|").map((p) => p.trim());
  // Tối thiểu 4 field cũ; field YouTube mở rộng (5–7) là tuỳ chọn
  if (parts.length < 4) return null;

  const [
    title = "",
    description = "",
    hashtag = "",
    link = "",
    privacyRaw = "",
    kidsRaw = "",
    categoryId = "",
  ] = parts;

  return {
    title,
    description,
    hashtag,
    link,
    privacyStatus: normalizePrivacyStatus(privacyRaw),
    madeForKids: normalizeMadeForKids(kidsRaw),
    categoryId: asTrimmed(categoryId),
  };
}

export function isSocialPostHeaderLine(line: string): boolean {
  return parseSocialPostHeaderLine(line) !== null;
}

/**
 * Prompt có ít nhất 1 hàng bắt đầu bằng ** và kết thúc bằng ** (cùng hàng).
 */
export function hasAutoPostSocialHeaderInPrompt(prompt: string): boolean {
  return prompt.split(/\r?\n/).some((raw) => {
    const line = raw.trim();
    return line.startsWith("**") && line.endsWith("**") && line.length > 4;
  });
}

export function formatSocialPostHeaderTemplate(): string {
  const labels = SOCIAL_POST_HEADER_FIELD_KEYS.map(
    (k) => SOCIAL_POST_HEADER_FIELD_META[k].templateValue
  );
  return `**${labels.join("|")}**`;
}

/** Prompt mẫu — 1 dòng metadata + các dòng prompt phân cảnh */
export function formatSocialPostPromptSample(): string {
  return `${formatSocialPostHeaderTemplate()}\nPrompt 1\nPrompt 2`;
}

export function formatSocialPostHeaderLine(fields: SocialPostPlatformFields): string {
  const values = SOCIAL_POST_HEADER_FIELD_KEYS.map((k) => fields[k] || "");
  const hasAny = values.some((v) => !!v.trim());
  if (!hasAny) return formatSocialPostHeaderTemplate();
  return `**${values.join("|")}**`;
}

export function applyFieldsToAllPlatforms(
  fields: SocialPostPlatformFields
): SocialPostGroupPlatformMeta {
  return {
    youtube: { ...fields },
    facebook: { ...fields },
    tiktok: { ...fields },
  };
}

/** Map fields → payload đăng Facebook Fanpage GraphQL */
export function toPostFacebookPageVideoMeta(
  fields?: Partial<SocialPostPlatformFields> | null
): {
  title: string;
  description: string;
  privacyStatus: "private" | "public" | "unlisted";
} {
  const f = normalizeSocialPostFields(fields);

  const privacy = normalizePrivacyStatus(f.privacyStatus);
  const privacyStatus =
    privacy === "public" || privacy === "unlisted" || privacy === "private"
      ? privacy
      : "private";

  const hashtagText = f.hashtag
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .join(" ");

  const description = [f.description, hashtagText, f.link].filter(Boolean).join("\n\n");

  return {
    title: f.title,
    description,
    privacyStatus,
  };
}

/** Map fields → payload đăng YouTube GraphQL */
export function toPostYoutubeVideoMeta(
  fields?: Partial<SocialPostPlatformFields> | null
): {
  title: string;
  description: string;
  tags: string[];
  privacyStatus: "private" | "public" | "unlisted";
  madeForKids: boolean;
  categoryId: string;
} {
  const f = normalizeSocialPostFields(fields);

  const tags = f.hashtag
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t.slice(1) : t));

  const privacy = normalizePrivacyStatus(f.privacyStatus);
  const privacyStatus =
    privacy === "public" || privacy === "unlisted" || privacy === "private"
      ? privacy
      : "private";

  const description = [f.description, f.link].filter(Boolean).join("\n\n");

  return {
    title: f.title,
    description,
    tags,
    privacyStatus,
    madeForKids: normalizeMadeForKids(f.madeForKids) === "true",
    categoryId: f.categoryId || "22",
  };
}
