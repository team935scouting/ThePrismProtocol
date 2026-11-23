import type { Metadata } from "next";
import PairLoader from "@/components/pair/PairLoader";

export const metadata: Metadata = {
  title: "Pair a device — Prism",
  description: "Add this phone or tablet to your team's Prism devices.",
  robots: { index: false },
};

export default function PairPage() {
  return <PairLoader />;
}
