import { formatBeijing } from "@/lib/time";

export type Lottery = {
  code: string;
  title: string;
  description: string;
  deadline: string;
  winnerCount: number;
  duplicatePolicy: "keep" | "dedupe";
  entries: string[];
  status: "scheduled" | "drawn";
  winners: string[];
  entriesCommitment?: string;
  commitmentUpdatedAt?: string;
  managementToken?: string;
  draw?: {
    round: number;
    randomness: string;
    signature: string;
    algorithm: "deterministic-v1" | "deterministic-v2";
    drawnAt: string;
    digest: string;
    entriesCommitment?: string;
  };
};

export type DrawVerification = {
  verified: boolean;
  fair: boolean;
  reason: string;
  checks?: Record<string, boolean>;
  expectedRound?: number;
  expectedCommitment?: string;
};

export const sampleCode = "AXO-7K4M";

export const entries = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

// 全站统一以北京时间为准展示时间，与查看者浏览器时区无关
export const dateLabel = (value: string) => `${formatBeijing(value)}（北京时间）`;
