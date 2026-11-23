import type { DeviceKind } from "@/lib/api";

/* One line-icon family: 24px grid, 1.6 stroke, round joins. */
const PATHS = {
  overview: "M4 10.5 12 4l8 6.5V20H4z M10 20v-5h4v5",
  members:
    "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.8c1.9.7 3.2 2.5 3.5 5.2",
  devices:
    "M3 6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M8 17h3 M18.5 9H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-2.5",
  testing: "M9 3h6 M10 3v6l-5.4 9.4A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.4-2.6L14 9V3 M7.6 15h8.8",
  community: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4.5 4v-4H6a2 2 0 0 1-2-2z",
  account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4.5 20.5c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5",
  software: "M12 3 20 7.5v9L12 21l-8-4.5v-9z M4 7.5 12 12l8-4.5 M12 12v9",
  website:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M3 12h18 M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z",
  teams: "M12 3 19 6v5.5c0 4.3-2.9 7.9-7 9.5-4.1-1.6-7-5.2-7-9.5V6z",
  plus: "M12 5v14 M5 12h14",
  qr: "M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2 M18 14h2v2 M14 18v2h2 M18 18h2v2h-2",
  check: "M5 12.5 10 17l9-10",
  close: "M6 6l12 12 M18 6 6 18",
  chevron: "M9 6l6 6-6 6",
  signout: "M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4 M10 8l-4 4 4 4 M6 12h10",
  vote: "M12 19V6 M6.5 11.5 12 6l5.5 5.5",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4",
  pin: "M9 4h6l-1 6 3 3H7l3-3z M12 16v5",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Line drawings of each device type, for the device tiles. */
export function DeviceGlyph({ kind, size = 64 }: { kind: DeviceKind; size?: number }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {kind === "phone" && (
        <g {...common}>
          <rect x="21" y="6" width="22" height="52" rx="5" />
          <path d="M29 11h6" />
        </g>
      )}
      {kind === "tablet" && (
        <g {...common}>
          <rect x="11" y="9" width="42" height="46" rx="5" />
          <path d="M29 50h6" />
        </g>
      )}
      {kind === "laptop" && (
        <g {...common}>
          <rect x="12" y="14" width="40" height="28" rx="3" />
          <path d="M5 47h54l-3 4H8z" />
        </g>
      )}
      {kind === "pi" && (
        <g {...common}>
          <rect x="8" y="16" width="48" height="32" rx="4" />
          <rect x="18" y="26" width="13" height="13" rx="1.5" />
          <path d="M14 20.5h30" strokeDasharray="1.5 2.6" />
          <path d="M56 24h-6v6h6 M56 34h-6v6h6" />
        </g>
      )}
      {kind === "other" && (
        <g {...common}>
          <rect x="14" y="14" width="36" height="36" rx="9" />
          <circle cx="32" cy="32" r="6" />
        </g>
      )}
    </svg>
  );
}
