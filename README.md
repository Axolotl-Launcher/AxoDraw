# AxoDraw

AxoDraw 是一个黑白极简风格的可验证抽奖工具。抽奖在截止时间后 10 分钟读取 drand quicknet 公开信标，并用确定性算法生成无放回中奖结果。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

未配置数据库时，API 使用开发环境内存存储，并提供示例编码 `AXO-7K4M`。

## 存储后端：Supabase

数据持久化使用 [Supabase](https://supabase.com)（Postgres），表结构为 `public.axodraw_lotteries(code text PK, payload jsonb, updated_at timestamptz)`，行级安全已启用，仅服务端 `service_role` 密钥可访问。

### 首次配置

1. 安装 CLI：`supabase` 已加入 devDependencies（npmmirror 镜像缺少 Windows 二进制包，安装时需走官方源：`npm install supabase --save-dev --registry=https://registry.npmjs.org`）；或全局安装：`choco install supabase` / `scoop install supabase`。
2. 登录：```npx supabase login```（交互式会打开浏览器；非交互环境用 `--token` 或 `SUPABASE_ACCESS_TOKEN`）。
3. 创建项目（如 `axodraw`，区域建议 `ap-northeast-1` 东京）：```npx supabase projects create axodraw --org-id <org-id> --region ap-northeast-1```（`npx supabase orgs list` 查 org-id）。
4. 链接项目：```npx supabase link --project-ref <ref>```。
5. 应用迁移（自动创建表 + RLS + deny 策略）：```npx supabase db push```。
6. 复制 `.env.example` 为 `.env.local`，填入 Dashboard → Project Settings → API 中的 Project URL 与 secret key（`sb_secret_`，仅服务端使用）。

本地 `npm run dev` 时，未配置 `.env.local` 会回退到内存存储；配置后读写落入 Supabase。

### 安全说明

- 表 `axodraw_lotteries` 已启用 RLS 并对 `anon`/`authenticated` 添加 deny-by-default 策略，仅服务端 `service_role`（secret key）可访问；任何注册/匿名账号均无法经 Data API 读写。
- 应用不使用 Supabase Auth，**公开注册入口已关闭**；如需开启：Dashboard → Authentication → Sign In / Up → Email → "Allow new users to sign up"。

## 时间标准

全站统一以**北京时间（Asia/Shanghai，UTC+8）**为时间基准：

- 创建抽奖时，表单的截止时间按北京时间解释后以 ISO(UTC) 存储（不依赖服务器部署时区）；
- 所有面向用户的展示与错误信息（截止时间、开奖解锁时间）一律按北京时间格式化；
- 开奖在截止时间 +10 分钟后解锁，使用解锁时刻起生成的 drand 轮次，保证不可提前预测。

## Serverless API

- `POST /api/lotteries` 创建抽奖（已接入 Turnstile 人机验证，见下）
- `GET /api/lotteries/:code` 查询公开结果
- `PATCH /api/lotteries/:code` 管理链接在截止时间前修改参与值（需 `token`）
- `POST /api/lotteries/:code/draw` 使用 `token` 完成开奖
- `GET /api/lotteries/:code/verify` 查询审计状态

生产环境建议在 Vercel 上为项目设置 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY` 环境变量，并为创建/查询接口增加平台级速率限制或 Edge Middleware 限流。

### 人机验证（Cloudflare Turnstile）

创建抽奖接口（`POST /api/lotteries`）已接入 [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)（managed 模式）防止脚本批量刷量：

- 前端：`/create` 创建表单显式渲染 Turnstile widget（`src/components/turnstile-widget.tsx`），提交时携带 `cf-turnstile-response`；token 单次有效，提交失败后自动 `reset` 以便重试。
- 后端：`POST /api/lotteries` 先做 canonical `siteverify`（校验 `success === true`、action=`create-lottery`、前端 hostname 白名单），通过后才执行创建逻辑；失败一律 403。
- 环境变量：
  - `TURNSTILE_SECRET`（服务端密钥，勿暴露给浏览器）
  - `NEXT_PUBLIC_TURNSTILE_SITEKEY`（公开 sitekey）
  - `TURNSTILE_HOSTNAMES`（后端允许的前端 hostname 白名单：本地 `localhost,127.0.0.1`；生产只填真实部署域名，如 `draw.axlmc.org`）
- widget 当前注册域名：`localhost`、`127.0.0.1`、`draw.axlmc.org`（新增生产域名时需同步更新 widget 域名与 `TURNSTILE_HOSTNAMES`）。
