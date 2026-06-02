/**
 * @deprecated Import từ `./flow2` hoặc `./flow2/image-generation`.
 * File giữ lại để tương thích import cũ.
 */
export type {
  Flow2ImageInput,
  Flow2CreateImageRequestParams as Flow2CreateRequestParams,
  GeneratedImage,
} from "./flow2/image-generation";

export {
  normalizeImageToDataUrl,
  createFlow2ImageRequest,
  extractFlow2Images,
  waitForFlow2ImageResult,
  generateImageWithFlow2,
} from "./flow2/image-generation";

export { getFlow2Config, getFlow2RequestStatus } from "./flow2/_shared";
