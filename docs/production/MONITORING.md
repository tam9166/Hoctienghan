# Monitoring

## Tín hiệu

| Lớp | Tín hiệu | Ngưỡng cảnh báo ban đầu |
|---|---|---|
| Availability | `/`, `/api/health`, `/api/version` | 2 lần check liên tiếp thất bại |
| Backend | `health.backend` | Khác `ok` |
| Database | status + latency | `unreachable`, `unconfigured` trên production hoặc > 2.5 giây |
| AI | configured + request errors | Unconfigured trên production hoặc error rate tăng |
| Frontend | consent-gated local telemetry | Error lặp lại theo fingerprint/module |
| Performance | page/API/AI latency | P95 page > 3 giây hoặc API > 2 giây |
| Sync | pending queue | Queue không flush sau khi online |

`.github/workflows/production-monitor.yml` chạy mỗi 30 phút. Workflow failure là tín hiệu pager ban đầu; production owner phải bật GitHub Actions failure notifications hoặc nối một incident platform bên ngoài.

## Health contract

- `200 status=ok`: backend và dependency quan trọng sẵn sàng.
- `503 status=degraded`: database unreachable, hoặc production chưa cấu hình Supabase.
- `degradedFeatures`: tính năng có fallback, ví dụ AI.
- `release`: version, channel, commit, environment và region; không trả secret.

Không gửi raw prompt, chat, audio, journal, access token hoặc payload user vào log/monitoring. Mọi telemetry phía client tiếp tục tuân theo consent hiện có.

## Quy trình cảnh báo

1. Xác nhận bằng `node scripts/smoke-production.js https://<domain>`.
2. Ghi incident ID, thời điểm, release/commit và module bị ảnh hưởng.
3. Phân severity theo runbook Incident Response.
4. Rollback nếu lỗi bắt đầu sau release; không xóa user data để "sửa" lỗi.
