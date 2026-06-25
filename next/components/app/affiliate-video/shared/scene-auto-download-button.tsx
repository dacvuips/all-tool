import { AutoDownloadSettingsButton } from "./auto-download-settings-button";
import {
  AutoDownloadImageResolution,
  getAutoDownloadDefault,
  getAutoDownloadImageResolutionDefault,
  getAutoDownloadVideoResolutionDefault,
  VideoDownloadResolution,
} from "./autoDownloadUtils";

export function SceneAutoDownloadButton({
  disabled,
  noDownload,
  autoDownloadImageResolution,
  autoDownloadVideoResolution,
  onToggle,
  onImageResolutionChange,
  onVideoResolutionChange,
  id,
}: {
  disabled?: boolean;
  noDownload?: boolean;
  autoDownloadImageResolution?: AutoDownloadImageResolution;
  autoDownloadVideoResolution?: VideoDownloadResolution;
  onToggle: () => void;
  onImageResolutionChange: (resolution: AutoDownloadImageResolution) => void;
  onVideoResolutionChange: (resolution: VideoDownloadResolution) => void;
  id?: string;
}) {
  const enabled = noDownload ?? getAutoDownloadDefault();
  const imageResolution =
    autoDownloadImageResolution ?? getAutoDownloadImageResolutionDefault();
  const videoResolution =
    autoDownloadVideoResolution ?? getAutoDownloadVideoResolutionDefault();

  return (
    <AutoDownloadSettingsButton
      id={id}
      disabled={disabled}
      enabled={enabled}
      onToggle={onToggle}
      imageResolution={imageResolution}
      videoResolution={videoResolution}
      onImageResolutionChange={onImageResolutionChange}
      onVideoResolutionChange={onVideoResolutionChange}
    />
  );
}
