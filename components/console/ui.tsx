"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import LiquidGlass from "../LiquidGlass";
import { Icon } from "./Icon";
import s from "./console.module.css";

export { s as styles };

/* ---------- Buttons, badges, switches ---------- */

type Variant = "primary" | "secondary" | "plain" | "danger";

export function Button({
  variant = "secondary",
  size,
  className,
  ...rest
}: { variant?: Variant; size?: "small" } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[s.btn, s[variant], size === "small" && s.small, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}

export function Badge({ tone, children }: { tone?: "green" | "orange" | "blue" | "red"; children: ReactNode }) {
  return (
    <span className={s.badge} data-tone={tone}>
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={s.switch}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={s.select} {...props} />;
}

export function TextField({ label, ...input }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={s.field}>
      <span>{label}</span>
      <input className={s.input} {...input} />
    </label>
  );
}

export function TextArea({ label, ...input }: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={s.field}>
      <span>{label}</span>
      <textarea className={s.input} {...input} />
    </label>
  );
}

/* ---------- Layout pieces ---------- */

export function PageHead({ title, lead, action }: { title: string; lead?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.headRow}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {lead && <p className={s.lead}>{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={s.section}>
      {title && (
        <h2 className={s.sectionTitle}>
          {title}
          {aside && <small>{aside}</small>}
        </h2>
      )}
      {children}
    </section>
  );
}

export function Group({ children }: { children: ReactNode }) {
  return <div className={s.group}>{children}</div>;
}

export function Row({
  title,
  sub,
  lead,
  end,
  onClick,
}: {
  title: ReactNode;
  sub?: ReactNode;
  lead?: ReactNode;
  end?: ReactNode;
  onClick?: () => void;
}) {
  const body = (
    <>
      {lead}
      <div className={s.rowMain}>
        <div className={s.rowTitle}>{title}</div>
        {sub && <div className={s.rowSub}>{sub}</div>}
      </div>
      {end && <div className={s.rowEnd}>{end}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${s.row} ${s.rowButton}`} onClick={onClick}>
        {body}
        <Icon name="chevron" size={16} className={s.rowSub} />
      </button>
    );
  }
  return <div className={s.row}>{body}</div>;
}

export function Avatar({ name, email }: { name?: string | null; email?: string | null }) {
  const source = (name || email || "?").trim();
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return (
    <span className={s.avatar} aria-hidden="true">
      {initials}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className={s.empty}>
      <strong>{title}</strong>
      {children && <div>{children}</div>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "grid", gap: 8 }} aria-label="Loading" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={s.skeleton} />
      ))}
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className={s.error} role="alert">
      {message}
    </p>
  );
}

/* ---------- Sheet ---------- */

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={s.sheet}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      {open && (
        <div className={s.sheetInner}>
          <div className={s.sheetHead}>
            <h2>{title}</h2>
            <button type="button" className={s.close} onClick={onClose} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* ---------- Toasts: one short line, floating on glass ---------- */

type Toast = { id: number; text: string; kind: "ok" | "error" };
const ToastContext = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, kind: Toast["kind"] = "ok") => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, kind });
    timer.current = setTimeout(() => setToast(null), kind === "error" ? 5000 : 2600);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite">
        {toast && (
          <LiquidGlass key={toast.id} tone="dark" className={s.toast} data-kind={toast.kind} bezel={12} strength={24}>
            {toast.kind === "ok" ? <Icon name="check" size={16} /> : null}
            {toast.text}
          </LiquidGlass>
        )}
      </div>
    </ToastContext.Provider>
  );
}

/** Runs an action, reports success or failure as a toast, and returns whether it worked. */
export function useAction() {
  const toast = useContext(ToastContext);
  return useCallback(
    async (fn: () => Promise<unknown>, done?: string) => {
      try {
        await fn();
        if (done) toast(done);
        return true;
      } catch (err) {
        toast(err instanceof Error ? err.message : "Something went wrong.", "error");
        return false;
      }
    },
    [toast],
  );
}

/* ---------- Dates ---------- */

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
export function ago(iso: string | null | undefined) {
  if (!iso) return "Never";
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.35, "week"],
    [12, "month"],
    [Infinity, "year"],
  ];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}
