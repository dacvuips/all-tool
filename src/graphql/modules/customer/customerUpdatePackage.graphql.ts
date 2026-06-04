import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import logger from "../../../helpers/logger";
import { MainConnection } from "../../../helpers/mongo";
import { Scope } from "../../../libs/dal/authority";
import { CustomerModel, SubscriptionPlanEnum } from "../../../libs/dal/customer";
import { IntroduceModel } from "../../../libs/dal/introduce";
import {
  InsertNotification,
  NotificationModel,
  NotificationTarget,
} from "../../../libs/dal/notification";
import {
  PackageTransactionSnapshot,
  PackageTransactionTypeEnum,
} from "../../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../../libs/dal/packageTransaction/package-transaction.model";
import { SettingModel } from "../../../libs/dal/setting/setting.model";
import { walletService } from "../../../libs/dal/wallet";
import { Context } from "../../../libs/graphql";
import { GetWalletInfo } from "../../../libs/usecases/wallet";
import { WalletTransactionBuilder } from "../../../libs/usecases/wallet/wallet-transaction.builder";
import { NotificationBuilder } from "../notification/notificationBuilder";

/** Map SubscriptionPlanEnum → setting key prefix */
const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.FREE]: "free",
  [SubscriptionPlanEnum.TRIAL]: "trial",
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.ENTERPRISE]: "enterprise",
};

/** Giá trị mặc định cho gói Free */
const FREE_PACKAGE_DEFAULTS = {
  videoLimit: 5,
  imageLimit: 10,
  requestLimit: 5,
  imageStreamCount: 1,
  videoStreamCount: 1,
  price: 0,
};

