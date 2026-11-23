import type { Metadata } from "next";
import Admin from "@/components/admin/Admin";

export const metadata: Metadata = {
  title: "Admin — Prism",
  robots: { index: false },
};

export default function AdminPage() {
  return <Admin />;
}
