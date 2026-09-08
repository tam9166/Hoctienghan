# Production operations

P55 chọn Vercel cho static PWA và serverless `/api/*`, Supabase cho Auth/Postgres, GitHub Actions cho validation/deployment/uptime smoke check. Không có domain, project ID hay secret thật trong repository.

## Runbooks

- [Domain & deployment](DOMAIN_DEPLOYMENT.md)
- [Monitoring](MONITORING.md)
- [Backup & restore](BACKUP_RESTORE.md)
- [Incident response](INCIDENT_RESPONSE.md)
- [User support](USER_SUPPORT.md)
- [Release checklist](RELEASE_CHECKLIST.md)
- [Version management](VERSION_MANAGEMENT.md)

## Trạng thái readiness

Chạy `node scripts/release-readiness.js`. Kết quả `passed` xác nhận artifact trong repo; các warning là bước vận hành cần owner hoàn thành trên Vercel, Supabase, DNS và GitHub Environment.
