export const localStorageKey = {
  blockSendEmailForgetPassword: "block_send_email_forget_password",
  accessRole: "access_role",
};

export const CONSTANTS = {
  expiredTimeBlockButtonForgetPassword: 300000,
  milliseconds30m: 1000 * 60 * 30,
  productMaxPrice: 9999999,
  excludedRoutes: ["admin", "profile", "post", "cart", "checkout"],
  PAYMENT_TIMEOUT_MINUTES: 30, // 30 phút để thanh toán
  PAYMENT_CHECK_INTERVAL: 3000, // Kiểm tra thanh toán mỗi 3 giây
  AUTO_REDIRECT_DELAY: 5, // Tự động chuyển trang sau 5 giây
};

export const ParamName = {
  search: "search",
  shopProductSearch: "search_product_shop",
  type: "type",
  minPrice: "min-price",
  maxPrice: "max-price",
  page: "page",
  sort: "sort",
  tab: "tab",
  businessType: "businessType",
  boothId: "boothId",
  categoryId: "categoryId",
  openRegisterShopMallPost: "open-register-shop-mall-post",
  productId: "productId",
  creditAmount: "creditAmount", // số tiền credit để thanh toán
};

export const CookiesName = {
  cartSessionId: "cartSessionId",
  guestName: "guestName",
  guestPhone: "guestPhone",
  guestEmail: "guestEmail",
  guestAddress: "guestAddress",
  guestProvince: "guestProvince",
  guestDistrict: "guestDistrict",
  guestWard: "guestWard",
};
