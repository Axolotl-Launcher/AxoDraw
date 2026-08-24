"use client";

import { ChangeEvent, FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Sparkles, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyButton } from "@/components/copy-button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { TurnstileWidget, turnstileSitekey } from "@/components/turnstile-widget";
import { entries, Lottery } from "@/lib/lottery";

export function CreateDraw() {
  const router = useRouter();
  const [created, setCreated] = useState<Lottery | null>(null);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  const [entriesText, setEntriesText] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", deadline: "", winnerCount: "1", duplicatePolicy: "keep" as "keep" | "dedupe" });
  const stats = useMemo(() => { const list = entries(entriesText); return { total: list.length, unique: new Set(list).size }; }, [entriesText]);

  // Turnstile 状态：token 单次有效，提交后必须 reset；widgetId 供失败重试时 reset。
  const turnstileTokenRef = useRef<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTurnstileToken = useCallback((token: string | null) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
  }, []);
  const onTurnstileReady = useCallback((widgetId: string | null) => {
    widgetIdRef.current = widgetId;
  }, []);

  function onFile(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setEntriesText(String(reader.result || "")); reader.readAsText(file); }

  async function createLottery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = turnstileTokenRef.current;
    if (!token) { setFormError("请先完成人机验证，再提交创建"); return; }
    setCreating(true); setFormError("");
    try {
      const response = await fetch("/api/lotteries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, winnerCount: Number(form.winnerCount), entriesText, "cf-turnstile-response": token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "创建失败");
      setCreated(data.lottery);
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : "创建失败"); }
    finally {
      setCreating(false);
      // token 一次性：请求结束后重置 widget，重试可拿到新 token
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.reset(widgetIdRef.current); } catch { /* widget 已卸载 */ }
      }
      turnstileTokenRef.current = null;
      setTurnstileToken(null);
    }
  }

  const publicLink = created ? window.location.origin + "/?code=" + created.code : "";
  const managementLink = created ? window.location.origin + "/?manage=" + created.code + "&token=" + created.managementToken : "";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-w-0 flex-col gap-8">
          {!created ? (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <Badge variant="secondary">发起抽奖</Badge>
                  <span className="text-xs text-muted-foreground">无需登录，公开可验证</span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">发起抽奖</h1>
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">无需注册，人人可发起。开奖依据截止后的公开信标，无需信任管理员。</p>
              </div>

              <Card>
                <form onSubmit={createLottery}>
                  <CardContent className="flex flex-col gap-6">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="title">抽奖标题</FieldLabel>
                        <Input id="title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：八月社区服务体验名额" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="description">说明 <span className="font-normal text-muted-foreground">可选</span></FieldLabel>
                        <Textarea id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="补充服务时间、领取方式或其他说明" className="min-h-24 resize-y" />
                      </Field>
                    </FieldGroup>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="deadline">截止时间</FieldLabel>
                        <Input id="deadline" type="datetime-local" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="winnerCount">中奖人数</FieldLabel>
                        <Input id="winnerCount" type="number" min="1" max="100" required value={form.winnerCount} onChange={(e) => setForm({ ...form, winnerCount: e.target.value })} />
                      </Field>
                    </div>

                    <Field>
                      <div className="flex items-center justify-between gap-4">
                        <FieldLabel htmlFor="entries">参与值</FieldLabel>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                          <Upload data-icon="inline-start" />
                          上传文件
                          <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="sr-only" />
                        </label>
                      </div>
                      <Textarea id="entries" required value={entriesText} onChange={(e) => setEntriesText(e.target.value)} placeholder={"service-001\nservice-002\nservice-003"} className="min-h-44 resize-y font-mono text-sm" />
                      <p className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                        <span>共 {stats.total} 条</span>
                        <span>唯一 {stats.unique} 条</span>
                        <span>重复 {stats.total - stats.unique} 条</span>
                      </p>
                    </Field>

                    <Field orientation="horizontal" className="mb-3">
                      <FieldContent>
                        <FieldLabel htmlFor="dedupe">自动去重参与值</FieldLabel>
                        <FieldDescription>关闭时，每一行都视为一张独立抽奖票。</FieldDescription>
                      </FieldContent>
                      <Checkbox id="dedupe" checked={form.duplicatePolicy === "dedupe"} onCheckedChange={(checked) => setForm({ ...form, duplicatePolicy: checked ? "dedupe" : "keep" })} />
                    </Field>

                    {formError && (
                      <Alert variant="destructive" className="animate-fade-in">
                        <AlertTitle>无法创建抽奖</AlertTitle>
                        <AlertDescription>{formError}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col items-stretch justify-between gap-4 border-t sm:flex-row sm:items-center">
                    <p className="max-w-md text-xs leading-5 text-muted-foreground">创建后不可修改。管理链接只显示一次，请保存好。</p>
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                      {turnstileSitekey ? (
                        <TurnstileWidget onReady={onTurnstileReady} onToken={onTurnstileToken} />
                      ) : (
                        <p className="text-sm text-muted-foreground">人机验证未配置（缺少 NEXT_PUBLIC_TURNSTILE_SITEKEY）</p>
                      )}
                      <Button type="submit" disabled={creating || !turnstileToken}>{creating ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}创建抽奖</Button>
                    </div>
                  </CardFooter>
                </form>
              </Card>
            </>
          ) : (
            <Card className="animate-fade-in-up">
              <CardHeader className="flex flex-col gap-3">
                <span
                  style={{ animationDelay: "60ms" }}
                  className="animate-pop-in grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground"
                >
                  <Check />
                </span>
                <CardTitle className="text-2xl tracking-tight">抽奖已创建</CardTitle>
                <CardDescription className="max-w-xl">公开页面已可分享。截止后 10 分钟，用管理链接开奖。</CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                <div className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <span className="text-sm text-muted-foreground">抽奖编码</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm">{created.code}</code>
                    <CopyButton value={created.code} label="复制编码" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <span className="text-sm text-muted-foreground">公开页面</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="max-w-[240px] truncate font-mono text-xs">{publicLink}</code>
                    <CopyButton value={publicLink} label="复制链接" />
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <span className="text-sm text-muted-foreground">管理链接</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <code className="max-w-[240px] truncate font-mono text-xs">{managementLink}</code>
                    <CopyButton value={managementLink} label="复制管理链接" />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-3">
                <Button onClick={() => router.push("/?code=" + created.code)}>查看抽奖<ArrowUpRight data-icon="inline-end" /></Button>
                <Button variant="outline" onClick={() => { setCreated(null); setEntriesText(""); }}>再发起一场</Button>
              </CardFooter>
            </Card>
          )}
        </section>

        <aside className="hidden lg:block">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle>创建前须知</CardTitle>
              <CardDescription>创建后即公开，结果可复算。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">01</span>
                <p className="text-sm leading-5">标题、截止时间和名额创建后不可修改。</p>
              </div>
              <div className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">02</span>
                <p className="text-sm leading-5">管理链接只展示一次，请在创建后立即保存。</p>
              </div>
              <div className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-mono text-[10px] text-muted-foreground">03</span>
                <p className="text-sm leading-5">开奖使用公开信标，任何人都能复算结果。</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}