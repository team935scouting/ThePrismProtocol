"use client";

import Link from "next/link";
import { getSettings } from "@/lib/api";
import { supabaseConfigured } from "@/lib/supabase";
import { useQuery } from "@/lib/useQuery";
import LiquidGlass from "./LiquidGlass";
import styles from "./Hero.module.css";

/** The one-line announcement staff set from Admin → Website. Hidden when empty. */
export default function Announcement() {
  const { data } = useQuery(() => (supabaseConfigured ? getSettings() : Promise.resolve(null)), []);
  const text = data?.announcement?.trim();
  if (!text) return null;

  const body = (
    <>
      {text}
      {data?.announcement_url && (
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  );

  const url = data?.announcement_url;
  return (
    <LiquidGlass
      as={url ? Link : "p"}
      {...(url ? { href: url } : {})}
      tone="dark"
      interactive={Boolean(url)}
      className={styles.announcement}
      bezel={10}
      strength={20}
    >
      {body}
    </LiquidGlass>
  );
}
