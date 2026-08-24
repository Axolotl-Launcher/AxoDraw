import type { CSSProperties } from "react";

const tone = {
  fg: "var(--foreground)",
  mutedFg: "var(--muted-foreground)",
  muted: "var(--muted)",
  border: "var(--border)",
  card: "var(--card)",
  primary: "var(--primary)",
} as const;

const mono: CSSProperties = {
  fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace",
};

const text = (fill: string): CSSProperties => ({ fill, fontWeight: 500 });

/** 时间线：创建 → 截止 → 解锁 → 开奖完成 */
export function TimelineDiagram() {
  const nodes = [
    { x: 170, title: "创建抽奖", sub: "生成编码与管理链接", cap: "参数一次锁定", highlight: false },
    { x: 385, title: "截止时间", sub: "参与窗口结束", cap: "参数不再可改", highlight: false },
    { x: 600, title: "解锁开奖", sub: "截止 + 10 分钟", cap: "drand 信标就绪", highlight: true },
    { x: 815, title: "开奖完成", sub: "写入公开记录", cap: "结果永久可查", highlight: false },
  ] as const;

  return (
    <svg viewBox="0 0 920 210" role="img" aria-label="抽奖时间线示意" className="h-auto w-full">
      <defs>
        <marker id="tl-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: tone.mutedFg }} />
        </marker>
      </defs>
      <line x1={70} y1={118} x2={850} y2={118} stroke={tone.border} strokeWidth={1.5} markerEnd="url(#tl-arrow)" />
      <line x1={391} y1={118} x2={594} y2={118} stroke={tone.primary} strokeWidth={1.5} strokeDasharray="2 6" opacity={0.7} />
      <text x={277.5} y={100} textAnchor="middle" fontSize={12} style={text(tone.mutedFg)}>参与期</text>
      <text x={492.5} y={100} textAnchor="middle" fontSize={12} style={text(tone.mutedFg)}>等待信标</text>
      <text x={707.5} y={100} textAnchor="middle" fontSize={12} style={text(tone.mutedFg)}>结果公开</text>
      {nodes.map((node) => (
        <g key={node.title}>
          <circle
            cx={node.x}
            cy={118}
            r={5.5}
            style={node.highlight ? { fill: tone.primary } : { fill: tone.card, stroke: tone.border, strokeWidth: 1.5 }}
          />
          <text
            x={node.x}
            y={72}
            textAnchor="middle"
            fontSize={16}
            style={node.highlight ? { fill: tone.primary, fontWeight: 600 } : text(tone.fg)}
          >
            {node.title}
          </text>
          <text x={node.x} y={150} textAnchor="middle" fontSize={12} style={text(tone.mutedFg)}>{node.sub}</text>
          <text x={node.x} y={170} textAnchor="middle" fontSize={11} style={{ ...mono, ...text(tone.mutedFg) }}>{node.cap}</text>
        </g>
      ))}
    </svg>
  );
}

