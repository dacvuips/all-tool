import { User } from "./general/user.repo";
import { PaymentMethod } from "./order/order.repo";
export interface Owner {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  profile: User;
  place: Place;
}

export interface Place {
  street?: string;
  province?: string;
  provinceId?: string;
  district?: string;
  districtId?: string;
  ward?: string;
  wardId?: string;
  fullAddress?: string;
  location?: any;
  note?: string;
}

/** SortDirection */
export enum SortDirection {
  Asc = "ASC",
  Desc = "DESC",
}
export type Target = "ALL" | "ADMIN" | "STAFF";

export type Type = "BANNER" | "POPUP";

export enum ProductTypeEnum {
  GAME_CARD = "GAME_CARD",
}

export enum CustomerStatusEnum {
  ACTIVE = "ACTIVE", // Kích hoạt
  INACTIVE = "INACTIVE", // Không kích hoạt
  BLOCKED = "BLOCKED", // Bị khóa
}

export enum SubscriptionPlanEnum {
  TRIAL = "Trial",
  BASIC = "Basic",
  STANDARD = "Standard",
  PROFESSIONAL = "Professional",
  UNLIMITED = "Unlimited",
}

export type CustomerTimes = {
  registedAt?: Date; // Thời gian đăng ký
  lastLoginAt?: Date; // Thời gian đăng nhập cuối
  lastOrderAt?: Date; // Thời gian đặt hàng cuối
  emailVerifiedAt?: Date; // Thời gian xác thực email
};

export type CustomerIntro = {
  order?: boolean;
  card?: boolean;
};
export enum GameCardStatusEnum {
  ACTIVE = "active", // kích hoạt
  INACTIVE = "inactive", // chưa kích hoạt
  USED = "used", // đã sử dụng
}

export enum OrderTypeEnum {
  GAME_CARD = "GAME_CARD", // Mua thẻ game
  M_POINT_CARD = "M_POINT_CARD", // Mua thẻ M-Point
}

export enum OrderStatusEnum {
  DRAFT = "draft", // nháp
  PENDING = "pending", // chờ xử lý
  PROCESSING = "processing", // đang xử lý
  CANCELING = "canceling", // đang hủy
  CANCELED = "canceled", // đã hủy
  COMPLETED = "completed", // thành công
}

export type OrderTimes = {
  checkoutAt?: Date; // Thời gian thanh toán
  paidAt?: Date; // Thời gian thanh toán thành công
  canceledAt?: Date; // Thời gian hủy
  completedAt?: Date; // Thời gian hoàn thành
};

export type OrderItem = {
  _id: string; // Mã item
  productId: string; // Mã sản phẩm
  productType: ProductTypeEnum; // Loại sản phẩm
  name: string; // Tên sản phẩm
  quantity: number; // Số lượng
  displayPrice: number; // giá hiển thị
  originalPrice: number; // giá gốc
  subtotal: number; // Tổng tiền trước thuế
  supplierName: string; // Tên nhà cung cấp
};

export enum PaymentMethodEnum {
  COD = "COD",
  BANK = "BANK",
  MOMO = "MOMO",
  ZALO_PAY = "ZALO_PAY",
  CREDIT_CARD = "CREDIT_CARD",
}

export type Comment = {
  senderName?: string; // Tên người gủi
  content?: string; // Nội dung ghi chú
};
export enum GameCadMode {
  all = "all", //Tất cả
  limit = "limit", // giới hạn
}

export enum ShopStatusEnum {
  ACTIVE = "ACTIVE", // Active
  INACTIVE = "INACTIVE", // Inactive
}

export enum ShopRegisterStatusEnum {
  PENDING = "PENDING", // Pending
  APPROVED = "APPROVED", // Approved
  REJECTED = "REJECTED", // Rejected
}

export enum ShopBannerTypeEnum {
  IMAGE = "IMAGE", // Hình ảnh
  YOUTUBE = "YOUTUBE", // Video Youtube
}

export enum ShopBannerActionTypeEnum {
  NONE = "NONE", // Không thao tác
  WEBSITE = "WEBSITE", // Mở website
}

export enum UserGender {
  MALE = "MALE",
  FEMALE = "FEMALE",
  OTHER = "OTHER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE", // Hoạt động
  INACTIVE = "INACTIVE", // Không hoạt động
  BLOCKED = "BLOCKED", // Bị Khoá
}

