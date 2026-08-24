import Image from "next/image";
import { ArrowUpRight, Sparkles } from "lucide-react";

const links = [
  { href: "/how-it-works", label: "运行原理" },
  { href: "https://axlmc.org", label: "Axolotl Launcher 官网" },
  { href: "https://github.com/axolotl-launcher/AxoDraw", label: "开源仓库 (GitHub)" },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-sm flex-col gap-2">
            <div className="flex items-center gap-2">
              <Image
                src="/axolotl-bucket.png"
                alt="AxoDraw"
                width={28}
                height={28}
                className="size-7 object-contain"
              />
              <span className="text-sm font-semibold tracking-tight">AxoDraw</span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              公开随机信标抽奖，结果人人可复算。
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles data-icon="inline-start" className="size-3.5" />
              由 AI 构建 · 献给开源社区
            </p>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-xs font-medium">链接</p>
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target={link.href.startsWith("/") ? undefined : "_blank"}
                rel={link.href.startsWith("/") ? undefined : "noreferrer"}
                className="group inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
                <ArrowUpRight
                  data-icon="inline-end"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t pt-4 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© AxoDraw · 公开信标 · 可复算抽奖</span>
          <span className="font-mono">powered by drand beacon</span>
        </div>
      </div>
    </footer>
  );
}