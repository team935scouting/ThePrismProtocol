import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Beta from "@/components/Beta";

export const metadata: Metadata = {
  title: "Developer beta — The Prism Protocol",
  description: "Try The Prism Protocol with your team's scouting data and share feedback.",
};

export default function BetaPage() {
  return (
    <>
      <Nav />
      <main>
        <Beta />
      </main>
    </>
  );
}
