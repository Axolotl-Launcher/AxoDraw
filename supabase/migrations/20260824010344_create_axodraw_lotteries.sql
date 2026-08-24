-- AxoDraw 抽奖持久化表（由 Neon 迁移至 Supabase，结构保持一致）
create table public.axodraw_lotteries (
  code text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- 行级安全：即便未来误授权 anon/authenticated，也读不到任何行
alter table public.axodraw_lotteries enable row level security;

-- 显式授权：仅 service_role（服务端密钥，绕过 RLS）可经 Data API 访问。
-- 新项目默认不再自动暴露 public 表，此 GRANT 保证服务端读写可用。
grant select, insert, update, delete on public.axodraw_lotteries to service_role;

-- 双重保险：明确收回匿名 / 登录角色的表级权限
revoke all on public.axodraw_lotteries from anon, authenticated;