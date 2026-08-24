"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const modes = [
  { value: "light", label: "浅色模式", icon: Sun },
  { value: "dark", label: "深色模式", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const;

type ThemeMode = "light" | "dark" | "system";

type Rect = { left: number; top: number; width: number; height: number };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Rect | null>(null);
  const [ready, setReady] = useState(false);
  const measuredRef = useRef(false);

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // 挂载前固定渲染 "system"，确保服务端与客户端首帧一致，避免 hydration 报错
  const value: ThemeMode = (mounted && theme) ? theme as ThemeMode : "system";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mounted) return;

    let raf = 0;
    function measure() {
      raf = 0;
      const root = containerRef.current;
      if (!root) return;
      // 按钮可能被 TooltipTrigger 包裹，data-slot 会被覆盖；用 aria-pressed 定位选中项
      const pressed = Array.from(root.querySelectorAll<HTMLElement>("[aria-pressed]")).find(
        (item) => item.getAttribute("aria-pressed") === "true"
      );
      if (!pressed) return;
      const box = root.getBoundingClientRect();
      const item = pressed.getBoundingClientRect();
      setThumb({ left: item.left - box.left, top: item.top - box.top, width: item.width, height: item.height });
      if (!measuredRef.current) {
        measuredRef.current = true;
        // 首帧测量后启用过渡，避免初始定位被"滑入"
        requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
      }
    }

    measure();
    const onResize = () => { raf = requestAnimationFrame(measure); };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [mounted, value]);

  return (
    <div ref={containerRef} className="relative">
      <ToggleGroup
        aria-label="明暗主题"
        spacing={1}
        className="rounded-full border border-border bg-background p-0.5"
        value={[value]}
        onValueChange={(values) => { const next = values[0]; if (next) setTheme(next); }}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute z-0 rounded-full bg-muted",
            thumb ? "opacity-100" : "opacity-0",
            ready ? "transition-[left,top,width,height] duration-300 ease-out-expo" : "transition-none"
          )}
          style={thumb ? { left: thumb.left, top: thumb.top, width: thumb.width, height: thumb.height } : undefined}
        />
        {modes.map((mode) => (
          <Tooltip key={mode.value}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={mode.value}
                  aria-label={mode.label}
                  className="relative size-6 min-w-6 rounded-full px-0 text-muted-foreground transition-[color,background-color,transform] duration-200 hover:text-foreground data-pressed:scale-90 data-pressed:text-foreground [&_svg:not([class*='size-'])]:size-3.5"
                >
                  <mode.icon />
                </ToggleGroupItem>
              }
            />
            <TooltipContent>{mode.label}</TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </div>
  );
}