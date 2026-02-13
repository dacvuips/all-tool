export const MY_UTILITIES_FRAGMENT = `myUtilitesId myUtilites{ utility{name} } `;
export const STAFF_DATA_FRAGMENT = `staffId staffName staffAvatar staffNote staffPhone`;
export const GAME_ORDER_BUY_LIST_FRAGEMENT = `id amount code buyerId buyerName productData {gameProperties game{name logoUrl properties} type productBuyData{title imgUrl message}} ${STAFF_DATA_FRAGMENT} ${MY_UTILITIES_FRAGMENT} logs   status canceledReason buyerNote sellerNote confirmImageUrls  times confirmInThread{buyerConfirm sellerConfirm staffConfirm} sellerRated buyerRated createdAt updatedAt`;
