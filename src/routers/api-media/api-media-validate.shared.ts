/** Shared helpers/types for api-media validate + media input */

export type ApiMediaMediaInput =
  | string
  | { imageBytes?: string; videoBytes?: string; mimeType?: string };

export function badRequest(message: string): never {
  const err: any = new Error(message);
  err.statusCode = 400;
  throw err;
}
