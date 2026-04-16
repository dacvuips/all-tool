import { useTranslation } from "next-i18next";
import {
  AffiliateVideoFormConfig,
  ART_STYLE_OPTIONS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../../components/app/affiliate-video/constants";
import { OrderStatus, PaymentStatus, ShipmentStatusEnum } from "../repo";
import { BannerActionType } from "../repo/list/banner.repo";
import { ShippingProviderCodeEnum } from "../repo/list/shippingProvider.repo";
import { AiProviderKeyEnum } from "../repo/product/productApp.repo";
import { ThreadChannel, ThreadStatus } from "../repo/thread/thread.repo";
import {
  AffiliateBoothStatus,
  AffiliateCategoriesUnit,
  AffiliateProductApproveStatusEnum,
  AffiliateProductTypeEnum,
  BusinessTypeEnum,
  CustomerStatusEnum,
  DiscountTypeEnum,
  GameCadMode,
  GameCardStatusEnum,
  GameOrderStatusEnum,
  GameTypeEnum,
  IntroduceCustomerStatusEnum,
  Locale,
  MyUtilitesActionEnum,
  OrderTypeEnum,
  PartnerGroupStatusEnum,
  PaymentMethodEnum,
  PopupNotifyActionType,
  PopupNotifyStatusEnum,
  PopupNotifyTypeEnum,
  ProductBuyStatusEnum,
  ProductTypeEnum,
  ReportStatusEnum,
  ReportTypeEnum,
  RoleViewEnum,
  ShopBannerActionTypeEnum,
  ShopBannerTypeEnum,
  ShopProductTypeEnum,
  ShopRegisterStatusEnum,
  ShopStatusEnum,
  ShopVoucherTypeEnum,
  Target,
  Type,
  UserGender,
  UserStatus,
  UtilityStatusEnum,
  UtilityTypeEnum,
  WalletTransactionSideEnum,
  WalletTransactionTypeEnum,
  WalletTranscationStatusEnum,
} from "../repo/types";
import { WalletDrawStatusEnum } from "../repo/wallet/wallet-draw.repo";

export const useOptionsTranslation = () => {
  const { t } = useTranslation();
  const TARGETS: Option<Target>[] = [
    { value: "ALL", label: t("Tất cả"), color: "bluegray" },
    { value: "ADMIN", label: t("Quản trị"), color: "info" },
    { value: "STAFF", label: t("Nhân viên"), color: "accent" },
  ];

  const TYPE: Option<Type>[] = [
    { value: "BANNER", label: t("Banner"), color: "info" },
    { value: "POPUP", label: t("Popup"), color: "accent" },
  ];

  const ACTIVE_STATUS_OPTIONS = [
    { value: "true", label: t("Kích hoạt"), color: "success" },
    { value: "false", label: t("Ngưng kích hoạt"), color: "bluegray" },
  ];

  const COLOR_OPTIONS: Option[] = [
    { code: "#29C5FF", display: t("Xanh lơ") },
    { code: "#0287D0", display: t("Xanh dương") },
    { code: "#004790", display: t("Xanh biển") },
    { code: "#fa8072", display: t("Đỏ cá hồi") },
    { code: "#f24b3a", display: t("Đỏ tươi") },
    { code: "#B71C0C", display: t("Đỏ lựu") },
    { code: "#3EDC81", display: t("Xanh lá cây") },
    { code: "#30b848", display: t("Xanh lục") },
    { code: "#006C11", display: t("Xanh quân đội") },
    { code: "#F9BF3B", display: t("Cam cà rốt") },
    { code: "#F1892D", display: t("Cam đào") },
    { code: "#C86400", display: t("Cam bí ngô") },
    { code: "#AB69C6", display: t("Tím nho") },
    { code: "#7E349D", display: t("Tím hoàng gia") },
    { code: "#4E046D", display: t("Tím mực") },
    { code: "#FFA27B", display: t("Da người nhạt") },
    { code: "#E3724B", display: t("Da người trung") },
    { code: "#B3421B", display: t("Da người đậm") },
    { code: "#47EBE0", display: t("Ngọc trời") },
    { code: "#17BBB0", display: t("Ngọc bích") },
    { code: "#008B80", display: t("Ngọc lam") },
    { code: "#FF8CC8", display: t("Hồng phấn") },
    { code: "#EA4C88", display: t("Hồng tươi") },
    { code: "#BA1C58", display: t("Hồng nhung") },
    { code: "#EAB897", display: t("Nâu be") },
    { code: "#AE7C5B", display: t("Nâu trầm") },
    { code: "#8E5C3B", display: t("Nâu đất") },
    { code: "#ACBAC9", display: t("Màu bạc") },
    { code: "#8C9AA9", display: t("Màu sắt") },
    { code: "#3C4A59", display: t("Màu bão") },
  ].map((x) => ({ value: x.code, label: x.display, color: x.code }));

  const PRODUCT_TYPE_OPTIONS = [{ value: ProductTypeEnum.GAME_CARD, label: t("Thẻ game") }];

  const CUSTOMER_STATUS_OPTIONS = [
    { value: CustomerStatusEnum.ACTIVE, label: t("Kích hoạt"), color: "success" },
    { value: CustomerStatusEnum.INACTIVE, label: t("Không kích hoạt"), color: "bluegray" },
    { value: CustomerStatusEnum.BLOCKED, label: t("Bị khóa"), color: "danger" },
  ];

  const GAME_CARD_STATUS_OPTIONS = [
    { value: GameCardStatusEnum.ACTIVE, label: t("Kích hoạt"), color: "success" },
    { value: GameCardStatusEnum.INACTIVE, label: t("Chưa kích hoạt"), color: "bluegray" },
    { value: GameCardStatusEnum.USED, label: t("Đã sử dụng"), color: "warning" },
  ];

  const ORDER_TYPE_OPTIONS = [
    { value: OrderTypeEnum.GAME_CARD, label: t("ATM") },
    { value: OrderTypeEnum.M_POINT_CARD, label: t("M-Point") },
  ];

  const PAYMENT_METHOD_OPTIONS = [
    { value: PaymentMethodEnum.COD, label: t("Thanh toán khi nhận hàng") },
    { value: PaymentMethodEnum.BANK, label: t("Chuyển khoản ngân hàng") },
    { value: PaymentMethodEnum.MOMO, label: t("Ví MoMo") },
    { value: PaymentMethodEnum.ZALO_PAY, label: t("Ví ZaloPay") },
    { value: PaymentMethodEnum.CREDIT_CARD, label: t("Thẻ tín dụng / thẻ ghi nợ") },
  ];

  const GAME_CARD_MODE = [
    { value: GameCadMode.all, label: t("Tất cả thẻ") },
    { value: GameCadMode.limit, label: t("Số lượng thẻ giới hạn") },
  ];

  const SHOP_STATUS_OPTIONS: Option[] = [
    { value: ShopStatusEnum.ACTIVE, label: t("Kích hoạt"), color: "success" },
    { value: ShopStatusEnum.INACTIVE, label: t("Chưa kích hoạt"), color: "bluegray" },
  ];
  const AFFILIATE_BOOTH_STATUS_OPTIONS: Option[] = [
    { value: AffiliateBoothStatus.ACTIVE, label: t("Kích hoạt"), color: "success" },
    { value: AffiliateBoothStatus.INACTIVE, label: t("Ngừng hoạt động"), color: "danger" },
  ];
  const BUSINESS_TYPE_OPTIONS: Option[] = [
    { value: BusinessTypeEnum.SERVICE, label: t("Dịch vụ"), color: "pink" },
    { value: BusinessTypeEnum.ACCOUNT, label: t("Tài khoản"), color: "info" },
    { value: BusinessTypeEnum.SOFTWARE, label: t("Phần mềm"), color: "cyan" },
  ];

  const SHOP_REGISTER_STATUS_OPTIONS = [
    { value: ShopRegisterStatusEnum.PENDING, label: t("Đang chờ duyệt"), color: "bluegray" },
    { value: ShopRegisterStatusEnum.APPROVED, label: t("Đã duyệt"), color: "success" },
    { value: ShopRegisterStatusEnum.REJECTED, label: t("Bị từ chối"), color: "danger" },
  ];

  const SHOP_BANNER_TYPE_OPTIONS = [
    { value: ShopBannerTypeEnum.IMAGE, label: t("Hình ảnh") },
    { value: ShopBannerTypeEnum.YOUTUBE, label: t("Youtube") },
  ];

  const SHOP_BANNER_ACTION_TYPE_OPTIONS = [
    { value: ShopBannerActionTypeEnum.NONE, label: t("Không") },
    { value: ShopBannerActionTypeEnum.WEBSITE, label: t("Mở Website") },
  ];

  const GENDER_OPTIONS = [
    { value: UserGender.MALE, label: t("Nam"), color: "bluegray" },
    { value: UserGender.FEMALE, label: t("Nữ"), color: "success" },
    { value: UserGender.OTHER, label: t("Khác"), color: "danger" },
  ];

  const USER_STATUS_OPTIONS = [
    { value: UserStatus.INACTIVE, label: t("Ngưng kích hoạt"), color: "bluegray" },
    { value: UserStatus.ACTIVE, label: t("Kích hoạt"), color: "success" },
    { value: UserStatus.BLOCKED, label: t("Bị khóa"), color: "danger" },
  ];

  const SHOP_PRODUCT_TYPE_OPTION = [
    { value: ShopProductTypeEnum.SELL, label: t("Bán"), color: "danger" },
    { value: ShopProductTypeEnum.BUY, label: t("Mua"), color: "success" },
  ];

  const AFFILIATE_PRODUCT_TYPE_OPTION = [
    { value: AffiliateProductTypeEnum.SELL, label: t("Bán"), color: "danger" },
    // { value: AffiliateProductTypeEnum.BUY, label: t("Mua"), color: "success" },
  ];
  const SHOP_PRODUCT_ALLOWSALE_OPTION = [
    { value: true, label: t("Đã gửi phê duyệt"), color: "success" },
    { value: false, label: t("Chưa gửi phê duyệt"), color: "danger" },
  ];
  const BOOLEAN_OPTION = [
    { value: true, label: t("Kích hoạt"), color: "success" },
    { value: false, label: t("Chưa kích hoạt"), color: "danger" },
  ];
  const GROUP_TRANSACTION_THREAD_OPTION = [
    { value: "group", label: t("Nhóm giao dịch"), color: "success" },
    { value: "single", label: t("Tán gẫu riêng"), color: "danger" },
  ];

  const AFFILIATE_APPROVAL_STATUS_OPTION = [
    { value: AffiliateProductApproveStatusEnum.DRAFT, label: t("Nháp"), color: "bluegray" },
    {
      value: AffiliateProductApproveStatusEnum.PENDING,
      label: t("Đang chờ duyệt"),
      color: "warning",
    },
    { value: AffiliateProductApproveStatusEnum.APPROVED, label: t("Đã duyệt"), color: "success" },
    {
      value: AffiliateProductApproveStatusEnum.REJECTED,
      label: t("Bị từ chối duyệt"),
      color: "danger",
    },
    { value: AffiliateProductApproveStatusEnum.CANCELED, label: t("Bị hủy"), color: "danger" },
    { value: AffiliateProductApproveStatusEnum.DELETED, label: t("Đã xóa"), color: "danger" },
  ];

  const GAME_ORDER_RESULT_OPTION = [
    { value: "CANCEL", label: t("Hủy giao dịch"), color: "danger" },
    { value: "SUCCESS", label: t("Thành công"), color: "success" },
  ];

  const WALLET_TRANSACTION_TYPE_OPTIONS = [
    { value: WalletTransactionTypeEnum.DEPOSIT, label: t("Nạp mPoint"), color: "success" },
    { value: WalletTransactionTypeEnum.WITHDRAW, label: t("Rút mPoint"), color: "danger" },
    { value: WalletTransactionTypeEnum.EXCHANGE_FEE, label: t("Phí giao dịch"), color: "accent" },
    { value: WalletTransactionTypeEnum.ADJUST_BALANCE, label: t("Cân chỉnh số dư"), color: "info" },
    { value: WalletTransactionTypeEnum.MANAGE_COST, label: t("Phí quản lý"), color: "warning" },
    {
      value: WalletTransactionTypeEnum.MANAGE_COMMISSION,
      label: t("Hoa hồng quản lý"),
      color: "orange",
    },
    {
      value: WalletTransactionTypeEnum.BUY_UTILITIES_CUSTOMER,
      label: t("Khách mua tiện ích"),
      color: "teal",
    },
    {
      value: WalletTransactionTypeEnum.BUY_UTILITIES_SHOP,
      label: t("Shop mua tiện ích"),
      color: "pink",
    },
    {
      value: WalletTransactionTypeEnum.EXCHANGE_GAME_CARD,
      label: t("Đổi thẻ game"),
      color: "orange",
    },
    {
      value: WalletTransactionTypeEnum.INTRODUCE,
      label: t("Giới thiệu"),
      color: "info",
    },
    {
      value: WalletTransactionTypeEnum.AFFILIATE_ORDER,
      label: t("Đơn hàng Affiliate"),
      color: "info",
    },
    {
      value: WalletTransactionTypeEnum.DEPOSIT_WITH_PAYPAL,
      label: t("Nạp bằng Paypal"),
      color: "info",
    },
  ];

  const WALLET_TRANSACTION_SIDE_OPTIONS = [
    { value: WalletTransactionSideEnum.IN, label: t("mPoint vào"), color: "warning" },
    { value: WalletTransactionSideEnum.OUT, label: t("mPoint ra"), color: "purple" },
  ];

  const WALLET_TRANSACTION_STATUS_OPTIONS = [
    { value: WalletTranscationStatusEnum.PENDING, label: t("Đang chờ xử lý"), color: "warning" },
    { value: WalletTranscationStatusEnum.SUCCESS, label: t("Thành công"), color: "success" },
    { value: WalletTranscationStatusEnum.FAILED, label: t("Thất bại"), color: "danger" },
  ];

  const ROLES_OPTIONS: Option[] = [
    { value: "ADMIN", label: t("Quản trị"), color: "primary" },
    { value: "STAFF", label: t("Nhân viên"), color: "warning" },
    { value: "PARTNER", label: t("Cộng tác viên"), color: "orange" },
    { value: "CUSTOMER", label: t("Khách hàng"), color: "bluegray" },
  ];

  const PRODUCT_BUY_SHOP_PRODUCT_STATUS_OPTIONS = [
    { value: ProductBuyStatusEnum.PENDING, label: t("Chưa chọn mua"), color: "bluegray" },
    { value: ProductBuyStatusEnum.SELECTED, label: t("Đã chọn mua"), color: "success" },
  ];

  const SUBSCRIPTION_PLANS: Option[] = [
    { value: "FREE", label: t("Miễn phí"), color: "success" },
    { value: "MONTH", label: t("Gói tháng"), color: "info" },
    { value: "YEAR", label: t("Gói năm"), color: "danger" },
    { value: "VIP", label: t("Gói VIP"), color: "danger" },
  ];
  const POST_STATUSES: Option[] = [
    { value: "DRAFT", label: t("Bản nháp"), color: "accent" },
    { value: "PUBLIC", label: t("Công khai"), color: "success" },
  ];
  const POST_CATEGORY: Option[] = [
    { value: "NEWS", label: t("Tin tức"), color: "accent" },
    { value: "INSTRUCTIONS", label: t("Hướng dẫn"), color: "success" },
    { value: "PROMOTION", label: t("Khuyến mãi"), color: "warning" },
    { value: "EVENT", label: t("Sự kiện"), color: "danger" },
    { value: "FEATURE", label: t("Tính năng"), color: "primary" },
  ];

  const ROLE_GROUP: Option[] = [
    { value: "CUSTOMER", label: t("Khách hàng"), color: "accent" },
    { value: "SHOP", label: t("Cửa hàng"), color: "pink" },
    { value: "STAFF", label: t("Nhân viên"), color: "purple" },
    { value: "PARTNER", label: t("Cộng tác viên"), color: "info" },
    { value: "ADMIN", label: t("Admin"), color: "danger" },
    { value: "POPUP", label: t("Thông báo nhỏ"), color: "teal" },
    { value: "ALL", label: t("Tất cả"), color: "teal" },
  ];

  const BANK_VERIFIED_ROLE: Option[] = [
    { value: "CUSTOMER", label: t("Khách hàng"), color: "accent" },
    { value: "SHOP", label: t("Cửa hàng"), color: "orange" },
  ];

  const PARTNER_GROUP_STATUS_OPTIONS = [
    { value: PartnerGroupStatusEnum.ACTIVE, label: t("Đang hoạt động"), color: "success" },
    { value: PartnerGroupStatusEnum.INACTIVE, label: t("Không hoạt động"), color: "danger" },
  ];

  const PARTNER_GROUP_MANAGE_COST_RATE = [
    { value: 0, label: "0%", color: "success" },
    { value: 5, label: "5%", color: "success" },
    { value: 10, label: "10%", color: "success" },
    { value: 15, label: "15%", color: "success" },
    { value: 20, label: "20%", color: "success" },
  ];

  const CUSTOMER_CREDIT_POINT_ACTION = [
    { value: "add", label: t("Tăng điểm") },
    { value: "sub", label: t("Giảm điểm") },
  ];

  const POPUP_NOTIFY_TYPE_OPTIONS = [
    { value: PopupNotifyTypeEnum.IMAGE, label: t("Hình ảnh"), color: "accent" },
    { value: PopupNotifyTypeEnum.VIDEO, label: t("Video"), color: "orange" },
    { value: PopupNotifyTypeEnum.HTML, label: t("HTML"), color: "teal" },
  ];

  const POPUP_NOTIFY_STATUS_OPTIONS = [
    { value: PopupNotifyStatusEnum.ACTIVE, label: t("Hoạt động"), color: "success" },
    { value: PopupNotifyStatusEnum.INACTIVE, label: t("Ngừng hoạt động"), color: "danger" },
  ];

  const POPUP_NOTIFY_ACTION_TYPE_OPTIONS = [
    { value: PopupNotifyActionType.WEBSITE, label: t("Mở website"), color: "accent" },
    { value: PopupNotifyActionType.PRODUCT, label: t("Mở sản phẩm"), color: "orange" },
    { value: PopupNotifyActionType.VOUCHER, label: t("Mở voucher"), color: "teal" },
    { value: PopupNotifyActionType.SHOP, label: t("Mở cửa hàng"), color: "teal" },
    { value: PopupNotifyActionType.NORMAL, label: t("Không thao tác"), color: "teal" },
  ];

  const UTILITY_TYPE_OPTIONS = [
    { value: UtilityTypeEnum.PACKAGE, label: t("Gói dịch vụ"), color: "info" },
    { value: UtilityTypeEnum.PRIORITY, label: t("Ưu tiên"), color: "pink" },
    { value: UtilityTypeEnum.DISCOUNT, label: t("Giảm giá"), color: "orange" },
    { value: UtilityTypeEnum.TIME, label: t("Thời gian"), color: "primary" },
    { value: UtilityTypeEnum.REPUTATION, label: t("Uy tín"), color: "purple" },
    { value: UtilityTypeEnum.QUANTITY, label: t("Số lượng sản phẩm"), color: "teal" },
  ];

  const MY_UTILITES_ACTION_OPTIONS = [
    { value: MyUtilitesActionEnum.BUY, label: t("Mua"), color: "info" },
    { value: MyUtilitesActionEnum.GIFT, label: t("Tặng"), color: "warn" },
  ];
  const DISCOUNT_TYPE_OPTIONS = [
    { value: DiscountTypeEnum.PERCENT, label: t("Phần trăm"), color: "info" },
    { value: DiscountTypeEnum.FIXED, label: t("Tiền"), color: "warn" },
  ];

  const AFFILIATE_UNIT_OPTIONS = [
    { value: AffiliateCategoriesUnit.PERCENT, label: t("Phần trăm"), color: "info" },
    { value: AffiliateCategoriesUnit.FIXED, label: t("Tiền"), color: "bluegray" },
  ];

  const UTILITY_STATUS_OPTIONS = [
    { value: UtilityStatusEnum.ACTIVE, label: t("Hoạt động"), color: "success" },
    { value: UtilityStatusEnum.INACTIVE, label: t("Không hoạt động"), color: "bluegray" },
  ];

  const ROLE_VIEW_OPTIONS = [
    { value: RoleViewEnum.SHOP, label: t("Shop"), color: "success" },
    { value: RoleViewEnum.CUSTOMER, label: t("Khách hàng"), color: "bluegray" },
  ];

  const SHOP_VOUCHER_TYPE_OPTIONS = [
    { value: ShopVoucherTypeEnum.PERCENT, label: t("Phần trăm"), color: "info" },
    { value: ShopVoucherTypeEnum.FIXED, label: t("Tiền cố định"), color: "warn" },
  ];
  const SHOP_VOUCHER_USED_OPTIONS = [
    { value: true, label: t("Đã dùng"), color: "success" },
    { value: false, label: t("Chưa dùng"), color: "bluegray" },
  ];
  const SHOP_VOUCHER_HAS_OWNER_OPTIONS = [
    { value: true, label: t("Có chủ sở hữu"), color: "success" },
    { value: false, label: t("Chưa có chủ sở hữu"), color: "bluegray" },
  ];

  const INTRODUCE_CUSTOMER_STATUS_OPTIONS = [
    { value: IntroduceCustomerStatusEnum.PENDING, label: t("Chưa nhận thưởng"), color: "bluegray" },
    {
      value: IntroduceCustomerStatusEnum.REWARDED,
      label: t("Đã nhận thưởng"),
      color: "success",
    },
  ];

  const STAR_RATE_OPTIONS = [
    { value: 1, label: "⭐", color: "warn" },
    { value: 2, label: "⭐⭐", color: "warn" },
    { value: 3, label: "⭐⭐⭐", color: "warn" },
    { value: 4, label: "⭐⭐⭐⭐", color: "warn" },
    { value: 5, label: "⭐⭐⭐⭐⭐", color: "warn" },
  ];
  const MY_UTILITY_STATUS_OPTIONS = [
    { value: "EXPIRED", label: t("Hết hạn"), color: "danger" },
    { value: "STILL_VALID", label: t("Còn hạn"), color: "success" },
    { value: "USED", label: t("Đã dùng"), color: "danger" },
    { value: "USE", label: t("Còn sử dụng"), color: "success" },
  ];

  const GAME_TYPE_OPTIONS = [
    { value: GameTypeEnum.GAME, label: t("Game"), color: "info" },
    { value: GameTypeEnum.ACCOUNT, label: t("Tài khoản"), color: "success" },
    {
      value: GameTypeEnum.MARKETING,
      label: t("Marketing"),
      color: "orange",
    },
  ];

  const REPORT_TYPE_OPTIONS = [
    { value: ReportTypeEnum.PRODUCT, label: t("Sản phẩm"), color: "info" },
    { value: ReportTypeEnum.THREAD, label: t("Bài viết"), color: "success" },
  ];

  const REPORT_STATUS_OPTIONS = [
    { value: ReportStatusEnum.PENDING, label: t("Chờ xử lý"), color: "warning" },
    { value: ReportStatusEnum.PROCESSING, label: t("Đang xử lý"), color: "info" },
    { value: ReportStatusEnum.DONE, label: t("Đã xử lý"), color: "success" },
  ];

  const LOCALES: (Option<Locale> & { language: string; countryCode: string })[] = [
    {
      value: "vi",
      label: t("Tiếng Việt"),
      language: "vi-VN",
      image: "/assets/flags/vn.png",
      color: "primary",
      countryCode: "+84",
    },
    {
      value: "en",
      label: t("English"),
      language: "en-US",
      image: "/assets/flags/uk.png",
      color: "accent",
      countryCode: "+1",
    },
    {
      value: "ja",
      label: t("Tiếng Nhật"),
      language: "ja-JP",
      image: "/assets/flags/ja.png",
      color: "primary",
      countryCode: "+81",
    },
  ];

  const STREAM_ALLOWPOST_OPTION: Option<boolean>[] = [
    { value: true, label: t("Đã đăng bán"), color: "success" },
    { value: false, label: t("Chưa gửi đăng bán"), color: "" },
  ];

  const USER_ROLES_OPTION: Option[] = [
    { value: "ADMIN", label: t("Quản trị"), color: "primary" },
    { value: "STAFF", label: t("Nhân viên"), color: "warning" },
    { value: "PARTNER", label: t("Cộng tác viên"), color: "orange" },
  ];

  const SETTINGS_TABS: Option[] = [
    // { value: "general", label: "Thông tin cơ bản" },
    { value: "config", label: t("Thiết lập cửa hàng") },
    { value: "bankverified", label: t("Xác thực ngân hàng") },
    // { value: "collaborator", label: "Cộng tác viên" },
    // { value: "reward", label: "Điểm thưởng" },
    // { value: "delivery", label: "Giao hàng" },
    // { value: "payment", label: "Thanh toán" },
    // { value: "support", label: "Hỗ trợ" },
    // { value: "domain", label: "Tên miền" },
    // { value: "analytics", label: "Phân tích" },
    // { value: "bank", label: "Cập nhật ngân hàng" },
    // { value: "credit", label: "Nạp/Rút mPoint" },
    { value: "subscription", label: t("Gói dịch vụ") },
    // { value: "notification", label: "Thông báo" },
    // { value: "global_log", label: "Lịch sử chung" },
  ];

  const NOTIFICATION_TYPE: Option[] = [
    { value: "OTHER", label: t("Khác"), color: "warning" },
    { value: "ACCOUNT", label: t("Tài khoản"), color: "success" },
    { value: "TRANSACT", label: t("Giao dịch"), color: "success" },
    { value: "WALLET", label: t("Ngân hàng"), color: "success" },
    { value: "PRODUCT", label: t("Sản phẩm"), color: "success" },
    { value: "CONFIG", label: t("Cấu hình"), color: "success" },
    { value: "WEBSITE", label: t("Trang web"), color: "success" },
  ];
  const BANNER_ACTIONS: Option<BannerActionType>[] = [
    { value: "NORMAL", label: t("Không có"), color: "info" },
    { value: "WEBSITE", label: t("Trang web"), color: "primary" },
  ];

  const PAYMENT_METHOD = [
    { value: "ATM", label: t("NH nội địa(ATM)"), image: "/assets/img/atmpayment.png" },
    { value: "MPoint", label: t("mPoint"), image: "/assets/img/mPoint.jpg" },
    ,
  ];

  const THREAD_CHANNELS: Option<ThreadChannel>[] = [
    { value: "customer", label: t("khách hàng") },
    { value: "staff", label: t("nhân viên") },
  ];

  const THREAD_STATUS_OPTION: Option<ThreadStatus>[] = [
    {
      value: "new",
      label: t("Mở mới"),
      color: "accent",
    },
    {
      value: "opening",
      label: t("Đang tương tác"),
      color: "success",
    },
    {
      value: "closed",
      label: t("Đã kết thúc"),
      color: "danger",
    },
  ];

  const SUPTICKET_STATUS: Option[] = [
    {
      value: "opening",
      label: t("Mới tạo"),
      color: "success",
    },
    {
      value: "pending",
      label: t("Chờ xử lý"),
      color: "warning",
    },
    {
      value: "processing",
      label: t("Đang xử lý"),
      color: "info",
    },
    {
      value: "closed",
      label: t("Đã đóng"),
      color: "bluegray",
    },
  ];
  const SUPTICKET_SUBSTATUS: Option[] = [
    {
      value: "new",
      label: t("Mới tạo"),
      color: "pink",
    },
    {
      value: "reopening",
      label: t("Mở lại"),
      color: "danger",
    },
    {
      value: "pending",
      label: t("Chờ xử lý"),
      color: "warning",
    },
    {
      value: "considering",
      label: t("Đang xem xét"),
      color: "accent",
    },
    {
      value: "assigning",
      label: t("Đang bàn giao"),
      color: "warning",
    },
    {
      value: "request_more_info",
      label: t("Cần thêm thông tin"),
      color: "teal",
    },
    {
      value: "info_completed",
      label: t("Đã đủ thông tin"),
      color: "warning",
    },
    {
      value: "completed",
      label: t("Hoàn thành"),
      color: "success",
    },
    {
      value: "canceled",
      label: t("Đã hủy"),
      color: "bluegray",
    },
  ];

  const GAME_ORDER_STATUS_OPTION = [
    { value: GameOrderStatusEnum.PENDING, label: t("Chờ xử lý"), color: "warning" },
    { value: GameOrderStatusEnum.CONTACTING, label: t("Đang liên hệ"), color: "info" },
    { value: GameOrderStatusEnum.PROCESSING, label: t("Đang xử lý"), color: "info" },
    { value: GameOrderStatusEnum.CANCELED, label: t("Bị hủy"), color: "danger" },
    { value: GameOrderStatusEnum.REPORTED, label: t("Bị báo cáo"), color: "danger" },
    { value: GameOrderStatusEnum.COMPLETED, label: t("Hoàn thành"), color: "success" },
  ];

  const WALLET_DRAW_STATUS_OPTIONS = [
    { value: WalletDrawStatusEnum.PENDING, label: t("Chờ duyệt"), color: "warning" },
    { value: WalletDrawStatusEnum.PROCESSING, label: t("Đang xử lý"), color: "info" },
    { value: WalletDrawStatusEnum.COMPLETED, label: t("Đã hoàn thành"), color: "success" },
    { value: WalletDrawStatusEnum.CANCELED, label: t("Đã hủy"), color: "danger" },
  ];

  const ORDER_STATUS_OPTIONS = [
    { value: OrderStatus.CREATED, label: t("Tạo đơn hàng"), color: "info" },
    {
      value: OrderStatus.STATUS_CHANGED,
      label: t("Thay đổi trạng thái đơn hàng"),
      color: "warning",
    },
    {
      value: OrderStatus.PAYMENT_UPDATED,
      label: t("Cập nhật phương thức thanh toán"),
      color: "purple",
    },
    { value: OrderStatus.PAYMENT_CONFIRMED, label: t("Xác nhận thanh toán"), color: "success" },
    { value: OrderStatus.SHIPPING_STARTED, label: t("Bắt đầu giao hàng"), color: "orange" },
    { value: OrderStatus.DELIVERED, label: t("Đã giao hàng"), color: "success" },
    { value: OrderStatus.CANCELLED, label: t("Hủy đơn hàng"), color: "danger" },
    { value: OrderStatus.PROCESSING, label: t("Đang xử lý đơn hàng"), color: "info" },
    { value: OrderStatus.ORDER_UPDATED, label: t("Cập nhật đơn hàng"), color: "warning" },
  ];

  const PAYMENT_STATUS_OPTIONS = [
    { value: PaymentStatus.PAYMENT_PENDING, label: t("Chờ xác nhận thanh toán"), color: "warning" },
    { value: PaymentStatus.PAYMENT_SUCCESS, label: t("Thanh toán thành công"), color: "success" },
    { value: PaymentStatus.PAYMENT_FAILED, label: t("Thanh toán thất bại"), color: "danger" },
    { value: PaymentStatus.PAYMENT_CANCELLED, label: t("Hủy thanh toán"), color: "bluegray" },
    { value: PaymentStatus.PAYMENT_REFUNDED, label: t("Đã hoàn tiền"), color: "purple" },
    {
      value: PaymentStatus.PAYMENT_PARTIALLY_REFUNDED,
      label: t("Hoàn tiền một phần"),
      color: "orange",
    },
    { value: PaymentStatus.PAYMENT_TIMEOUT, label: t("Hết thời gian thanh toán"), color: "danger" },
  ];

  const SHIPPING_PROVIDER_CODE_OPTIONS = [
    { value: ShippingProviderCodeEnum.GHN, label: t("Giao hàng nhanh") },
    { value: ShippingProviderCodeEnum.GHTK, label: t("Giao hàng tiết kiệm") },
    { value: ShippingProviderCodeEnum.VT_POST, label: t("Viettel Post") },
    { value: ShippingProviderCodeEnum.SPX, label: t("SPX") },
    { value: ShippingProviderCodeEnum.JT_EXPRESS, label: t("J&T Express") },
  ];

  const SHIPMENT_STATUS_OPTIONS = [
    { value: ShipmentStatusEnum.DRAFT, label: t("Bản nháp"), color: "warning" },
    { value: ShipmentStatusEnum.CREATED, label: t("Đã tạo"), color: "warning" },
    { value: ShipmentStatusEnum.PICKED, label: t("Đã lấy hàng"), color: "warning" },
    { value: ShipmentStatusEnum.SHIPPING, label: t("Đang giao hàng"), color: "warning" },
    { value: ShipmentStatusEnum.DELIVERED, label: t("Đã giao hàng"), color: "warning" },
    { value: ShipmentStatusEnum.CANCELLED, label: t("Đã hủy"), color: "warning" },
    { value: ShipmentStatusEnum.RETURNED, label: t("Đã trả lại"), color: "warning" },
    { value: ShipmentStatusEnum.FAILED, label: t("Đã thất bại"), color: "warning" },
  ];

  const CREDENTIAL_KEY_OPTIONS = [
    { value: AiProviderKeyEnum.OPENAI_KEY, label: t("OpenAI"), image: "/assets/img/openai.png" },
    { value: AiProviderKeyEnum.CLAUDE_KEY, label: t("Claude"), image: "/assets/img/claudeai.png" },
    {
      value: AiProviderKeyEnum.DEEP_SEEK_KEY,
      label: t("DeepSeek"),
      image: "/assets/img/deepseek.png",
    },
    { value: AiProviderKeyEnum.KLING_KEY, label: t("Kling"), image: "/assets/img/kling.png" },
    {
      value: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
      label: t("Google Gemini"),
      image: "/assets/img/google-gemini.png",
    },
    {
      value: AiProviderKeyEnum.SEE_DANCE_KEY,
      label: t("SeeDance"),
      image: "/assets/img/see-dance.png",
    },
    {
      value: AiProviderKeyEnum.GOOGLE_LABS_API_KEY,
      label: t("Google Labs"),
      image: "/assets/img/flow.png",
    },
  ];
  const SPEED_MODE_OPTIONS: { label: string; value: SpeedMode }[] = [
    { label: t("Nhanh"), value: "fast" },
    { label: t("Thoải mái"), value: "relaxed" },
    { label: t("Chất lượng"), value: "quality" },
  ];

  const DELAY_QUEUE_OPTIONS = [
    { label: "15s", value: "15s" },
    { label: "30s", value: "30s" },
    { label: "1m", value: "1m" },
  ];

  const MODE_TAB_OPTIONS = [
    { label: t("Text"), value: "text" },
    { label: t("Ảnh đầu"), value: "start_image" },
    { label: t("Ảnh đầu cuối"), value: "start_end" },
    { label: t("Đồng bộ"), value: "sync" },
  ];

  const MAIN_TAB_OPTIONS = [
    { label: t("Đang tạo"), value: "generating" },
    { label: t("Lịch sử"), value: "history" },
  ];

  const VOICE_MODE_OPTIONS = [
    { label: t("Không"), value: "none" },
    { label: t("Trong video"), value: "in_video" },
    { label: t("Riêng biệt"), value: "separate" },
  ];

  const VIDEO_COUNT_OPTIONS = [
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
  ];

  // ── Affiliate Video: Camera Angle Options (translated) ──
  const CAMERA_ANGLE_OPTIONS = [
    { value: "close_up", label: t("Cận cảnh") },
    { value: "medium_close", label: t("Trung cận") },
    { value: "medium_shot", label: t("Trung cảnh") },
    { value: "wide_shot", label: t("Toàn cảnh") },
    { value: "extreme_wide", label: t("Viền cảnh") },
    { value: "low_angle", label: t("Góc thấp") },
    { value: "high_angle", label: t("Góc cao") },
    { value: "over_shoulder", label: t("Qua vai") },
    { value: "dutch_angle", label: t("Góc nghiêng") },
    { value: "tracking", label: t("Theo dõi") },
    { value: "pov", label: "POV" },
  ];

  // ── Affiliate Video: Built-in TTS Voice Options (translated) ──
  const BUILTIN_VOICE_OPTIONS = [
    { value: "Aoede", label: `Aoede – ${t("Nữ, tươi vui")}` },
    { value: "Charon", label: `Charon – ${t("Nam, trầm ấm")}` },
    { value: "Fenrir", label: `Fenrir – ${t("Nam, mạnh mẽ")}` },
    { value: "Kore", label: `Kore – ${t("Nữ, chuyên nghiệp")}` },
    { value: "Leda", label: `Leda – ${t("Nữ, nhẹ nhàng")}` },
    { value: "Orus", label: `Orus – ${t("Nam, điềm tĩnh")}` },
    { value: "Puck", label: `Puck – ${t("Nam, thú vị")}` },
    { value: "Zephyr", label: `Zephyr – ${t("Nam, sáng sủa")}` },
  ];

  // ── Affiliate Video: Image Style Options (translated) ──
  const IMAGE_STYLE_OPTIONS = [
    { value: "realistic", label: t("Chân thực (Realistic)") },
    { value: "3d_pixar", label: t("3D Pixar Cute") },
    { value: "pixar_realism", label: t("Pixar Realism (Nhân hoá)") },
    { value: "crochet", label: t("Len Móc (Crochet/Amigurumi)") },
    { value: "clay", label: t("Đất Sét (Claymation)") },
    { value: "diorama", label: t("Mô hình Tí hon (Diorama)") },
    { value: "lego", label: t("Đồ chơi Gạch (LEGO)") },
    { value: "mannequin", label: t("Mannequin 3D (Siêu thực)") },
    { value: "zack_doge", label: t("3D Educational Simulation (Zack D.Style)") },
    { value: "chalkboard", label: t("Bảng Phấn (Chalkboard)") },
    { value: "2d_minimalist", label: t("2D Tối Giản (Minimalist Animation)") },
    { value: "stickman", label: t("Người Que (Stickman)") },
    { value: "simpsons", label: t("Hoạt hình Simpsons") },
    { value: "business", label: t("Giải thích Doanh nghiệp (Business Explainer)") },
    { value: "cinematic_dark", label: t("Cinematic Dark Surrealism (Siêu thực Đen tối)") },
  ];

  // ── Affiliate Video: Category Options (translated) ──
  const CATEGORY_TRANSLATED_OPTIONS = [
    { value: "meo_nau_an", label: t("Mẹo Nấu Ăn") },
    { value: "meo_cuoc_song", label: t("Mẹo Vật Cuộc Sống") },
    { value: "meo_don_dep", label: t("Mẹo Don Dẹp") },
    { value: "thu_cong_diy", label: t("Thủ Công & DIY") },
    { value: "meo_hoc_tap", label: t("Mẹo Học Tập") },
    { value: "suc_khoe", label: t("Mẹo Sức Khoẻ") },
    { value: "lam_dep", label: t("Mẹo Làm Đẹp") },
    { value: "tai_chinh", label: t("Mẹo Tài Chính") },
    { value: "cong_nghe", label: t("Mẹo Công Nghệ") },
    { value: "cham_thu_cung", label: t("Mẹo Chăm Thú Cưng") },
  ];

  // ── Affiliate Video: Mood / Tone Options (translated) ──
  const MOOD_TRANSLATED_OPTIONS = [
    { value: "dynamic", label: t("Năng động & Nhiệt tình") },
    { value: "drama", label: t("Drama & Kịch tính") },
    { value: "expert", label: t("Chuyên gia khó tính") },
    { value: "hau_dau", label: t("Hậu đậu & Hài hước") },
    { value: "zen", label: t("Điềm tính (Zen)") },
    { value: "thriller", label: t("Kịch tính & Lố lăng") },
    { value: "creative", label: t("Sáng tạo & Nghệ sĩ") },
  ];

  // ── Affiliate Video: Art Style Options (translated) ──
  const ART_STYLE_TRANSLATED_OPTIONS = [
    { value: "pixar", label: t("3D Pixar") },
    { value: "realistic", label: t("Chân thực (Realistic)") },
    { value: "pixar_realism", label: t("Pixar Realism (Nhân hoá)") },
    { value: "crochet", label: t("Len Móc (Crochet/Amigurumi)") },
    { value: "clay", label: t("Đất Sét (Claymation)") },
    { value: "diorama", label: t("Mô hình Tí hon (Diorama)") },
    { value: "lego", label: t("Đồ chơi Gạch (LEGO)") },
    { value: "mannequin", label: t("Mannequin 3D (Siêu thực)") },
    { value: "zack_doge", label: t("3D Educational (Zack D.Style)") },
    { value: "chalkboard", label: t("Bảng Phấn (Chalkboard)") },
    { value: "2d_minimalist", label: t("2D Tối Giản (Minimalist)") },
    { value: "stickman", label: t("Người Que (Stickman)") },
    { value: "simpsons", label: t("Hoạt hình Simpsons") },
    { value: "business", label: t("Giải thích Doanh nghiệp") },
    { value: "cinematic_dark", label: t("Cinematic Dark Surrealism") },
  ];

  const DEFAULT_VIDEO_CONFIG: AffiliateVideoFormConfig = {
    category: CATEGORY_OPTIONS[0].label,
    objectToPersonify: "Một quả chuối tươi",
    tipContent: "Cách ăn chuối tốt nhất",
    mood: "Vui vẻ",
    language: LANGUAGE_OPTIONS[0].label,
    artStyle: ART_STYLE_OPTIONS[0].label,
    storyModeType: "image_to_video",
    aspectRatio: "9:16",
    batchSize: 1,
  };
  return {
    TARGETS,
    TYPE,
    ACTIVE_STATUS_OPTIONS,
    COLOR_OPTIONS,
    PRODUCT_TYPE_OPTIONS,
    CUSTOMER_STATUS_OPTIONS,
    GAME_CARD_STATUS_OPTIONS,
    ORDER_TYPE_OPTIONS,
    PAYMENT_METHOD_OPTIONS,
    GAME_CARD_MODE,
    SHOP_STATUS_OPTIONS,
    SHOP_REGISTER_STATUS_OPTIONS,
    SHOP_BANNER_TYPE_OPTIONS,
    SHOP_BANNER_ACTION_TYPE_OPTIONS,
    GENDER_OPTIONS,
    USER_STATUS_OPTIONS,
    SHOP_PRODUCT_TYPE_OPTION,
    SHOP_PRODUCT_ALLOWSALE_OPTION,
    BOOLEAN_OPTION,
    GROUP_TRANSACTION_THREAD_OPTION,
    GAME_ORDER_RESULT_OPTION,
    WALLET_TRANSACTION_TYPE_OPTIONS,
    WALLET_TRANSACTION_SIDE_OPTIONS,
    WALLET_TRANSACTION_STATUS_OPTIONS,
    ROLES_OPTIONS,
    PRODUCT_BUY_SHOP_PRODUCT_STATUS_OPTIONS,
    SUBSCRIPTION_PLANS,
    POST_STATUSES,
    ROLE_GROUP,
    BANK_VERIFIED_ROLE,
    PARTNER_GROUP_STATUS_OPTIONS,
    PARTNER_GROUP_MANAGE_COST_RATE,
    CUSTOMER_CREDIT_POINT_ACTION,
    POPUP_NOTIFY_TYPE_OPTIONS,
    POPUP_NOTIFY_STATUS_OPTIONS,
    POPUP_NOTIFY_ACTION_TYPE_OPTIONS,
    UTILITY_TYPE_OPTIONS,
    MY_UTILITES_ACTION_OPTIONS,
    DISCOUNT_TYPE_OPTIONS,
    UTILITY_STATUS_OPTIONS,
    ROLE_VIEW_OPTIONS,
    SHOP_VOUCHER_TYPE_OPTIONS,
    SHOP_VOUCHER_USED_OPTIONS,
    SHOP_VOUCHER_HAS_OWNER_OPTIONS,
    INTRODUCE_CUSTOMER_STATUS_OPTIONS,
    STAR_RATE_OPTIONS,
    MY_UTILITY_STATUS_OPTIONS,
    GAME_TYPE_OPTIONS,
    REPORT_TYPE_OPTIONS,
    REPORT_STATUS_OPTIONS,
    LOCALES,
    STREAM_ALLOWPOST_OPTION,
    USER_ROLES_OPTION,
    SETTINGS_TABS,
    NOTIFICATION_TYPE,
    BANNER_ACTIONS,
    PAYMENT_METHOD,
    THREAD_STATUS_OPTION,
    THREAD_CHANNELS,
    SUPTICKET_STATUS,
    SUPTICKET_SUBSTATUS,
    AFFILIATE_BOOTH_STATUS_OPTIONS,
    BUSINESS_TYPE_OPTIONS,
    AFFILIATE_UNIT_OPTIONS,
    AFFILIATE_PRODUCT_TYPE_OPTION,
    AFFILIATE_APPROVAL_STATUS_OPTION,
    GAME_ORDER_STATUS_OPTION,
    WALLET_DRAW_STATUS_OPTIONS,

    ORDER_STATUS_OPTIONS,
    PAYMENT_STATUS_OPTIONS,
    SHIPPING_PROVIDER_CODE_OPTIONS,
    SHIPMENT_STATUS_OPTIONS,
    CREDENTIAL_KEY_OPTIONS,

    SPEED_MODE_OPTIONS,
    DELAY_QUEUE_OPTIONS,
    MODE_TAB_OPTIONS,
    MAIN_TAB_OPTIONS,
    VOICE_MODE_OPTIONS,
    VIDEO_COUNT_OPTIONS,
    DEFAULT_VIDEO_CONFIG,

    // ── Affiliate Video translated options ──
    CAMERA_ANGLE_OPTIONS,
    BUILTIN_VOICE_OPTIONS,
    IMAGE_STYLE_OPTIONS,
    CATEGORY_TRANSLATED_OPTIONS,
    MOOD_TRANSLATED_OPTIONS,
    ART_STYLE_TRANSLATED_OPTIONS,
  };
};
