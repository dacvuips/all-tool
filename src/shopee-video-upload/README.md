# Module: Shopee Video Upload

Module **tách riêng** khỏi `affiliate-scene` / Flow2. Không import ngược từ `affiliate-scene`.

## Cấu trúc

```
src/shopee-video-upload/          # Backend (logic)
  signer/                         # Self-host signer (stub | native)
  shopee/                         # Shopee HTTP API helpers
  pipeline/                       # Orchestrator upload 1 video
  queue/                          # Job store + runner
  config.ts                       # Env config

src/routers/app/shopee-video-upload/  # Thin *.route.ts (auto-load)

next/components/shopee-video-upload/  # Frontend UI
```

## Env

```env
SHOPEE_SIGNER_BASE_URL=http://127.0.0.1:4444/api/internal/shopee-signer
SHOPEE_SIGNER_API_KEY=local-dev-key
SHOPEE_SIGNER_ADAPTER=stub
SHOPEE_UPLOAD_DRY_RUN=true
```

## Quy tắc

- Không hardcode `credit.toolshopee.vn`
- Pipeline luôn gọi qua `SignerClient`
- UI tab Đăng video Shope import từ `next/components/shopee-video-upload`
