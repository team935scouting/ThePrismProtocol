"use client";

import { useRef, type KeyboardEvent } from "react";
import LiquidGlass from "./LiquidGlass";
import styles from "./Segmented.module.css";

/** A segmented control whose selection is a glass lens sliding over the labels. */
export default function Segmented<K extends string>({
  options,
  value,
  onChange,
  label,
  idPrefix,
  panelId,
  className,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idPrefix: string;
  panelId: string;
  className?: string;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.key === value));

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (index + (e.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
    onChange(options[next].key);
    tabs.current[next]?.focus();
  };

  return (
    <div
      className={[styles.segmented, className].filter(Boolean).join(" ")}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o, i) => (
        <button
          key={o.key}
          ref={(el) => {
            tabs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`${idPrefix}-${o.key}`}
          aria-selected={o.key === value}
          aria-controls={panelId}
          tabIndex={o.key === value ? 0 : -1}
          className={styles.segment}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
      <LiquidGlass
        tone="dark"
        bezel={9}
        strength={18}
        blur={0}
        aria-hidden="true"
        className={styles.thumb}
        style={{
          position: "absolute",
          top: 4,
          left: 4,
          width: `calc((100% - 8px) / ${options.length})`,
          height: "calc(100% - 8px)",
          transform: `translateX(${index * 100}%)`,
        }}
      />
    </div>
  );
}
