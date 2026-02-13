import { BaseError } from "./base.error";

export class ForbiddenError extends BaseError {
  constructor(message: string) {
    super("forbidden-error", message, 403, true);
  }
}
