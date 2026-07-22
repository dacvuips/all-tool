# Module: Shopee Video Upload

Module **tách riêng** khỏi `affiliate-scene` / Flow2. Không import ngược từ `affiliate-scene`.

## Cấu trúc

```
src/shopee-video-upload/          # Backend (logic)
  signer/                         # stub | native → credit.toolshopee.vn
  shopee/                         # Shopee HTTP API helpers
  pipeline/                       # Orchestrator upload 1 video
  queue/                          # Job store + runner
  config.ts                       # Env config

src/routers/app/shopee-video-upload/  # Thin *.route.ts (auto-load)

next/components/shopee-video-upload/  # Frontend UI
```

## Signer URL

Không dùng trang [credit.toolshopee.vn](https://credit.toolshopee.vn) làm endpoint sign.

Dùng base IP/port self-host, ví dụ:

```env
SHOPEE_SIGNER_BASE_URL=http://178.105.110.35:47832
# hoặc dán luôn: http://178.105.110.35:47832/sign
SHOPEE_SIGNER_API_KEY=<key>
```

Gọi thực tế: `POST http://178.105.110.35:47832/sign`

Admin → Settings → **Shopee Video Upload** (`shopee-signer-base-url` / `shopee-signer-api-key`) ưu tiên hơn env.

## Pipeline

Port từ MLS `processLocalVideoUpload`:

1. `preupload` → Shopee MMS (vid)
2. CDN upload → `POST <base>/generate_token` + FormData field `token` (không phải `uploadid`)
3. `report` → Shopee MMS
4. `createPost` → credit `POST <base>/api/createpost` body `{ url, data, cookie, proxy }`

Signer `/api/sign`: body `{ url, body }` với `body` là JSON string; response `data` = header map (flat).

## Quy tắc

- Không hardcode credit URL trong logic nghiệp vụ — đọc từ Admin Settings / `SHOPEE_SIGNER_BASE_URL`
- Pipeline gọi qua `SignerClient` → adapter (`native` / `stub`)
- UI tab Đăng video Shope import từ `next/components/shopee-video-upload`
