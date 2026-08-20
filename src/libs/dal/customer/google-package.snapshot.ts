export function snapshotGooglePackage(pkg: Record<string, any> = {}) {
  return {
    subscription: pkg.subscription,
    videoCount: pkg.videoCount,
    videoLimit: pkg.videoLimit,
    imageCount: pkg.imageCount,
    imageLimit: pkg.imageLimit,
    requestCount: pkg.requestCount,
    requestLimit: pkg.requestLimit,
    textCreditCount: pkg.textCreditCount,
    textCreditLimit: pkg.textCreditLimit,
    imageStreamCount: pkg.imageStreamCount,
    videoStreamCount: pkg.videoStreamCount,
    expiryPackageDate: pkg.expiryPackageDate,
  };
}