export enum AuthorityStatusEnum {
  ACTIVE = "ACTIVE", // Active
  INACTIVE = "INACTIVE", // Inactive
}

export class GameProperty {
  key: string;
  value: string;
  displayValue: string;
}

export enum GamePropertyEnum {
  TEXT = "TEXT", // Text
  SELECT = "SELECT", // Select
  MULTI_SELECT = "MULTI_SELECT", // Multi select
  BOOLEAN = "BOOLEAN", // Boolean
  NUMBER = "NUMBER", //Số
  DATE = "DATE", //Ngày
}

export enum ShopProductApproveStatusEnum {
  DRAFT = "DRAFT", // Nháp
  PENDING = "PENDING", // Đang chờ duyệt
  APPROVED = "APPROVED", // Đã duyệt
  REJECTED = "REJECTED", // Từ chối
  CANCELED = "CANCELED", // Hủy giao dịch
}
export enum ShopProductTypeEnum {
  BUY = "BUY", // Mua
  SELL = "SELL", // Bán
}

export enum GameOrderStatusEnum {
  PENDING = "PENDING", // Đơn hàng đang chờ xử lý
  CONTACTING = "CONTACTING", // Đang liên hệ
  PROCESSING = "PROCESSING", // Đơn hàng đang được xử lý
  CANCELED = "CANCELED", // Đơn hàng bị hủy
  REPORTED = "REPORTED", // Đơn hàng bị báo cáo
  COMPLETED = "COMPLETED", // Đơn hàng hoàn thành
  USED_UTILITY = "USED_UTILITY", // Đơn hàng đã sử dụng tiện ích
  USED_SHOP_VOUCHER = "USED_SHOP_VOUCHER", // Đơn hàng đã sử dụng khuyến mãi cửa hàng
}

export type GameOrderTimes = {
  processingAt?: Date; // Thời gian bắt đầu xử lý đơn hàng
  canceledAt?: Date; // Thời gian hủy đơn hàng
  reportedAt?: Date; // Thời gian báo cáo đơn hàng
  completedAt?: Date; // Thời gian hoàn thành đơn hàng
  waitingAt?: Date; // Thời gian chờ đơn hàng
  applyUtilitesAt?: Date; // Thời gian áp dụng tiện ích
  applyShopVoucherAt?: Date; // Thời gian áp dụng khuyến mãi
  confirmBuyerAt?: Date; // Thời gian xác nhận bởi người mua
  confirmSellerAt?: Date; // Thời gian xác nhận bởi người bán
  confirmStaffAt?: Date; // Thời gian xác nhận bởi nhân viên
};
export type ConfirmInThread = {
  buyerConfirm?: boolean;
  sellerConfirm?: boolean;
  staffConfirm?: boolean;
};

export enum GameOrderReportByEnum {
  BUYER = "BUYER", // Báo cáo bởi người mua
  SELLER = "SELLER", // Báo cáo bởi người bán
}

export type WalletTimes = {
  lastIn: Date; // Lần nạp cuối
  lastOut: Date; // Lần rút cuối
  lastLocked: Date; // Lần khóa mPoint cuối
};

export enum WalletTransactionTypeEnum {
  DEPOSIT = "DEPOSIT", // Nạp tiền
  WITHDRAW = "WITHDRAW", // Rút tiền
  EXCHANGE_FEE = "EXCHANGE_FEE", // Phí giao dịch
  ADJUST_BALANCE = "ADJUST_BALANCE", // Cân chỉnh số dư
  MANAGE_COST = "MANAGE_COST", // Phí quản lý
  MANAGE_COMMISSION = "MANAGE_COMMISSION", // Hoa hồng quản lý

  BUY_UTILITIES_CUSTOMER = "BUY_UTILITIES_CUSTOMER", // Mua tiện ích khách hàng
  BUY_UTILITIES_SHOP = "BUY_UTILITIES_SHOP", // Mua tiện ích cửa hàng
  EXCHANGE_GAME_CARD = "EXCHANGE_GAME_CARD", // Đổi thẻ GAME
  INTRODUCE = "INTRODUCE", // Giới thiệu khách hàng
  AFFILIATE_ORDER = "AFFILIATE_ORDER", // Đơn hàng Affiliate
  DEPOSIT_WITH_PAYPAL = "DEPOSIT_WITH_PAYPA", // Nạp tiền vào ví với paypal
}

export enum WalletTransactionSideEnum {
  IN = "IN", // Giao dịch vào mPoint
  OUT = "OUT", // Giao dịch ra mPoint
}

