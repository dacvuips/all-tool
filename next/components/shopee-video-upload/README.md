# Shopee Video Upload (Frontend)

Module UI **tách riêng** khỏi logic Generate Video.

```
next/components/shopee-video-upload/
  panels/upload-flow-panel.tsx   # Quản lý luồng upload
  panels/signer-settings.tsx     # Kiểm tra signer self-host
  api/client.ts
  hooks/use-upload-jobs.ts
  types.ts
```

Bridge sang `video-affiliate-plus` chỉ để:
- Users / Proxies / Settings
- Phiên Generate Video → Tạo Luồng
- IndexedDB upload-history / merged video

Upload thật → `/api/app/shopee-video-upload/*`
