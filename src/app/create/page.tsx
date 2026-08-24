import type { Metadata } from "next";
import { CreateDraw } from "@/components/create-draw";

export const metadata: Metadata = { title: "发起抽奖" };

export default function CreatePage() {
  return <CreateDraw />;
}