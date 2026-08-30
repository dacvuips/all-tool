import { useTranslation } from "react-i18next";
import {
  createEmptySocialPostFields,
  getSocialPostFieldMeta,
  getSocialPostHeaderFieldKeys,
  type SocialPostPlatformFields,
} from "./grouped-list/types";
import type { SocialPlatform } from "./types";

const PRIVACY_OPTIONS = ["public", "private", "unlisted"] as const;
const KIDS_OPTIONS = ["false", "true"] as const;

export function createDefaultSocialPostFormFields(
  platform: SocialPlatform,
  defaultTitle?: string
): SocialPostPlatformFields {
  const fields = createEmptySocialPostFields();
  if (defaultTitle?.trim()) {
    fields.title = defaultTitle.trim();
  }
  if (platform === "youtube" && !fields.categoryId) {
    fields.categoryId = "22";
  }
  if (!fields.privacyStatus) {
    fields.privacyStatus = platform === "facebook" ? "public" : "private";
  }
  return fields;
}

export function SocialPostPlatformPostForm({
  platform,
  fields,
  onChange,
  disabled = false,
}: {
  platform: SocialPlatform;
  fields: SocialPostPlatformFields;
  onChange: (next: SocialPostPlatformFields) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const fieldKeys = getSocialPostHeaderFieldKeys(platform);

  const patch = (key: keyof SocialPostPlatformFields, value: string) => {
    onChange({ ...fields, [key]: value });
  };

  return (
    <div className="space-y-3">
      {fieldKeys.map((key) => {
        const meta = getSocialPostFieldMeta(platform, key);
        const label = t(meta.label);
        const value = fields[key] || "";

        if (key === "privacyStatus") {
          return (
            <div key={key}>
              <label className="block mb-1 text-xs font-semibold text-gray-700">{label}</label>
              <select
                disabled={disabled}
                value={value || "private"}
                onChange={(e) => patch(key, e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PRIVACY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-10 text-gray-400">{t(meta.hint)}</p>
            </div>
          );
        }

        if (key === "madeForKids") {
          return (
            <div key={key}>
              <label className="block mb-1 text-xs font-semibold text-gray-700">{label}</label>
              <select
                disabled={disabled}
                value={value || "false"}
                onChange={(e) => patch(key, e.target.value)}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {KIDS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "true" ? t("Có") : t("Không")}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-10 text-gray-400">{t(meta.hint)}</p>
            </div>
          );
        }

        const multiline = key === "description";

        return (
          <div key={key}>
            <label className="block mb-1 text-xs font-semibold text-gray-700">{label}</label>
            {multiline ? (
              <textarea
                disabled={disabled}
                value={value}
                onChange={(e) => patch(key, e.target.value)}
                rows={4}
                placeholder={meta.templateValue}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none resize-y focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            ) : (
              <input
                type="text"
                disabled={disabled}
                value={value}
                onChange={(e) => patch(key, e.target.value)}
                placeholder={meta.templateValue}
                className="w-full px-3 py-2 text-sm text-gray-800 bg-white rounded-lg border border-gray-200 outline-none focus:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            )}
            <p className="mt-1 text-10 text-gray-400">{t(meta.hint)}</p>
          </div>
        );
      })}
    </div>
  );
}
