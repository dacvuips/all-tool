/**
 * Client gọi signer — ưu tiên adapter in-process (native → credit.toolshopee.vn).
 * Không hardcode URL; đọc từ env qua getSignerAdapter / config.
 */
import { getSignerAdapter } from "./get-adapter";
import {
  SignerCreatePostRequest,
  SignerCreatePostResult,
  SignerMeResult,
  SignerSignRequest,
  SignerSignResult,
  SignerTokenResult,
} from "./signer.interface";

export class SignerClient {
  async sign(req: SignerSignRequest): Promise<SignerSignResult> {
    return getSignerAdapter().sign(req);
  }

  async generateToken(opts?: {
    cookie?: string;
    country?: string;
  }): Promise<SignerTokenResult> {
    return getSignerAdapter().generateToken(opts);
  }

  async me(): Promise<SignerMeResult> {
    return getSignerAdapter().me();
  }

  /**
   * createPost qua credit proxy nếu adapter hỗ trợ; không thì trả code 501.
   */
  async createPost(req: SignerCreatePostRequest): Promise<SignerCreatePostResult> {
    const adapter = getSignerAdapter();
    if (typeof adapter.createPost === "function") {
      return adapter.createPost(req);
    }
    return { code: 501, message: "createPost proxy không hỗ trợ trên adapter này" };
  }
}

export const signerClient = new SignerClient();
