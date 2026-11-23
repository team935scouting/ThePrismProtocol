"use client";

import dynamic from "next/dynamic";

// Pairing reads the URL and this browser's saved device token, so it only renders client-side.
const Pair = dynamic(() => import("./Pair"), { ssr: false });

export default function PairLoader() {
  return <Pair />;
}
