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
    title: "名单公开承诺",
    text: "标题、截止时间和中奖人数创建时固定；名单每次修改都会更新公开 commitment，截止后锁定。",
  },
  {
    icon: Timer,
    title: "信标决定结果",
    text: "使用哪一轮随机数由截止时间算出，与谁点、何时点开奖无关。",
  },
  {
    icon: Database,
    title: "结果公开验证",
    text: "随机数、签名、名单承诺、摘要与中奖名单都在公开页面，随时可查。",
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
  { number: "01", text: "生成承诺：按固定 JSON 字段顺序编码全部抽奖参数和参与值，commitment = sha256(canonical lottery)。" },
  { number: "02", text: "生成种子：digest = sha256(randomness | commitment | \"deterministic-v2\")。用 digest 作为 HMAC-SHA-256 密钥，通过递增计数器生成相互独立的随机块。" },
  { number: "03", text: "无偏洗牌：对每一步使用拒绝采样得到等概率下标，再执行 Fisher–Yates；记录名单、commitment、digest、round、randomness 与 signature。" },
];

const verifySteps = [
  { number: "01", text: "由截止时间重新计算唯一 round，向 drand 获取该轮记录，并用固定 quicknet 公钥验证 BLS 签名。" },
  { number: "02", text: "规范化全部抽奖参数与 entries，重算 commitment、digest，并用 deterministic-v2 重跑无偏洗牌。" },
  { number: "03", text: "只有 round、signature、randomness、commitment、digest 与 winners 全部一致，才显示验证通过。" },
];

const limits = [
  "开奖需要管理链接手动触发，目前没有自动开奖。链接丢失或持有者不操作，就不会产生结果；但只要开奖，结果与操作者无关。",
  "参与值由创建者填写，截止前可凭管理链接修改，截止后锁定。参与者应在截止前保存公开 commitment，开奖后再核对。",
  "数据库内的 commitment 不是独立时间戳。没有提前保存 commitment 的人，仍需信任部署方没有同时改写数据库内容和时间；高价值场景需要外部只追加透明日志。",
  "公开源码不等于部署证明。GitHub 仓库本身不能证明线上服务器运行的是同一份构建。",
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 lg:px-8 lg:pt-14">
      <div className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">运行原理</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">抽奖如何做到公开可验证</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          一场抽奖从创建到开奖，公开随机信标、名单承诺与确定性算法；任何人都能复算结果，并清楚看到系统仍保留的部署方信任边界。
        </p>
      </div>

      <section className="mt-10 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">一场抽奖的完整流程</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            创建时锁定标题、截止时间与中奖人数；截止前可修改参与值并更新 commitment，截止 10 分钟后开奖解锁，结果由固定的 drand 轮次唯一确定并写入公开记录。
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
              unlockAt 是截止时间加 10 分钟；1692803367 是 quicknet 网络的起始时间（2023-08-23）。服务端不接受调用者指定 round、randomness 或 signature，而是从固定 chain hash 拉取目标轮次，并验证 quicknet 公钥、轮次、randomness 派生关系和 BLS 签名。
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
          deterministic-v2 不再使用旧版有低位相关性的 LCG。HMAC 计数器为每一步生成新随机块，拒绝采样保证每个交换下标拥有相同数量的 256 位原像；相同输入仍会得到唯一、可复算的名单。
        </p>
      </section>

      <section className="mt-14 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">如何验证一场抽奖</h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            验证不只复算网站给出的摘要，还会重新获取目标 drand 轮次并核验签名。拿到公开记录后可以按同样步骤独立检查：
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
