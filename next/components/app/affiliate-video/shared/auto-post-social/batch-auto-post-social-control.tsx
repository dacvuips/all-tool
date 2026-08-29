/**
 * Switch "Tự động đăng MXH" + Setting + Play/Pause auto-post.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiPauseFill, RiPlayFill, RiSettings3Line } from "react-icons/ri";
import { useAutoPostRunState } from "./auto-post-social-run-store";
import { AutoPostSocialSettingsDialog } from "./auto-post-social-settings-dialog";
import { useAutoPostSocialSettings } from "./use-auto-post-social-settings";

export interface BatchAutoPostSocialControlProps {
  /** Bắt đầu pipeline gen → nối → đăng */
  onPlay?: () => void;
  /** Dừng pipeline */
  onStop?: () => void;
  /** Chặn Play khi batch khác đang chạy */
  playDisabled?: boolean;
}

export function BatchAutoPostSocialControl({
  onPlay,
  onStop,
  playDisabled = false,
}: BatchAutoPostSocialControlProps = {}) {
  const { t } = useTranslation();
  const {
    settings,
    setEnabled,
    hydrated,
    credentials,
    patchPlatform,
    saveCredential,
    removeCredential,
    reloadCredentials,
  } = useAutoPostSocialSettings();
  const [showSettings, setShowSettings] = useState(false);
  const runState = useAutoPostRunState();

  const enabled = hydrated ? settings.enabled : false;
  const running = runState.running;

  return (
    <>
      <div
        id="batch-auto-post-social"
        className="flex items-center flex-shrink-0 pl-2 ml-0.5 border-l border-gray-200"
      >
        <div
          className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors ${
            enabled
              ? "border-indigo-200 bg-indigo-50"
              : "border-gray-200 bg-slate-50 hover:border-gray-300"
          }`}
        >
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            title={t("Tự động đăng MXH")}
            onClick={() => setEnabled(!enabled)}
            disabled={running}
            className={`relative w-9 h-5 rounded-full border-0 cursor-pointer transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
              enabled ? "bg-indigo-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>

          <span
            className={`text-xs font-semibold whitespace-nowrap select-none ${
              running ? "cursor-default" : "cursor-pointer"
            } ${enabled ? "text-indigo-700" : "text-gray-600"}`}
            onClick={() => {
              if (!running) setEnabled(!enabled);
            }}
          >
            {t("Tự động đăng MXH")}
          </span>

          {enabled && (
            <button
              type="button"
              id="batch-auto-post-social-setting"
              onClick={() => setShowSettings(true)}
              disabled={running}
              className="flex items-center gap-1 ml-0.5 px-2 py-1 rounded-md text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-100 cursor-pointer transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RiSettings3Line className="text-sm" />
              {t("Setting")}
            </button>
          )}

          {enabled && (
            <button
              type="button"
              id="batch-auto-post-social-play"
              title={
                running
                  ? runState.statusLabel || t("Dừng")
                  : t("Chạy auto-post MXH (gen → nối → đăng)")
              }
              onClick={() => (running ? onStop?.() : onPlay?.())}
              disabled={!running && (playDisabled || !onPlay)}
              className={`flex items-center justify-center w-6 h-6 rounded-md border cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                running
                  ? "text-white bg-red-500 border-red-500 hover:bg-red-600"
                  : "text-white bg-indigo-600 border-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {running ? (
                <RiPauseFill className="text-base" />
              ) : (
                <RiPlayFill className="text-base" />
              )}
            </button>
          )}
        </div>

        {enabled && running && runState.statusLabel && (
          <span
            className="ml-2 max-w-[220px] text-10 text-indigo-600 truncate"
            title={runState.statusLabel}
          >
            {runState.statusLabel}
          </span>
        )}
      </div>

      <AutoPostSocialSettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        credentials={credentials}
        patchPlatform={patchPlatform}
        saveCredential={saveCredential}
        removeCredential={removeCredential}
        reloadCredentials={reloadCredentials}
      />
    </>
  );
}
