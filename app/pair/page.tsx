import type { Metadata } from "next";
import PairLoader from "@/components/pair/PairLoader";

export const metadata: Metadata = {
  title: "Pair a beta device — The Prism Protocol",
  description: "Add this phone or tablet to your team's beta portal.",
  robots: { index: false },
};

export default function PairPage() {
  return <PairLoader />;
}
