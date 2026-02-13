export const PRODUCT_DATA_FRAGMENT = `productId productData{ name 
amount unit isAvailable description type imageUrls note service{imgUrl value} qty duration businessType productLink accounts{accountId accountName note}} `;

export const AFFILIATE_RESULT = `result{ buyerConfirmImgUrls buyerConfirmNote sellerConfirmImgUrls sellerConfirmNote}`;
export const AFFILIATE_TIMES = `times{completedAt fullCompleteAt confirmAt}`;
export const AFFILIATE_ORDER_BUY_LIST_FRAGEMENT = `id amount code buyerId sellerId logs status reportedBy reportReason reportImageUrls paid paidDate createdAt updatedAt isPartialPayment partialAmount buyerRated ${AFFILIATE_RESULT} ${PRODUCT_DATA_FRAGMENT} ${AFFILIATE_TIMES}`;
