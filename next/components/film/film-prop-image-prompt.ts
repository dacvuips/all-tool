/**
 * Prompt instruction khi tạo ảnh Prop (ecommerce product shot).
 * Placeholder: {name}, {description}
 */
import type { FilmPropRecord } from "./film-types";

export const FILM_PROP_IMAGE_PROMPT_TEMPLATE = [
  "Frame Description: A product image of just the item described against a white background. This should look like an ecommerce product shot for this used item. There are no other people, animals, or characters in the image. No lines or text/words in the image. Show the product from a tilted side angle, rear view, or three-quarter angled view as requested.",
  "Prop: {name}",
  "Physical Characteristics: {description}",
  "Aspect Ratio: 16:9",
  "Visual Style: Hyper-realistic cinematic film still. Shallow depth of field, atmospheric lighting, ultra-high-fidelity textures. Lifelike characters exhibit visible skin pores, natural flaws, and nuanced micro-expressions within a softly focused, immersive environment. Characters ignore the camera. Uncropped full frame, textless, no letterboxing. Output must be landscape 16:9.",
].join("\n");

export function resolveFilmPropImagePromptTemplate(custom?: string | null): string {
  const next = String(custom ?? "").trim();
  return next || FILM_PROP_IMAGE_PROMPT_TEMPLATE;
}

export function buildFilmPropImagePrompt(
  prop: Pick<FilmPropRecord, "name" | "description">,
  template?: string | null
): string {
  const name = String(prop.name || "").trim() || "Unnamed Prop";
  const description =
    String(prop.description || "").trim() || "Item as described for film prop design";

  return resolveFilmPropImagePromptTemplate(template)
    .replace(/\{name\}/g, name)
    .replace(/\{description\}/g, description);
}
