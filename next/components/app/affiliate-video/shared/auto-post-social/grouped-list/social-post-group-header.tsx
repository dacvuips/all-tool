/**
 * Header metadata đăng MXH: Tiêu đề | Mô tả | Hashtag | Link (theo từng nền tảng).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FaTiktok } from "react-icons/fa";
import { RiFacebookCircleFill, RiYoutubeFill } from "react-icons/ri";
import { SocialPlatform, SOCIAL_PLATFORMS } from "../types";
import {
  SocialPostGroup,
  SocialPostGroupPlatformMeta,
  SocialPostPlatformFields,
} from "./types";

const PLATFORM_ICONS: Record<SocialPlatform, JSX.Element> = {
  youtube: <RiYoutubeFill className="text-sm text-red-500" />,
  facebook: <RiFacebookCircleFill className="text-sm text-blue-500" />,
  tiktok: <FaTiktok className="text-sm text-gray-800" />,
};

interface SocialPostGroupHeaderProps {
  group: SocialPostGroup;
  groupIndex: number;
  enabledPlatforms: SocialPlatform[];
  onChange: (groupId: string, platforms: SocialPostGroupPlatformMeta) => void;
}

export function SocialPostGroupHeader({
  group,
  groupIndex,
  enabledPlatforms,
  onChange,
}: SocialPostGroupHeaderProps) {
  const { t } = useTranslation();
  const tabs = enabledPlatforms.length > 0 ? enabledPlatforms : SOCIAL_PLATFORMS.map((p) => p.id);
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>(tabs[0] ?? "youtube");

  const fields = group.platforms[activePlatform];

  const patchField = (key: keyof SocialPostPlatformFields, value: string) => {
    onChange(group.id, {
      ...group.platforms,
      [activePlatform]: { ...group.platforms[activePlatform], [key]: value },
    });
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-indigo-100 bg-white/80">
        <span className="text-xs font-bold text-indigo-800 uppercase tracking-wide">
          {t("Bài đăng")} #{groupIndex + 1}
        </span>
        <span className="text-xs text-indigo-600 font-medium">
          {t("Tiêu đề")}|{t("Mô tả")}|{t("Hashtag")}|{t("Link")}|{t("Riêng tư")}|{t("Trẻ em")}|
          {t("Danh mục")}
        </span>
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 px-2 pt-2">
          {tabs.map((p) => {
            const label = SOCIAL_PLATFORMS.find((x) => x.id === p)?.label ?? p;
            const isActive = p === activePlatform;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setActivePlatform(p)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold border cursor-pointer transition-colors ${
                  isActive
                    ? "bg-white border-indigo-300 text-indigo-700 shadow-sm"
                    : "bg-transparent border-transparent text-gray-500 hover:bg-white/70"
                }`}
              >
                {PLATFORM_ICONS[p]}
                {t(label)}
              </button>
            );
          })}
        </div>
      )}

      <div className="p-3 space-y-2">
        <FieldRow
          label={t("Tiêu đề")}
          value={fields.title}
          onChange={(v) => patchField("title", v)}
          placeholder={t("Tiêu đề video đăng {{platform}}", {
            platform: t(SOCIAL_PLATFORMS.find((x) => x.id === activePlatform)?.label ?? ""),
          })}
        />
        <FieldRow
          label={t("Mô tả")}
          value={fields.description}
          onChange={(v) => patchField("description", v)}
          multiline
          placeholder={t("Mô tả bài đăng")}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FieldRow
            label={t("Hashtag")}
            value={fields.hashtag}
            onChange={(v) => patchField("hashtag", v)}
            placeholder="#tag1 #tag2"
          />
          <FieldRow
            label={t("Link")}
            value={fields.link}
            onChange={(v) => patchField("link", v)}
            placeholder="https://"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <FieldRow
            label={t("Riêng tư")}
            value={fields.privacyStatus || ""}
            onChange={(v) => patchField("privacyStatus", v)}
            placeholder="private | public | unlisted"
          />
          <FieldRow
            label={t("Trẻ em")}
            value={fields.madeForKids || ""}
            onChange={(v) => patchField("madeForKids", v)}
            placeholder="true | false"
          />
          <FieldRow
            label={t("Danh mục")}
            value={fields.categoryId || ""}
            onChange={(v) => patchField("categoryId", v)}
            placeholder="22"
          />
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-gray-200 bg-white text-gray-800 text-xs px-2.5 py-2 outline-none focus:border-indigo-400 placeholder-gray-400";
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </div>
  );
}
