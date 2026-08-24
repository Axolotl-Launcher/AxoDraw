"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(element: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

// 公开 sitekey，可安全暴露给浏览器（配置见 .env.local / .env.example）
export const turnstileSitekey =
  process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? "";

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined" || window.turnstile)
    return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () =>
        window.turnstile
          ? resolve()
          : reject(new Error("Turnstile 脚本加载失败"));
      script.onerror = () => reject(new Error("Turnstile 脚本加载失败"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

interface TurnstileWidgetProps {
  onReady: (widgetId: string | null) => void;
  onToken: (token: string | null) => void;
}

/**
 * 显式渲染的 Turnstile widget（managed 模式，action=create-lottery）。
 * token 是单次有效的：提交后由父组件调用 window.turnstile.reset(widgetId)
 * 以便重试时拿到新 token；组件卸载时调用 remove 清理。
 */
export function TurnstileWidget({ onReady, onToken }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!turnstileSitekey) return;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        let id: string;
        try {
          id = window.turnstile.render(containerRef.current, {
            sitekey: turnstileSitekey,
            action: "create-lottery",
            theme: "auto",
            callback: (token: string) => {
              if (!cancelled) onToken(token);
            },
            "expired-callback": () => {
              if (!cancelled) onToken(null);
            },
            "error-callback": () => {
              if (!cancelled) onToken(null);
            },
          });
        } catch {
          onToken(null);
          return;
        }
        mountedIdRef.current = id;
        onReady(id);
      })
      .catch(() => onToken(null));

    return () => {
      cancelled = true;
      if (mountedIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(mountedIdRef.current);
        } catch {
          // widget 已不存在，忽略
        }
        mountedIdRef.current = null;
      }
      onReady(null);
    };
  }, [onReady, onToken]);

  return (
    <div ref={containerRef} className="min-h-16" aria-label="人机验证" />
  );
}