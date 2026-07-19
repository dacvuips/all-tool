/**
 * Native signer — Phase 2 placeholder.
 * Sau khi reverse/capture thuật toán từ MLS → implement thật tại đây.
 * Hiện tại: trả lỗi rõ ràng nếu chọn adapter=native mà chưa implement.
 */
import {
  ISignerAdapter,
  SignerMeResult,
  SignerSignRequest,
  SignerSignResult,
  SignerTokenResult,
} from "../signer.interface";

const NOT_READY =
  "Native signer chưa implement — capture traffic MLS ↔ credit rồi bổ sung thuật toán ký tại native.signer.ts";

export class NativeSignerAdapter implements ISignerAdapter {
  readonly name = "native";

  async sign(_req: SignerSignRequest): Promise<SignerSignResult> {
    return { code: 501, message: NOT_READY };
  }

  async generateToken(): Promise<SignerTokenResult> {
    return { code: 501, message: NOT_READY };
  }

  async me(): Promise<SignerMeResult> {
    // Quota nội bộ sẽ gắn Mongo/Redis ở Phase 2
    return {
      code: 501,
      message: NOT_READY,
      data: {
        username: "native-pending",
        credits: 0,
        is_active: false,
      },
    };
  }
}
