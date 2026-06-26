import { ApiMediaTokenModel } from "../../../libs/dal/apiMediaToken";

/** Kiểm tra token còn lượt request trước khi gọi API generate. */
export async function assertApiMediaTokenRequestQuota(apiMediaTokenId: string): Promise<void> {
  const token = await ApiMediaTokenModel.findById(apiMediaTokenId).lean();
  if (!token) {
    const err: any = new Error("API Key không hợp lệ");
    err.statusCode = 401;
    throw err;
  }
  if (!token.active) {
    const err: any = new Error("API Key đã bị vô hiệu hóa");
    err.statusCode = 403;
    throw err;
  }
  if (token.expiredDate && new Date(token.expiredDate) < new Date()) {
    const err: any = new Error("API Key đã hết hạn");
    err.statusCode = 403;
    throw err;
  }
  if (
    token.requestQuantity != null &&
    token.requestQuantity >= 0 &&
    token.usedQuantity != null &&
    token.usedQuantity >= token.requestQuantity
  ) {
    const err: any = new Error("Đã hết lượt sử dụng. Vui lòng nâng cấp gói.");
    err.statusCode = 429;
    throw err;
  }
}

/** Tăng usedQuantity sau khi generate thành công. */
export async function incrementApiMediaTokenUsage(apiMediaTokenId: string): Promise<void> {
  await ApiMediaTokenModel.findByIdAndUpdate(apiMediaTokenId, { $inc: { usedQuantity: 1 } });
}
