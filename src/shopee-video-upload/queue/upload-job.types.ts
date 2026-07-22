/**
 * Job types cho queue upload Shopee (tách khỏi MediaGenerationJob).
 */
export enum ShopeeUploadJobStatus {
  QUEUED = "queued",
  RUNNING = "running",
  SUCCEEDED = "succeeded",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export type ShopeeUploadJobPayload = {
  cookie: string;
  country?: string;
  proxy?: string;
  caption?: string;
  productLink?: string;
  productId?: string;
  videoUrl?: string;
  videoBase64?: string;
  username?: string;
  threadId?: string;
  customerId?: string;
  /** Per-customer credit server (ưu tiên hơn env) */
  signerBaseUrl?: string;
  signerApiKey?: string;
};

export type ShopeeUploadJob = {
  id: string;
  status: ShopeeUploadJobStatus;
  createdAt: number;
  updatedAt: number;
  payload: ShopeeUploadJobPayload;
  result?: {
    postId?: string;
    postLink?: string;
    dryRun?: boolean;
  };
  error?: string;
};
