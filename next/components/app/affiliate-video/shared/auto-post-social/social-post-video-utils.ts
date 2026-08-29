import {
  generatedVideoToBlob,
  type GeneratedVideoLike,
} from "../generatedMediaUtils";
import type { SocialCredentialState } from "./types";

export function isSocialPlatformCredentialReady(credential: SocialCredentialState): boolean {
  return !!credential.loaded && !!credential.id && credential.active;
}

export async function generatedVideoToRawBase64(video: GeneratedVideoLike): Promise<string> {
  const blob = await generatedVideoToBlob(video);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
