import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../lib/providers/toast-provider";
import { Button, Field, Input, Switch } from "../../shared/utilities/form";
import { AffiliatePlusSettings } from "../types";

interface SettingsPanelProps {
  settings: AffiliatePlusSettings;
  onUpdateSettings: (settings: AffiliatePlusSettings) => void;
}

export function SettingsPanel({ settings, onUpdateSettings }: SettingsPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState({ ...settings });

  const handleSave = () => {
    onUpdateSettings(form);
    toast.success(t("Đã lưu cài đặt"));
  };

  return (
    <div className="max-w-lg space-y-5">
      <h3 className="text-sm font-bold text-gray-700 m-0">{t("Cài đặt hệ thống")}</h3>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <Field label={t("Giờ chạy lại tự động")}>
          <Input
            value={form.scheduleTime}
            onChange={(v) => setForm((f) => ({ ...f, scheduleTime: v }))}
            placeholder="07:00"
          />
        </Field>
        <Field label={t("Delay tối thiểu (giây)")}>
          <Input
            number
            value={form.defaultDelayMin}
            onChange={(v) => setForm((f) => ({ ...f, defaultDelayMin: Number(v) || 0 }))}
          />
        </Field>
        <Field label={t("Delay tối đa (giây)")}>
          <Input
            number
            value={form.defaultDelayMax}
            onChange={(v) => setForm((f) => ({ ...f, defaultDelayMax: Number(v) || 0 }))}
          />
        </Field>
        <Field label={t("Quốc gia mặc định")}>
          <Input
            value={form.defaultCountry}
            onChange={(v) => setForm((f) => ({ ...f, defaultCountry: v }))}
            placeholder="VN"
          />
        </Field>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{t("Tự động retry lỗi")}</span>
          <Switch
            value={form.autoRetry}
            onChange={(v) => setForm((f) => ({ ...f, autoRetry: v }))}
          />
        </div>
        <Button primary text={t("Lưu cài đặt")} onClick={handleSave} />
      </div>
    </div>
  );
}