/** 结果生成：参与值 + 随机信标 → 确定性算法 → 名单与摘要 */
export function ResultDiagram() {
  return (
    <svg viewBox="0 0 920 200" role="img" aria-label="中奖结果生成示意" className="h-auto w-full">
      <defs>
        <marker id="deter-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: tone.mutedFg }} />
        </marker>
      </defs>
      <g>
        <rect x={20} y={40} width={280} height={44} rx={10} style={{ fill: tone.muted }} />
        <text x={36} y={60} fontSize={13} style={text(tone.fg)}>参与值 entries</text>
        <text x={36} y={78} fontSize={10.5} style={{ ...mono, ...text(tone.mutedFg) }}>service-001 · service-002 · …</text>
      </g>
      <text x={16} y={100} textAnchor="middle" fontSize={18} style={text(tone.mutedFg)}>+</text>
      <g>
        <rect x={20} y={100} width={280} height={44} rx={10} style={{ fill: tone.muted }} />
        <text x={36} y={120} fontSize={13} style={text(tone.fg)}>drand 信标 randomness</text>
        <text x={36} y={138} fontSize={10.5} style={{ ...mono, ...text(tone.mutedFg) }}>f876d09f…fb7a</text>
      </g>
      <path d="M 300 62 L 356 94" stroke={tone.mutedFg} strokeWidth={1.5} fill="none" markerEnd="url(#deter-arrow)" />
      <path d="M 300 122 L 356 110" stroke={tone.mutedFg} strokeWidth={1.5} fill="none" markerEnd="url(#deter-arrow)" />
      <rect x={360} y={40} width={190} height={104} rx={12} style={{ fill: tone.card, stroke: tone.border, strokeWidth: 1.5 }} />
      <text x={455} y={66} textAnchor="middle" fontSize={15} style={text(tone.fg)}>确定性算法</text>
      <rect x={396} y={76} width={118} height={20} rx={10} style={{ fill: tone.muted }} />
      <text x={455} y={89.5} textAnchor="middle" fontSize={10.5} style={{ ...mono, ...text(tone.mutedFg) }}>deterministic-v1</text>
      <text x={455} y={128} textAnchor="middle" fontSize={12} style={text(tone.mutedFg)}>256 位种子洗牌</text>
      <path d="M 550 92 L 596 92" stroke={tone.mutedFg} strokeWidth={1.5} fill="none" markerEnd="url(#deter-arrow)" />
      <rect x={600} y={40} width={250} height={104} rx={12} style={{ fill: tone.card, stroke: tone.border, strokeWidth: 1.5 }} />
      <text x={620} y={66} fontSize={15} style={text(tone.fg)}>中奖名单</text>
      <text x={620} y={92} fontSize={12} style={{ ...mono, ...text(tone.fg) }}>01 · service-003</text>
      <text x={620} y={109} fontSize={12} style={{ ...mono, ...text(tone.fg) }}>02 · service-004</text>
      <text x={620} y={126} fontSize={12} style={{ ...mono, ...text(tone.fg) }}>03 · service-002</text>
      <text x={620} y={166} fontSize={11} style={{ ...mono, ...text(tone.mutedFg) }}>digest = sha256:f9e3cba8…</text>
    </svg>
  );
}

/** 验证回路：取回记录 → 独立复算 → 结果一致 */
export function VerifyDiagram() {
  const steps = [
    { x: 20, number: "01", title: "取回公开记录", sub: "code · entries · randomness" },
    { x: 330, number: "02", title: "独立复算", sub: "重算 digest，重跑洗牌" },
    { x: 640, number: "03", title: "结果一致", sub: "winners 与摘要完全匹配" },
  ] as const;

  return (
    <svg viewBox="0 0 920 210" role="img" aria-label="验证闭环示意" className="h-auto w-full">
      <defs>
        <marker id="vf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: tone.mutedFg }} />
        </marker>
      </defs>
      <path d="M 770 106 C 770 44, 150 44, 150 106" stroke={tone.mutedFg} strokeWidth={1.5} strokeDasharray="4 4" fill="none" markerEnd="url(#vf-arrow)" />
      <text x={460} y={24} textAnchor="middle" fontSize={13} style={text(tone.mutedFg)}>也可以换一种实现：输入相同，结果必然相同</text>
      {steps.map((step) => (
        <g key={step.number}>
          <circle cx={step.x + 28} cy={99} r={11} style={{ fill: tone.muted }} />
          <text x={step.x + 28} y={103.5} textAnchor="middle" fontSize={10} style={{ ...mono, ...text(tone.fg) }}>{step.number}</text>
          <rect x={step.x} y={110} width={260} height={80} rx={12} style={{ fill: tone.card, stroke: tone.border, strokeWidth: 1.5 }} />
          <text x={step.x + 24} y={142} fontSize={15} style={text(tone.fg)}>{step.title}</text>
          <text x={step.x + 24} y={164} fontSize={12} style={{ ...mono, ...text(tone.mutedFg) }}>{step.sub}</text>
        </g>
      ))}
      <path d="M 280 150 L 330 150" stroke={tone.mutedFg} strokeWidth={1.5} fill="none" markerEnd="url(#vf-arrow)" />
      <path d="M 590 150 L 640 150" stroke={tone.mutedFg} strokeWidth={1.5} fill="none" markerEnd="url(#vf-arrow)" />
    </svg>
  );
}