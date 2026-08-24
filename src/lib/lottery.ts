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
  managementToken?: string;
  draw?: { round: number; randomness: string; signature: string; algorithm: string; drawnAt: string; digest: string };
};

export const sampleCode = "AXO-7K4M";

export const entries = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);

export const dateLabel = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));