export enum WalletTranscationStatusEnum {
  PENDING = "PENDING", // Đang chờ xử lý
  SUCCESS = "SUCCESS", // Thành công
  FAILED = "FAILED", // Thất bại
}

export enum UserRoleEnum {
  ADMIN = "ADMIN", // Admin
  CUSTOMER = "CUSTOMER", // Khách
  SHOP = "SHOP",
  STAFF = "STAFF", // Nhân viên
  PARTNER = "PARTNER", // Cộng tác viên
  SHOP_STAFF = "SHOP-STAFF",
}

export type PartnerConfig = {
  maximumOpenOrder?: number; // Số lượng đơn hàng tối đa mở
  minimumWalletBalance?: number; // Số dư mPoint tối thiểu
  maximumOrderValue?: number; // Giá trị đơn hàng tối đa
  isWithdrawExchangeFee?: boolean; // Trừ phí cộng tác viên
};
export type UserBanks = {
  bankAccount?: string; // Tên chủ tài khoản
  bankNumber?: string; // Số tài khoản
  bankName?: string; // Tên ngân hàng
};

export enum OrderSideEnum {
  BUYER = "BUYER", // Hủy bởi người mua
  SELLER = "SELLER", // Hủy bởi người bán
}
export enum ProductBuyStatusEnum {
  PENDING = "PENDING", // Mua
  SELECTED = "SELECTED", // Chọn mua
}

export type ProductBuyDataType = {
  imgUrl: string[];
  title: string;
  status: string;
  displayPrice: number;
  message: string;
  customerId: string;
};

export enum PostRoleGroup {
  CUSTOMER = "CUSTOMER", //Khách hàng
  SHOP = "SHOP", // Cửa hàng
  STAFF = "STAFF", //Nhân viên
  PARTNER = "PARTNER", // Cộng tác viên
  ADMIN = "ADMIN", //admin
  POPUP = "POPUP", // bài hiện pupup bên góc trái
  ALL = "ALL", // Tất cả
}

export enum BankVerifiedRoleEnum {
  CUSTOMER = "CUSTOMER",
  SHOP = "SHOP",
}

export enum PartnerGroupStatusEnum {
  ACTIVE = "ACTIVE", // Đang hoạt động
  INACTIVE = "INACTIVE", // Không hoạt động
}

export enum PopupNotifyTypeEnum {
  IMAGE = "IMAGE", // Hình ảnh
  VIDEO = "VIDEO", // Video
  HTML = "HTML", // HTML
}
export enum PopupNotifyStatusEnum {
  ACTIVE = "ACTIVE", // Active
  INACTIVE = "INACTIVE", // Inactive
}

export enum PopupNotifyActionType {
  WEBSITE = "WEBSITE",
  PRODUCT = "PRODUCT",
  VOUCHER = "VOUCHER",
  SHOP = "SHOP",
  NORMAL = "NORMAL",
}

export enum UtilityTypeEnum {
  PACKAGE = "PACKAGE", // gói dịch vụ
  PRIORITY = "PRIORITY", // ưu tiên
  DISCOUNT = "DISCOUNT", // giảm giá
  TIME = "TIME", // thời gian
  REPUTATION = "REPUTATION", // uy tín
  QUANTITY = "QUANTITY", // số lượng sản phẩm
}

export enum DiscountTypeEnum {
  PERCENT = "PERCENT", // phần trăm
  FIXED = "FIXED", // số tiền cố định
}
export enum MyUtilitesActionEnum {
  BUY = "BUY", // mua
  GIFT = "GIFT", // tặng
}

export enum UtilityStatusEnum {
  ACTIVE = "ACTIVE", // hoạt động
  INACTIVE = "INACTIVE", // không hoạt động
}

export enum RoleViewEnum {
  SHOP = "SHOP", // shop
  CUSTOMER = "CUSTOMER", // khách hàng
}

export enum ShopVoucherTypeEnum {
  PERCENT = "PERCENT", // phần trăm
  FIXED = "FIXED", // số tiền cố định
}

export enum IntroduceCustomerStatusEnum {
  PENDING = "PENDING",
  REWARDED = "REWARDED",
}

export enum GameOrderRateRoleTypeEnum {
  BUYER = "BUYER",
  SELLER = "SELLER",
}

