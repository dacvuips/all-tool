/**
 * Prompt instruction khi tạo ảnh Location / Ảnh Cảnh (4 views continuity sheet).
 * Placeholder: {name}, {timeOfDay}, {description}, {aspectRatio}
 */
import type { FilmSceneImageRecord } from "./film-types";

export const FILM_LOCATION_IMAGE_PROMPT_TEMPLATE = [
  "Frame Description: Make a single image with 4 different 16:9 views of this same location with perfect continuity. One image should be a wide establishing shot of the environment, well-lit for the atmosphere of the film. There are no other people, animals, or characters in the image. No lines or text/words in the image. The other three shots of the location should be from different angles and perspectives, showing different parts of the environment.",
  "Location: {name}",
  "Time of Day: {timeOfDay}",
  "Physical Characteristics: {description}",
  "Visual Style: Hyper-realistic cinematic film still. Shallow depth of field, atmospheric lighting, ultra-high-fidelity textures. Lifelike characters exhibit visible skin pores, natural flaws, and nuanced micro-expressions within a softly focused, immersive environment. Characters ignore the camera. Uncropped full frame, textless, no letterboxing.",
].join("\n");

export function resolveFilmLocationImagePromptTemplate(custom?: string | null): string {
  const next = String(custom ?? "").trim();
  return next || FILM_LOCATION_IMAGE_PROMPT_TEMPLATE;
}

export function buildFilmLocationImagePrompt(
  location: Pick<FilmSceneImageRecord, "name" | "description" | "timeOfDay" | "context">,
  aspectRatio?: string | null,
  template?: string | null
): string {
  const name = String(location.name || "").trim() || "Unnamed Location";
  const timeOfDay =
    String(location.timeOfDay || "").trim() || String(location.context || "").trim() || "Daylight";
  const description =
    String(location.description || "").trim() || "Environment as described for the film location";
  const ar = aspectRatio === "9:16" ? "9:16" : "16:9";

  return resolveFilmLocationImagePromptTemplate(template)
    .replace(/\{name\}/g, name)
    .replace(/\{timeOfDay\}/g, timeOfDay)
    .replace(/\{description\}/g, description)
    .replace(/\{aspectRatio\}/g, ar);
}