export default {
  schema: gql`
    extend type Mutation {
      customerUpdatePackage(customerId: ID!, subscription: String!): Customer
    }
  `,
  resolver: {
    Mutation: {
      customerUpdatePackage: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-3"]]);

        const { customerId, subscription } = args;

        // Validate subscription
        if (!Object.values(SubscriptionPlanEnum).includes(subscription)) {
          throw new Error(t("Gói đăng ký không hợp lệ"));
        }

        // Lấy customer hiện tại để snapshot trước khi thay đổi
        const customer = await CustomerModel.findById(customerId).orFail(
          new Error(t("Khách hàng không tồn tại"))
        );

        const pkg = customer.googlePackage || {};

        // Snapshot BEFORE
        const beforeSnapshot: PackageTransactionSnapshot = {
          subscription: pkg.subscription,
          videoCount: pkg.videoCount,
          videoLimit: pkg.videoLimit,
          imageCount: pkg.imageCount,
          imageLimit: pkg.imageLimit,
          requestCount: pkg.requestCount,
          requestLimit: pkg.requestLimit,
          imageStreamCount: pkg.imageStreamCount,
          videoStreamCount: pkg.videoStreamCount,
          expiryPackageDate: pkg.expiryPackageDate,
        };

        // Lấy thông số gói từ Setting
        let packageConfig: {
          videoLimit: number;
          imageLimit: number;
          requestLimit: number;
          imageStreamCount: number;
          videoStreamCount: number;
          price: number;
        };

        if (subscription === SubscriptionPlanEnum.FREE) {
          packageConfig = FREE_PACKAGE_DEFAULTS;
        } else {
          const prefix = `pk-${PLAN_KEY_MAP[subscription]}`;
          const settings = await SettingModel.find({
            key: { $regex: `^${prefix}-`, $options: "i" },
          }).lean();

          const getValue = (suffix: string): number => {
            const s = settings.find((x) => x.key === `${prefix}-${suffix}`);
            return s ? Number(s.value) : 0;
          };

          packageConfig = {
            videoLimit: getValue("video-limit"),
            imageLimit: getValue("image-limit"),
            requestLimit: getValue("request-limit"),
            imageStreamCount: getValue("image-stream-count"),
            videoStreamCount: getValue("video-stream-count"),
            price: getValue("price"),
          };
        }

        // Cập nhật googlePackage
        const updateFields: Record<string, any> = {
          "googlePackage.subscription": subscription,
          "googlePackage.videoLimit": packageConfig.videoLimit,
          "googlePackage.imageLimit": packageConfig.imageLimit,
          "googlePackage.requestLimit": packageConfig.requestLimit,
          "googlePackage.imageStreamCount": packageConfig.imageStreamCount,
          "googlePackage.videoStreamCount": packageConfig.videoStreamCount,
          "googlePackage.videoCount": 0,
          "googlePackage.imageCount": 0,
          "googlePackage.requestCount": 0,
        };

        // Tự động tính expiryPackageDate theo loại gói
        const now = new Date();
        if (subscription === SubscriptionPlanEnum.FREE) {
          // Gói Free: vô thời hạn
          updateFields["googlePackage.expiryPackageDate"] = null;
        } else if (subscription === SubscriptionPlanEnum.TRIAL) {
          // Gói Trial: hạn 24 giờ
          updateFields["googlePackage.expiryPackageDate"] = new Date(
            now.getTime() + 24 * 60 * 60 * 1000
          );
        } else if (subscription) {
          // Các gói khác: hạn 1 tháng
          const expiryDate = new Date(now);
          expiryDate.setMonth(expiryDate.getMonth() + 1);
          updateFields["googlePackage.expiryPackageDate"] = expiryDate;
        }

        const updatedCustomer = await CustomerModel.findByIdAndUpdate(
          customerId,
          { $set: updateFields },
          { new: true }
        ).orFail(new Error(t("Cập nhật gói thất bại")));

        const updatedPkg = updatedCustomer.googlePackage || {};

        // Snapshot AFTER
        const afterSnapshot: PackageTransactionSnapshot = {
          subscription: updatedPkg.subscription,
          videoCount: updatedPkg.videoCount,
          videoLimit: updatedPkg.videoLimit,
          imageCount: updatedPkg.imageCount,
          imageLimit: updatedPkg.imageLimit,
          requestCount: updatedPkg.requestCount,
          requestLimit: updatedPkg.requestLimit,
          imageStreamCount: updatedPkg.imageStreamCount,
          videoStreamCount: updatedPkg.videoStreamCount,
          expiryPackageDate: updatedPkg.expiryPackageDate,
        };

        // Ghi log PackageTransaction
        await PackageTransactionModel.create({
          customerId: customerId,
          customerCode: customer.code,
          type: PackageTransactionTypeEnum.MANUAL_ADJUST,
          before: beforeSnapshot,
          after: afterSnapshot,
          description: `Admin cập nhật gói: ${beforeSnapshot.subscription || "N/A"} → ${
            afterSnapshot.subscription || "N/A"
          }`,
        });

        // === Hoa hồng giới thiệu: cộng 10% giá đơn cho người giới thiệu ===
        if (!!customerId && packageConfig.price > 0) {
          try {
            // Tìm bản ghi giới thiệu: người nạp đơn là refereeId
            const introduce = await IntroduceModel.findOne({
              refereeId: customerId,
              blocked: false,
            });

            if (introduce) {
              // Count số lượng người được referrerId giới thiệu
              const refereeCount = await IntroduceModel.countDocuments({
                referrerId: introduce.referrerId,
                blocked: false,
              });
              // Tính tỉ lệ hoa hồng theo tier số lượng người giới thiệu
              // 1–4 người: 10%, 5–9 người: 12%, 10+ người: 15%
              const bonusRate = refereeCount >= 10 ? 0.15 : refereeCount >= 5 ? 0.12 : 0.1;
              const bonusPercent = refereeCount >= 10 ? 15 : refereeCount >= 5 ? 12 : 10;
              const referralBonus = Math.round(packageConfig.price * bonusRate);

              const referrerId = introduce.referrerId.toString();
              // Cộng wallet cho người giới thiệu
              const referrerWallet = await GetWalletInfo.usecase.execute({
                ownerId: referrerId,
              });
              const referralSession = await MainConnection.startSession();
              try {
                await referralSession.withTransaction(async () => {
                  await walletService.createTransaction({
                    transaction: new WalletTransactionBuilder(referrerWallet)
                      .introduceReward({
                        amount: referralBonus,
                        description: `Hoa hồng giới thiệu ${referralBonus} (10% đơn hàng)`,
                        orderId: "",
                        orderCode: "",
                      })
                      .build(),
                    session: referralSession,
                  });
                });
              } finally {
                await referralSession.endSession();
              }

              // Thông báo cho người giới thiệu
              const referrerNotify = new NotificationBuilder(
                "Hoa hồng giới thiệu",
                `Bạn nhận được ${referralBonus} credit hoa hồng từ đơn hàng của người bạn giới thiệu`
              )
                .sendTo(NotificationTarget.CUSTOMER, referrerId)
                .build();
              InsertNotification([referrerNotify]);

              // Ghi thông tin đơn vào Introduce
              await IntroduceModel.findByIdAndUpdate(introduce._id, {
                $push: {
                  orders: {
                    discountPrice: referralBonus,
                  },
                },
              });

              logger.info(`Đã cộng hoa hồng giới thiệu`, {
                referrerId,
                refereeId: customerId.toString(),

                referralBonus,
              });
            }
          } catch (err) {
            // Không để lỗi hoa hồng ảnh hưởng tới luồng thanh toán chính
            logger.error(`Lỗi khi xử lý hoa hồng giới thiệu`, {
              err,
            });
          }
        }

        // Tạo thông báo tới customer
        const notifyTitle = `Gói dịch vụ đã được cập nhật`;
        const notifyBody = `Gói của bạn đã được điều chỉnh từ ${
          beforeSnapshot.subscription || "N/A"
        } sang ${afterSnapshot.subscription || "N/A"}.\nVideo: ${afterSnapshot.videoLimit}, Ảnh: ${
          afterSnapshot.imageLimit
        }.`;
        const notify = new NotificationBuilder(notifyTitle, notifyBody)
          .sendTo(NotificationTarget.CUSTOMER, customerId)
          .build();
        await NotificationModel.create(notify);

        return updatedCustomer;
      },
    },
  },
};
