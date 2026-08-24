"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const active = pathname.startsWith("/create") ? "create" : pathname.startsWith("/how-it-works") ? "how" : "results";

  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:gap-6 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="AxoDraw 首页">
          <Image
            src="/axolotl-bucket.png"
            alt="AxoDraw"
            width={32}
            height={32}
            className="size-8 object-contain transition-transform group-hover:scale-105"
          />
          <span className="hidden text-sm font-semibold tracking-tight sm:block">AxoDraw</span>
        </Link>
        <Tabs value={active} onValueChange={(value) => router.push(value === "create" ? "/create" : value === "how" ? "/how-it-works" : "/")}>
          <TabsList variant="line" className="gap-1">
            <TabsIndicator />
            <TabsTrigger value="results" className="px-3">抽奖结果</TabsTrigger>
            <TabsTrigger value="create" className="px-3">发起抽奖</TabsTrigger>
            <TabsTrigger value="how" className="px-3">运行原理</TabsTrigger>
          </TabsList>
        </Tabs>
        <ThemeToggle />
      </div>
    </header>
  );
}