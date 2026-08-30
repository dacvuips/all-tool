import { useEffect, useState } from "react";
import { loadAutoPostSettings } from "./storage";
import type { AutoPostSocialSettings } from "./types";

/** Chỉ đọc preference UI (bật/tắt, platform) từ localStorage — không load credential. */
export function useAutoPostSocialPreferences() {
  const [settings, setSettings] = useState<AutoPostSocialSettings>(() => loadAutoPostSettings());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadAutoPostSettings());
    setHydrated(true);
    const onSettingsChange = () => setSettings(loadAutoPostSettings());
    window.addEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
    return () =>
      window.removeEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
  }, []);

  return { settings, hydrated };
}
