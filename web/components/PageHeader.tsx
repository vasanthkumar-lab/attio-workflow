"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  /** Rendered under the title row, e.g. a Tabs strip. */
  children?: ReactNode;
}) {
  return (
    <header className={cx("shrink-0 border-b border-line bg-surface px-6 pt-4", className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-1.5 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink"
        >
          <ChevronLeft size={13} />
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** The scrolling area below a PageHeader. */
export function PageBody({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cx("min-h-0 flex-1 overflow-y-auto", padded && "p-6", className)}>
      {children}
    </div>
  );
}
