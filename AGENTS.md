<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 部署架构与运维约定

## 仓库拓扑（为什么有 fork）

- **上游（权威代码）**：`https://github.com/Axolotl-Launcher/AxoDraw`（org 仓库，public）。日常改代码、合 PR 都发生在这里。
- **部署镜像（fork）**：`https://github.com/Mystic-Stars/AxoDraw`。Vercel 接不了 org 仓库（GitHub App 无 org 授权），所以生产部署走 fork。
- **数据流**：org `main` →（fork 每小时自动 fast-forward 同步）→ fork `main` →（Vercel Git 集成自动部署）→ `draw.axlmc.org`。

## 自动更新链路（fork 上的两个 workflow）

两个 workflow 文件**只存在于 fork**，上游仓库没有；org→fork 的同步是 fast-forward，不会把它们删掉，也不会被上游同名文件覆盖：

1. `.github/workflows/sync-fork.yml` — 每小时第 17 分钟（cron `17 * * * *`）+ 手动触发。把 org 的 `main` fast-forward 合并进 fork 并 push；fork 若有本地提交导致非 fast-forward 会失败（可见的红色告警）。
2. `.github/workflows/supabase-migrate.yml` — 推送涉及 `supabase/migrations/**` 时自动跑 `supabase db push`（也可手动触发）。⚠️ **必须在 GitHub Runner 上跑**：开发机到 Supabase pooler 的 TLS 握手会被出口网络阻断（TCP 通、TLS 直接 EOF），本机 `supabase db push` 必然失败，不要在本机尝试。

## 线上组件

| 组件 | 位置 / 值 |
|---|---|
| 网站 | `https://draw.axlmc.org`（生产源 `https://axodraw.vercel.app`） |
| Vercel 项目 | `axodraw`（team `stars-projects-49a5c865`，project id `prj_A9AzQqWVLjMiJSrYOqZm32eGjcGW`） |
| Vercel 域名 | `draw.axlmc.org`，DNS 目标**随项目而非域名固定**（当前 CNAME → `150995764bc9fd6b.vercel-dns-017.com`，DNS-only；换新项目后以 `vercel domains inspect` 输出为准） |
| Supabase | ref `uetylxulrahmqmfzfzdr`（项目名 axodraw，东京 ap-northeast-1，org `oidqqldkrcikyqvwnxgu`）；表 `public.axodraw_lotteries`，RLS 仅 `service_role` 可读写，应用不用 Auth |
| Cloudflare | zone `axlmc.org`（id `5e8204d88b188634e04906ff31bfff64`）；Turnstile widget `axodraw-create`（sitekey `0x4AAAAAAEZpaCqG0XhQgJZm`，注册域名 localhost / 127.0.0.1 / draw.axlmc.org） |

## 环境变量

**Vercel（production + preview 各一份）**：

| 变量 | 值 / 来源 | 可见性 |
|---|---|---|
| `SUPABASE_URL` | `https://uetylxulrahmqmfzfzdr.supabase.co` | sensitive |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API 的 secret key（`sb_secret_…`） | sensitive |
| `TURNSTILE_SECRET` | Cloudflare Dashboard → Turnstile 服务端密钥 | sensitive |
| `TURNSTILE_HOSTNAMES` | 生产为 `draw.axlmc.org`（逗号分隔白名单，勿留 localhost） | sensitive |
| `NEXT_PUBLIC_TURNSTILE_SITEKEY` | 公开 sitekey | config |

注意：team 策略把 production/preview 环境变量强制为 sensitive，因此 `NEXT_PUBLIC_` 变量必须用 `--no-sensitive --visibility config` 添加，否则被拒。

**本地 `.env.local`**（gitignored，禁止提交）：同五个变量 + `SUPABASE_DB_PASSWORD`（仅 CLI/psql 用）。`vercel link` 会在 .env.local 尾部追加 `VERCEL_OIDC_TOKEN`，本地工具用，忽略即可。

**fork 的 Actions secrets**：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`（供迁移 workflow 使用）。

## 常用操作

```bash
# 推送代码（上游；fork 每小时 :17 自动同步 → Vercel 自动部署）
git push origin main
# 想立即生效：fork 的 Actions → "Sync fork from upstream" → Run workflow

# Vercel CLI（本机已登录 mystic-stars）
vercel deploy --prod --yes                        # 手动用当前目录部署生产
vercel env add <NAME> production --value <V>      # 加变量；NEXT_PUBLIC_ 加 --no-sensitive --visibility config
vercel domains inspect draw.axlmc.org             # 看当前 DNS 目标
vercel domains verify draw.axlmc.org              # 校验 DNS 配置

# Supabase（access token 在 Windows 凭据管理器，目标 "Supabase CLI:supabase"，不是文件）
npx supabase link --project-ref uetylxulrahmqmfzfzdr
# 迁移一律走 fork 的 supabase-migrate.yml，不要在本机 db push

# Cloudflare DNS（wrangler OAuth 仅 zone 只读，改 DNS 必须用 API token）
# Authorization: Bearer <cfat_…>；GET/POST/DELETE /client/v4/zones/<zone-id>/dns_records
```

## 凭据存放位置（不要写进仓库，也不要写进本文件）

- GitHub：gh keyring，账号 `Mystic-Stars`（org `Axolotl-Launcher` 成员，可建组织仓库）
- Vercel：CLI 登录态（用户 `mystic-stars`，team `stars-projects-49a5c865`）
- Supabase：Windows 凭据管理器 `Supabase CLI:supabase`（CredRead 读取，44 字符 `sbp_…`）；数据库密码在 `.env.local`
- Cloudflare：用户提供的 API token `cfat_…`（`/user/tokens/verify` 对该格式返回 401 是已知现象，直接调 API 正常）

## 发布检查清单

- [ ] `npm run lint` 通过
- [ ] push 到 org `main` 后确认 fork 同步（`gh run list -R Mystic-Stars/AxoDraw`）且 Vercel 部署成功
- [ ] 页面与 API 冒烟：`GET https://draw.axlmc.org/` 200；`POST /api/lotteries` 无验证码应 403；`GET /api/lotteries/<未知编码>` 应 404
- [ ] 改过 `supabase/migrations/` → 确认 fork 的 "Supabase DB migrations" workflow 成功
- [ ] 改过 env/域名 → `vercel env` 与 `vercel domains verify draw.axlmc.org` 复核；改过 Turnstile 域名 → widget 注册域名与 `TURNSTILE_HOSTNAMES` 同步更新