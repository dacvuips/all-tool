# Shopee Scrape Local Agent

Agent chạy **trên máy khách** (cùng GemLogin). Web (domain) gọi `http://127.0.0.1:17890`.

## Domain HTTPS vs localhost

Web trên **domain HTTPS** gọi Agent `http://127.0.0.1:17890` bị Chrome **Local Network Access** chặn
trừ khi user bấm **Allow** khi trình duyệt hỏi quyền local network.
Trên `localhost` web thì không hỏi → nên “localhost được, domain không”.

Sửa nhanh: DevTools → Console xem lỗi LNA; hoặc
`chrome://settings/content/localNetworkAccess` → cho phép site của bạn.

## Cho khách (không đưa source)

Dev build bản phân phối:

```bash
yarn build-scrape-agent
```

Output: `release/shopee-scrape-agent-windows/` + `…-macos/`

| File | Mô tả |
|------|--------|
| `BatDau.bat` / `BatDau.command` | Chạy Agent; tự tải Node portable nếu máy chưa có |
| `agent.js` | Bundle Agent |
| `HUONG-DAN*.txt` | Hướng dẫn khách |

Gửi khách **cả thư mục** (zip) — không gửi repo. Không còn binary `.exe` / pkg.

## Dev local (nội bộ)

```bash
yarn build-ts
yarn scrape-agent
```

## API (localhost)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/status` | Agent + GemLogin + CDP |
| GET | `/gemlogin-status` | GemLogin online? |
| GET | `/gemlogin-profiles` | Danh sách profile |
| GET | `/cdp-status` | Cookie/CDP session |
| POST | `/open-browser` | Start profile + capture |
| POST | `/product-page` | 1 trang product list |
| POST | `/export-csv` | Xuất CSV session |

## Env

- `SCRAPE_AGENT_PORT` — mặc định `17890`
- `SCRAPE_AGENT_HOST` — mặc định `127.0.0.1`
- `GEMLOGIN_API_URL` — mặc định `http://127.0.0.1:1010`
