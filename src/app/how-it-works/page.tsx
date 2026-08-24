import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Database, Globe, Hash, KeyRound, Lock, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResultDiagram, TimelineDiagram, VerifyDiagram } from "@/components/how-it-works-diagrams";

export const metadata: Metadata = {
  title: "运行原理",
  description: "AxoDraw 的随机性来源、确定性算法与验证方法。",
};

const features = [
  {
    icon: Lock,
    title: "创建即锁定",
    text: "标题、截止时间、参与值、中奖人数在创建时固定，之后不可修改。",
  },
  {
    icon: Timer,
    title: "信标决定结果",
    text: "使用哪一轮随机数由截止时间算出，与谁点、何时点开奖无关。",
  },
  {
    icon: Database,
    title: "结果永久公开",
    text: "随机数、签名、摘要与中奖名单都在公开页面，随时可查。",
  },
];

const beaconFacts = [
  {
    icon: Globe,
    title: "每 3 秒一轮",
    text: "全网同一序列，任何人都能向 drand 官方 API 随时查询。",
  },
  {
    icon: KeyRound,
    title: "门限签名",
    text: "多个独立节点共同签名，单一节点无法提前知道或篡改输出。",
  },
  {
    icon: Hash,
    title: "轮次由时间决定",
    text: "round 从截止时间直接算出，不接收任何人为指定。",
  },
];

const drawSteps = [
  { number: "01", text: "计算摘要：把所有关键输入烙进一个散列值，digest = sha256(randomness | code | entries | \"deterministic-v1\")。" },
  { number: "02", text: "洗牌：以 digest 为种子，用 256 位线性同余生成器产生伪随机数，对参与值逐位交换（Fisher–Yates），取前 N 名。" },
  { number: "03", text: "记录：中奖名单、digest、round、randomness、signature 一并写入公开记录。" },
];

const verifySteps = [
  { number: "01", text: "从公开页面复制 code、entries、randomness 与 digest。" },
  { number: "02", text: "用任意语言按上面的两步重算 digest 并重跑洗牌。" },
  { number: "03", text: "与页面记录比对：名单相同、摘要一致，即通过。" },
];

const limits = [
  "开奖需要管理链接手动触发，目前没有自动开奖。链接丢失或持有者不操作，就不会产生结果；但只要开奖，结果与操作者无关。",
  "信任模型是「记录公开、算法确定」，而不是信任网站或管理员。任何能复算的人都应该自己验一遍。",
  "参与值由创建者填写，创建后锁定。创建时填了什么，开奖就用什么。",
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">运行原理</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">抽奖如何做到公开可验证</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          一场抽奖从创建到开奖，不依赖任何人的信用：结果由公开的 drand 随机信标决定，任何人随时都能复算。
        </p>
      </div>

      <section className="mt-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">一场抽奖的完整流程</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            创建时所有参数一次锁定；截止 10 分钟后开奖解锁，结果由那一刻的 drand 信标唯一确定，并永久写入公开记录。
          </p>
        </div>
        <figure className="rounded-2xl border bg-card p-4 sm:p-6">
          <TimelineDiagram />
        </figure>
        <div className="grid gap-4 sm:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-5">
              <span className="grid size-8 place-items-center rounded-xl bg-muted text-foreground">
                <feature.icon className="size-4" />
              </span>
              <p className="text-sm font-semibold">{feature.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">随机数从哪里来：drand 公开信标</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            drand 是无人掌控的去中心化随机信标网络，每 3 秒发布一个新随机值。它由多个独立节点门限签名产生，任何一方都无法提前知道或篡改输出。
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {beaconFacts.map((fact) => (
            <div key={fact.title} className="flex flex-col gap-2.5 rounded-2xl border bg-card p-5">
              <span className="grid size-8 place-items-center rounded-xl bg-muted text-foreground">
                <fact.icon className="size-4" />
              </span>
              <p className="text-sm font-semibold">{fact.title}</p>
              <p className="text-xs leading-5 text-muted-foreground">{fact.text}</p>
            </div>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-2 p-5">
            <p className="text-xs font-medium">开奖轮次由截止时间直接算出：</p>
            <pre className="overflow-x-auto rounded-2xl border bg-muted/40 p-4 font-mono text-xs leading-6 text-muted-foreground">
              round = ⌊(unlockAt − 1692803367) / 3⌋ + 1
            </pre>
            <p className="text-xs leading-5 text-muted-foreground">
              unlockAt 是截止时间加 10 分钟；1692803367 是 quicknet 网络的起始时间（2023-08-23）。开奖时从 drand 官方 API 拉取该轮信标，记录中保存的 round、randomness、signature 都可随时与官方 API 核对。
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">结果如何产生：完全确定性的算法</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            中奖名单不是随机过程，而是把公开随机数喂给一个固定算法算出来的。输入一样，输出永远一样。
          </p>
        </div>
        <figure className="rounded-2xl border bg-card p-4 sm:p-6">
          <ResultDiagram />
        </figure>
        <ol className="flex flex-col gap-3">
          {drawSteps.map((step) => (
            <li key={step.number} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-2xl bg-muted font-mono text-[10px] text-muted-foreground">{step.number}</span>
              <p className="min-w-0 flex-1 text-sm leading-6">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          因为算法完全公开且确定，任何人用相同输入重跑一遍，拿到的必定是同一个名单——这就是「可复算」。
        </p>
      </section>

      <section className="mt-14 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">如何验证一场抽奖</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            不需要信任网站，也不需要信任管理员。拿到公开记录，自己动手验一遍：
          </p>
        </div>
        <figure className="rounded-2xl border bg-card p-4 sm:p-6">
          <VerifyDiagram />
        </figure>
        <ol className="flex flex-col gap-3">
          {verifySteps.map((step) => (
            <li key={step.number} className="flex gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-2xl bg-muted font-mono text-[10px] text-muted-foreground">{step.number}</span>
              <p className="min-w-0 flex-1 text-sm leading-6">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-14 flex flex-col gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">它不承诺什么</h2>
        <ul className="flex flex-col gap-3">
          {limits.map((limit) => (
            <li key={limit} className="flex gap-3 text-sm leading-6">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
              <span className="max-w-2xl">{limit}</span>
            </li>
          ))}
        </ul>
      </section>

      <Card className="mt-14">
        <CardContent className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">想亲眼看一次？</p>
            <p className="text-xs leading-5 text-muted-foreground">
              示例抽奖 AXO-7K4M 已开奖，公开页面包含完整的 randomness、signature 与 digest。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button nativeButton={false} render={<Link href="/?code=AXO-7K4M" />}>查看示例抽奖<ArrowUpRight data-icon="inline-end" /></Button>
            <Button variant="outline" nativeButton={false} render={<Link href="/create" />}>发起抽奖</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}