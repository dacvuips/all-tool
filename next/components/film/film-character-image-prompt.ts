/**
 * Prompt instruction khi tạo ảnh casting / character sheet.
 * Placeholder: {name}, {description}, {clothingAccessories}
 */
import type { FilmCharacterRecord } from "./film-types";

export const FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE = [
  'Frame Description: A character sheet with a head and shoulders shot showing the characters face on the left and a full body shot of the character on the right wearing the same clothing and accessories against a seamless white background. Bright, even lighting clearly shows the individual\'s features with minimal shadow. Their expression is neutral and forward-facing, creating an objective "asset" shot for casting. Include additional views of the same character from a side profile, rear view, and three-quarter angled view while maintaining perfect continuity in face, body proportions, hairstyle, clothing, and accessories. No lines or text/words in the image.',
  "Character: {name}",
  "Physical Characteristics: {description}",
  "Clothing and Accessories: {clothingAccessories}",
  "Aspect Ratio: 16:9",
  "Visual Style: Hyper-realistic cinematic film still. Shallow depth of field, atmospheric lighting, ultra-high-fidelity textures. Lifelike characters exhibit visible skin pores, natural flaws, and nuanced micro-expressions within a softly focused, immersive environment. Characters ignore the camera. Uncropped full frame, textless, no letterboxing. Output must be landscape 16:9.",
].join("\n");

export function resolveFilmCharacterImagePromptTemplate(custom?: string | null): string {
  const next = String(custom ?? "").trim();
  return next || FILM_CHARACTER_IMAGE_PROMPT_TEMPLATE;
}

export function buildFilmCharacterImagePrompt(
  character: Pick<FilmCharacterRecord, "name" | "description" | "clothingAccessories">,
  template?: string | null,
  extraAccessories?: string | null
): string {
  const name = String(character.name || "").trim() || "Unnamed Character";
  const description =
    String(character.description || "").trim() || "As described by character design";
  const baseClothing =
    String(character.clothingAccessories || "").trim() || "Outfit consistent with character design";
  const extra = String(extraAccessories || "").trim();
  const clothing = extra ? `${baseClothing}. Accessories/props on person: ${extra}` : baseClothing;

  return resolveFilmCharacterImagePromptTemplate(template)
    .replace(/\{name\}/g, name)
    .replace(/\{description\}/g, description)
    .replace(/\{clothingAccessories\}/g, clothing);
}
