import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Beta from "@/components/Beta";

export const metadata: Metadata = {
  title: "Developer beta — Prism",
  description: "Create an account for the Prism developer beta, or sign in to an existing one.",
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