export enum GameTypeEnum {
  GAME = "GAME", // Game
  ACCOUNT = "ACCOUNT", // Tài khoản
  MARKETING = "MARKETING", // Tăng tương tác (Like, Share, Comment)
}

export enum ReportTypeEnum {
  PRODUCT = "PRODUCT", // Sản phẩm
  THREAD = "THREAD", // Bài viết
  ORDER = "ORDER", // Đơn hàng
}

export enum ReportStatusEnum {
  PENDING = "PENDING", // Chờ xử lý
  PROCESSING = "PROCESSING", // Đang xử lý
  DONE = "DONE", // Đã xử lý
}

export type Locale = "vi" | "en" | "ja" | "ko";

export enum loginModeEnum {
  regis = "regis",
  login = "login",
}

export enum ShopMallStatusEnum {
  ACTIVE = "ACTIVE", // Active
  INACTIVE = "INACTIVE", // Inactive
}

export enum UtilityTabEnum {
  STILL_VALID = "STILL_VALID",
  EXPIRED = "EXPIRED",
  USED = "USED",
  USE = "USE",
}

export const UtilityTabMap = {
  [UtilityTabEnum.USE]: 0,
  [UtilityTabEnum.USED]: 1,
  [UtilityTabEnum.STILL_VALID]: 2,
  [UtilityTabEnum.EXPIRED]: 3,
};

export const UtilityTabNumberMap = {
  [0]: [UtilityTabEnum.USE],
  [1]: [UtilityTabEnum.USED],
  [2]: [UtilityTabEnum.STILL_VALID],
  [3]: [UtilityTabEnum.EXPIRED],
};

export enum BusinessTypeEnum {
  SERVICE = "SERVICE",
  ACCOUNT = "ACCOUNT",
  SOFTWARE = "SOFTWARE",
}

export enum AffiliateCategoriesStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum AffiliateBoothStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum AffiliateCategoriesUnit {
  PERCENT = "PERCENT",
  FIXED = "FIXED",
}
export enum AffiliateProductTypeEnum {
  BUY = "BUY", // Mua
  SELL = "SELL", // Bán
}
export enum AffiliateProductApproveStatusEnum {
  DRAFT = "DRAFT", // Nháp
  PENDING = "PENDING", // Đang chờ duyệt
  APPROVED = "APPROVED", // Đã duyệt
  REJECTED = "REJECTED", // Từ chối
  CANCELED = "CANCELED", // Hủy giao dịch
  DELETED = "DELETED", // Đã xóa
}

export enum AffiliateServiceStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}
export enum CheckoutOrderStatus {
  DRAFT = "draft", // Nháp
  PENDING = "pending", // Chờ thanh toán
  PROCESSING = "processing", // Đang xử lý
  CANCELING = "canceling", // Đang hủy
  CANCELED = "canceled", // Đã hủy
  COMPLETED = "completed", // Hoàn thành
}

// Phương thức thanh toán

// Trạng thái thanh toán

// Loại khách hàng
export enum CheckoutCustomerType {
  GUEST = "guest", // Khách vãng lai
  REGISTERED = "registered", // Khách đã đăng ký
}

// Bước trong quá trình checkout
export enum CheckoutStep {
  SELECT_PRODUCT = 0, // Chọn sản phẩm
  PAYMENT = 1, // Thanh toán
  COMPLETE = 2, // Hoàn tất
}

// Thông tin thanh toán Casso

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.COD]: "Thanh toán khi nhận hàng",
  [PaymentMethod.BANK]: "Chuyển khoản ngân hàng",
  [PaymentMethod.MOMO]: "Ví MoMo",
  [PaymentMethod.ZALO_PAY]: "Ví ZaloPay",
  [PaymentMethod.CREDIT_CARD]: "Thẻ tín dụng / thẻ ghi nợ",
  [PaymentMethod.SEPAY_PG]: "Thanh toán qua cổng thanh toán",
};

// Labels hiển thị cho trạng thái đơn hàng
export const ORDER_STATUS_LABELS: Record<CheckoutOrderStatus, string> = {
  [CheckoutOrderStatus.DRAFT]: "Nháp",
  [CheckoutOrderStatus.PENDING]: "Chờ thanh toán",
  [CheckoutOrderStatus.PROCESSING]: "Đang xử lý",
  [CheckoutOrderStatus.CANCELING]: "Đang hủy",
  [CheckoutOrderStatus.CANCELED]: "Đã hủy",
  [CheckoutOrderStatus.COMPLETED]: "Hoàn thành",
};
