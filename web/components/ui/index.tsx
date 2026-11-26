"use client";

import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ComponentPropsWithRef, type CSSProperties, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { cx } from "@/lib/format";
import type { Tone } from "@/lib/catalog";

// ------------------------------------------------------------------- Button

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-ink hover:border-accent-ink",
  secondary: "bg-surface text-ink border-line-strong hover:bg-raised",
  ghost: "bg-transparent text-muted border-transparent hover:bg-line/60 hover:text-ink",
  danger: "bg-surface text-bad border-line-strong hover:bg-bad-soft hover:border-bad/40",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium whitespace-nowrap",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-3.5 text-[13px]",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/** A square icon-only button, used on canvas nodes and table rows. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...rest}
      title={label}
      aria-label={label}
      className={cx(
        "inline-grid h-7 w-7 place-items-center rounded-md text-muted transition-colors",
        "hover:bg-line/70 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent",
        className,
      )}
    >
      {children}
    </button>
  );
}

// -------------------------------------------------------------- form fields

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-bad">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const CONTROL =
  "w-full rounded-lg border border-line-strong bg-surface px-2.5 text-[13px] text-ink " +
  "placeholder:text-faint transition-colors hover:border-faint " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:bg-raised disabled:text-muted";

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input {...rest} className={cx(CONTROL, "h-9", className)} />;
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...rest} className={cx(CONTROL, "resize-y py-2 leading-relaxed", className)} />;
}

export function Select({
  className,
  children,
  ...rest
}: ComponentPropsWithRef<"select">) {
  return (
    <div className="relative">
      <select {...rest} className={cx(CONTROL, "h-9 cursor-pointer appearance-none pr-8", className)}>
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:opacity-50",
        checked
          ? "border-accent bg-accent"
          : "border-line-strong bg-line-strong hover:bg-faint",
      )}
    >
      {/* Positioned with `left` rather than a transform: the knob is 16px in a 36px track,
          so the two stops are 2px and 18px and can never overhang the edge. */}
      <span
        className={cx(
          "absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-sm transition-[left] duration-150",
          checked ? "left-[18px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

/** A labelled switch row, the shape Attio uses throughout its settings panels. */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
        checked || indeterminate
          ? "border-accent bg-accent text-white"
          : "border-line-strong bg-surface hover:border-faint",
      )}
    >
      {indeterminate ? (
        <span className="h-0.5 w-2 rounded bg-white" />
      ) : checked ? (
        <Check size={11} strokeWidth={3} />
      ) : null}
    </button>
  );
}

// -------------------------------------------------------------------- Badge

const TONE_BADGE: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent-ink",
  violet: "bg-violet-soft text-violet",
  muted: "bg-canvas text-muted ring-1 ring-line",
};

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "muted" }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    good: "bg-good", warn: "bg-warn", bad: "bg-bad",
    accent: "bg-accent", violet: "bg-violet", muted: "bg-faint",
  };
  return <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", colors[tone])} />;
}

// --------------------------------------------------------------------- misc

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cx(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft",
        "text-[11px] font-semibold text-accent-ink",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 size={16} className={cx("animate-spin text-faint", className)} />;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface shadow-card", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && (
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-faint ring-1 ring-line">
          {icon}
        </span>
      )}
      <div>
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function ErrorNote({ children, className }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p className={cx("rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad", className)}>
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-faint">{children}</h3>
  );
}

// --------------------------------------------------------------------- Tabs

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { id: T; label: string; count?: number; icon?: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div className={cx("flex items-center gap-1 border-b border-line", className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cx(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.icon && (
              <span className={active ? "text-accent" : "text-faint"}>{tab.icon}</span>
            )}
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded bg-canvas px-1 text-[11px] text-muted ring-1 ring-line">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------------- Modal

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/25 p-4 pt-[10vh] backdrop-blur-[1px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("w-full rounded-xl border border-line bg-surface shadow-pop", width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-1 -mt-0.5">
            <X size={16} />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Dropdown

const MenuContext = createContext<{ close: () => void }>({ close: () => {} });

const MENU_GAP = 4;
const MENU_EDGE = 8;

/**
 * The panel is rendered in a portal on <body> and positioned against the trigger,
 * so an ancestor with overflow-hidden - the rounded cards the lists sit in - cannot
 * clip it. It flips to the other side of the trigger when there is no room.
 */
export function Menu({
  trigger,
  children,
  align = "right",
  placement = "below",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  align?: "left" | "right";
  /** "above" opens upward, for controls docked to the bottom of the screen. */
  placement?: "below" | "above";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>();
  const [dark, setDark] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;

    const fitsBelow = window.innerHeight - r.bottom >= height + MENU_GAP + MENU_EDGE;
    const fitsAbove = r.top >= height + MENU_GAP + MENU_EDGE;
    const above = placement === "above" ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;

    const next: CSSProperties = { position: "fixed" };
    if (above) {
      next.bottom = window.innerHeight - r.top + MENU_GAP;
      next.maxHeight = r.top - MENU_GAP - MENU_EDGE;
    } else {
      next.top = r.bottom + MENU_GAP;
      next.maxHeight = window.innerHeight - r.bottom - MENU_GAP - MENU_EDGE;
    }
    if (align === "right") next.right = Math.max(MENU_EDGE, window.innerWidth - r.right);
    else next.left = Math.max(MENU_EDGE, r.left);

    // The canvas builder is dark while the rest of the app is light. The portal sits
    // outside that wrapper, so carry the scope across or the menu renders light on dark.
    setDark(Boolean(anchor.closest(".canvas-dark")));
    setStyle(next);
  }, [align, placement]);

  useEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }
    place();

    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    // Capture phase, so scrolling a panel the trigger sits in repositions it too.
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  return (
    <div ref={anchorRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <MenuContext.Provider value={{ close: () => setOpen(false) }}>
            <div
              ref={panelRef}
              // Measured before it is placed, so keep it out of sight for that first frame.
              style={{ position: "fixed", visibility: style ? "visible" : "hidden", ...style }}
              className={cx(
                "z-40 min-w-48 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-pop",
                dark && "canvas-dark",
                className,
              )}
            >
              {children}
            </div>
          </MenuContext.Provider>,
          document.body,
        )}
    </div>
  );
}

export function MenuItem({
  children,
  onClick,
  tone = "default",
  icon,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  icon?: ReactNode;
}) {
  const { close } = useContext(MenuContext);
  return (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        close();
      }}
      className={cx(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        tone === "danger" ? "text-bad hover:bg-bad-soft" : "text-ink hover:bg-canvas",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
      {children}
    </p>
  );
}
