import { TimestampEntity } from "../../core";

export enum AiProviderKeyEnum {
  OPENAI_KEY = "OPENAI_KEY",
  CLAUDE_KEY = "CLAUDE_KEY",
  ANTHROPIC_KEY = "ANTHROPIC_KEY",
  GOOGLE_GEMINI_KEY = "GOOGLE_GEMINI_KEY",
  DEEP_SEEK_KEY = "DEEP_SEEK_KEY",
  KLING_KEY = "KLING_KEY",
  SORA_KEY = "SORA_KEY",
  SEE_DANCE_KEY = "SEE_DANCE_KEY",
}
export type IAiProvider = TimestampEntity & {
  key?: AiProviderKeyEnum;
  name?: string;
  imgUrl?: string;
  website?: string;
  active?: boolean;
};
