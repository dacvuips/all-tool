export const PRODUCT_DATA_FRAGMENT = `productData{name description type imageUrls note service{imgUrl value} qty duration businessType amount unit isAvailable productLink}`;

export const AFFILIATE_RESULT = `result{ buyerConfirmImgUrls buyerConfirmNote sellerConfirmImgUrls sellerConfirmNote}`;
export const AFFILIATE_TIMES = `times{completedAt fullCompleteAt confirmAt}`;

export const AFFILIATE_ORDER_SELL_LIST_FRAGEMENT = `id amount code buyerId sellerId logs status reportedBy reportReason reportImageUrls paid paidDate createdAt updatedAt isPartialPayment partialAmount ${AFFILIATE_RESULT} ${PRODUCT_DATA_FRAGMENT} ${AFFILIATE_TIMES}`;
