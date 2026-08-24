-- 访问模型：仅服务端 service_role（绕过 RLS）读写本表。
-- 为 anon / authenticated 显式添加 deny-by-default 策略：
-- 即使未来误授权表级权限，这两类角色也无法访问任何行（纵深防御）。

create policy "deny anon select"
  on public.axodraw_lotteries for select to anon using (false);

create policy "deny anon insert"
  on public.axodraw_lotteries for insert to anon with check (false);

create policy "deny anon update"
  on public.axodraw_lotteries for update to anon
  using (false) with check (false);

create policy "deny anon delete"
  on public.axodraw_lotteries for delete to anon using (false);

create policy "deny authenticated select"
  on public.axodraw_lotteries for select to authenticated using (false);

create policy "deny authenticated insert"
  on public.axodraw_lotteries for insert to authenticated with check (false);

create policy "deny authenticated update"
  on public.axodraw_lotteries for update to authenticated
  using (false) with check (false);

create policy "deny authenticated delete"
  on public.axodraw_lotteries for delete to authenticated using (false);