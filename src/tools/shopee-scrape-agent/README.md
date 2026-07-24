# Shopee Scrape Local Agent

Agent chạy **trên máy khách** (cùng GemLogin). Web (domain) gọi `http://127.0.0.1:17890`.

## Cho khách (không đưa source)

Dev build bản phân phối:

```bash
yarn build-scrape-agent
```

Output: `release/shopee-scrape-agent/`

| File | Mô tả |
|------|--------|
| `ShopeeScrapeAgent.exe` | Chạy double-click (không cần Node/source) |
| `BatDau.bat` | Shortcut Windows |
| `HUONG-DAN.txt` | Hướng dẫn khách |
| `agent.js` | Fallback nếu chưa có exe (cần Node) |

Gửi khách **cả thư mục** (zip) — không gửi repo.

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
