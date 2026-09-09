# Domain & deployment

## Production target

Vercel là target mặc định vì repo vừa phục vụ static SPA/PWA, vừa cần serverless functions `/api/config`, `/api/chat`, `/api/health` và `/api/version`. Không deploy production bằng GitHub Pages vì Pages không chạy các endpoint này.

## Thiết lập domain

1. Chọn canonical hostname do product owner sở hữu; không hardcode hostname trong source.
2. Add domain trong Vercel Project > Settings > Domains.
3. Tạo DNS record đúng theo giá trị Vercel hiển thị. Không sao chép IP cứng từ runbook vì target có thể thay đổi.
4. Chọn một canonical hostname; redirect biến thể `www`/apex còn lại về canonical.
5. Chờ TLS certificate ở trạng thái valid, sau đó kiểm tra HTTPS, PWA manifest, service worker và OAuth redirect URLs.
6. Tạo GitHub repository variable `PRODUCTION_URL=https://<canonical-hostname>`.
7. Cập nhật Supabase Authentication > URL Configuration: Site URL và allowlist redirect URLs chỉ gồm domain production/preview được phép.

## GitHub Environment

Tạo environment `production` và bật required reviewer nếu plan repository hỗ trợ. Environment secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Vercel production environment variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (publishable/anon, không phải service-role)
- `OPENAI_API_KEY`
- `OPENAI_SMALL_MODEL`, `OPENAI_STRONG_MODEL` hoặc `OPENAI_MODEL`
- `MOBILE_ALLOWED_ORIGINS` chỉ khi cần thêm native origin ngoài hai origin Capacitor mặc định.

Version được đóng gói trực tiếp từ `version.json`; không tạo environment variable khác có thể làm lệch release manifest.

## Pipeline

1. Pull request/main chạy `.github/workflows/ci.yml`.
2. Tạo tag khớp `v<version.json.version>` hoặc chạy workflow thủ công.
3. Job `verify` chặn deploy nếu syntax, build contract, readiness hoặc test thất bại.
4. Job `deploy` build một lần, deploy artifact prebuilt và smoke-test deployment URL.
5. Canonical domain được smoke-test sau deploy nếu `PRODUCTION_URL` đã cấu hình.
6. Rollback bằng Vercel Promote/Rollback tới deployment ổn định trước, không force-push Git.

Tham khảo: [Vercel CLI deployment](https://vercel.com/docs/cli/deploying-from-cli), [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).
