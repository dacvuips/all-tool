import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { credentialCustomerService } from "../../../../../lib/repo";
import { loadAutoPostSettings, saveAutoPostSettings } from "./storage";
import {
  AutoPostSocialSettings,
  createEmptyCredentialState,
  PlatformAutoPostConfig,
  SOCIAL_PLATFORMS,
  SocialCredentialState,
  SocialPlatform,
  SOCIAL_PLATFORM_CREDENTIAL_KEY,
} from "./types";

export function useAutoPostSocialSettings() {
  const toast = useToast();
  const [settings, setSettings] = useState<AutoPostSocialSettings>(() => loadAutoPostSettings());
  const [credentials, setCredentials] = useState<Record<SocialPlatform, SocialCredentialState>>({
    youtube: createEmptyCredentialState(),
    facebook: createEmptyCredentialState(),
    tiktok: createEmptyCredentialState(),
  });
  const [hydrated, setHydrated] = useState(false);

  const loadCredentialsFromDb = useCallback(async () => {
    const next: Record<SocialPlatform, SocialCredentialState> = {
      youtube: createEmptyCredentialState(),
      facebook: createEmptyCredentialState(),
      tiktok: createEmptyCredentialState(),
    };
    await Promise.all(
      SOCIAL_PLATFORMS.map(async (p) => {
        try {
          const cred = await credentialCustomerService.getCredentialByKey(p.credentialKey);
          next[p.id] = {
            id: cred?.id || null,
            active: !!cred?.active,
            loaded: true,
          };
        } catch {
          next[p.id] = { id: null, active: false, loaded: true };
        }
      })
    );
    setCredentials(next);
  }, []);

  useEffect(() => {
    setSettings(loadAutoPostSettings());
    setHydrated(true);
    loadCredentialsFromDb();

    const onSettingsChange = () => setSettings(loadAutoPostSettings());
    window.addEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
    return () => window.removeEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
  }, [loadCredentialsFromDb]);

  const updateSettings = useCallback(
    (updater: (prev: AutoPostSocialSettings) => AutoPostSocialSettings) => {
      setSettings((prev) => {
        const next = updater(prev);
        saveAutoPostSettings(next);
        return next;
      });
    },
    []
  );

  const setEnabled = useCallback(
    (enabled: boolean) => {
      updateSettings((prev) => ({ ...prev, enabled }));
    },
    [updateSettings]
  );

  const patchPlatform = useCallback(
    (platform: SocialPlatform, patch: Partial<PlatformAutoPostConfig>) => {
      updateSettings((prev) => ({
        ...prev,
        platforms: {
          ...prev.platforms,
          [platform]: { ...prev.platforms[platform], ...patch },
        },
      }));
    },
    [updateSettings]
  );

  const saveCredential = useCallback(
    async (input: { platform: SocialPlatform; value: string; id?: string | null }) => {
      const key = SOCIAL_PLATFORM_CREDENTIAL_KEY[input.platform];
      const val = input.value.trim();
      if (!val) return null;

      const existingId = input.id || credentials[input.platform]?.id;
      if (existingId) {
        await credentialCustomerService.update({
          id: existingId,
          data: { value: val, key },
          toast,
        });
      } else {
        await credentialCustomerService.create({
          data: { key, value: val, active: true },
          toast,
        });
      }

      const cred = await credentialCustomerService.getCredentialByKey(key);
      setCredentials((prev) => ({
        ...prev,
        [input.platform]: {
          id: cred?.id || null,
          active: !!cred?.active,
          loaded: true,
        },
      }));
      return cred;
    },
    [credentials, toast]
  );

  const removeCredential = useCallback(
    async (platform: SocialPlatform) => {
      const id = credentials[platform]?.id;
      if (!id) return;
      await credentialCustomerService.delete({ id, toast });
      setCredentials((prev) => ({
        ...prev,
        [platform]: { id: null, active: false, loaded: true },
      }));
    },
    [credentials, toast]
  );

  const getCredential = useCallback(
    (platform: SocialPlatform) => credentials[platform],
    [credentials]
  );

  return {
    hydrated,
    settings,
    credentials,
    setEnabled,
    patchPlatform,
    saveCredential,
    removeCredential,
    getCredential,
    reloadCredentials: loadCredentialsFromDb,
  };
}
