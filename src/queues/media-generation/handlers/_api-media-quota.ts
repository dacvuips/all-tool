import { ApiMediaTokenModel } from "../../../libs/dal/apiMediaToken";
import logger from "../../../helpers/logger";

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

/**
 * Tăng usedQuantity sau khi job SUCCEEDED.
 * Có giới hạn (`requestQuantity >= 0`): chỉ tăng khi còn lượt (atomic).
 * Không giới hạn (`requestQuantity` null hoặc < 0): luôn tăng.
 */
export async function incrementApiMediaTokenUsage(apiMediaTokenId: string): Promise<void> {
  const limited = await ApiMediaTokenModel.findOneAndUpdate(
    {
      _id: apiMediaTokenId,
      requestQuantity: { $gte: 0 },
      $expr: {
        $lt: [{ $ifNull: ["$usedQuantity", 0] }, "$requestQuantity"],
      },
    },
    { $inc: { usedQuantity: 1 } },
    { new: true }
  );
  if (limited) return;

  // Token không giới hạn lượt (requestQuantity null / âm) — vẫn ghi nhận usage
  const unlimited = await ApiMediaTokenModel.findOneAndUpdate(
    {
      _id: apiMediaTokenId,
      $or: [{ requestQuantity: null }, { requestQuantity: { $lt: 0 } }],
    },
    { $inc: { usedQuantity: 1 } },
    { new: true }
  );

  if (!unlimited) {
    logger.warn(
      `[api-media-quota] Không tăng usedQuantity cho token ${apiMediaTokenId} (hết lượt do race hoặc token không tồn tại)`
    );
  }
}
