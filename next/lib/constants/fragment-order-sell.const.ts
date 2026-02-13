export const SHOP_VOUCHER_FRAGMENT = `shopVoucherId shopVoucher{name}  `;
export const MY_UTILITIES_FRAGMENT = `myUtilitesId myUtilites{ utility{name} } `;
export const GAME_SIMPLE_FRAGMENT = `name logoUrl properties`;
export const PRODUCT_DATA_FRAGMENT = `name description type imageUrls gameProperties game  { ${GAME_SIMPLE_FRAGMENT} }`;
export const STAFF_DATA_FRAGMENT = `staffId staffName staffAvatar staffNote staffPhone`;
export const GAME_ORDER_SELL_LIST_FRAGEMENT = `id amount code buyerId buyerName productData { ${PRODUCT_DATA_FRAGMENT} } ${STAFF_DATA_FRAGMENT} ${MY_UTILITIES_FRAGMENT} ${SHOP_VOUCHER_FRAGMENT} logs   status canceledReason buyerNote sellerNote confirmImageUrls  times confirmInThread{buyerConfirm sellerConfirm staffConfirm} sellerRated buyerRated  createdAt updatedAt`;
