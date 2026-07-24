/**
 * Stub signer — Phase 1.
 * Trả header/token giả để pipeline + UI chạy được.
 * Upload Shopee thật sẽ fail nếu dryRun=false; cần native adapter.
 */
import logger from "../../../helpers/logger";
import {
  ISignerAdapter,
  SignerMeResult,
  SignerSignRequest,
  SignerSignResult,
  SignerTokenResult,
} from "../signer.interface";

export class StubSignerAdapter implements ISignerAdapter {
  readonly name = "stub";

  async sign(req: SignerSignRequest): Promise<SignerSignResult> {
    logger.warn(
      `[shopee-signer:stub] sign url=${String(req.url || "").slice(0, 80)} — header giả (cần native)`
    );
    return {
      code: 0,
      data: {
        headers: {
          "af-ac-enc-sz-token": "STUB_TOKEN_NOT_VALID_FOR_SHOPEE",
          "x-shopee-signer": "stub",
        },
      },
    };
  }

  async generateToken(): Promise<SignerTokenResult> {
    logger.warn("[shopee-signer:stub] generate_token — token giả (cần native)");
    return {
      code: 0,
      data: { token: "STUB_CDN_UPLOAD_TOKEN" },
    };
  }

  async me(): Promise<SignerMeResult> {
    return {
      code: 0,
      data: {
        username: "stub-local",
        credits: 999999,
        is_active: true,
      },
    };
  }
}
