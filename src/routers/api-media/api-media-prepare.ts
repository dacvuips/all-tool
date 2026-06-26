import { normalizeApiMediaImageInputs } from "./api-media-media-input";
import {
  ApiMediaImageRequest,
  ApiMediaMediaInput,
  ApiMediaVideoRequest,
  validateApiMediaImageRequest,
  validateApiMediaVideoRequest,
} from "./api-media-validate";

export async function prepareApiMediaImageRequest(
  body: Record<string, unknown>
): Promise<ApiMediaImageRequest> {
  const validated = validateApiMediaImageRequest(body);
  const rawImages = body.images as ApiMediaMediaInput[] | undefined;
  const images = await normalizeApiMediaImageInputs(rawImages, "images");
  return {
    ...validated,
    images: images.length ? images : undefined,
  };
}

export async function prepareApiMediaVideoRequest(
  body: Record<string, unknown>
): Promise<ApiMediaVideoRequest> {
  const validated = validateApiMediaVideoRequest(body);
  const rawImages = body.images as ApiMediaMediaInput[] | undefined;
  const images = await normalizeApiMediaImageInputs(rawImages, "images");
  return {
    ...validated,
    images: images.length ? images : undefined,
  };
}
