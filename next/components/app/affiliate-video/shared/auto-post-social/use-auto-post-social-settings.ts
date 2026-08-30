import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { credentialCustomerService } from "../../../../../lib/repo";
import {
  loadAutoPostSettings,
  notifyAutoPostCredentialsChanged,
  saveAutoPostSettings,
} from "./storage";
import {
  AutoPostSocialSettings,
  createEmptyCredentialState,
  PlatformAutoPostConfig,
  SOCIAL_PLATFORM_CREDENTIAL_KEY,
  SOCIAL_PLATFORMS,
  SocialCredentialState,
  SocialPlatform,
} from "./types";

export function useAutoPostSocialSettings() {
  const { t } = useTranslation();
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
    const onCredentialsChange = () => {
      void loadCredentialsFromDb();
    };
    window.addEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
    window.addEventListener("affiliate-auto-post-credentials-changed", onCredentialsChange);
    return () => {
      window.removeEventListener("affiliate-auto-post-settings-changed", onSettingsChange);
      window.removeEventListener("affiliate-auto-post-credentials-changed", onCredentialsChange);
    };
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
      const isFacebook = input.platform === "facebook";

      try {
        if (existingId) {
          await credentialCustomerService.update({
            id: existingId,
            data: { value: val, key },
            toast: isFacebook ? undefined : toast,
          });
        } else {
          await credentialCustomerService.create({
            data: { key, value: val, active: true },
            toast: isFacebook ? undefined : toast,
          });
        }
      } catch (err: any) {
        if (isFacebook) {
          toast.error(
            err?.message
              ? `${t("Lưu Credential thất bại")}: ${err.message}`
              : t("Lưu Credential thất bại")
          );
        }
        throw err;
      }

      if (isFacebook) {
        toast.success(t("Đã lưu Page Access Token vào Credential (MongoDB)"));
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
      notifyAutoPostCredentialsChanged();
      return cred;
    },
    [credentials, toast, t]
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
      notifyAutoPostCredentialsChanged();
    },
    [credentials, toast]
  );

  const getCredential = useCallback(
    (platform: SocialPlatform) => credentials[platform],
    [credentials]
  );

  const reloadCredentials = useCallback(async () => {
    await loadCredentialsFromDb();
    notifyAutoPostCredentialsChanged();
  }, [loadCredentialsFromDb]);

  return {
    hydrated,
    settings,
    credentials,
    setEnabled,
    patchPlatform,
    saveCredential,
    removeCredential,
    getCredential,
    reloadCredentials,
  };
}
