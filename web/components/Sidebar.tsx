"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GitBranch, House, Mail, Send, Users } from "lucide-react";
import { cx } from "@/lib/format";

const NAV = [
  { href: "/", label: "Home", icon: House, exact: true },
  { href: "/people", label: "People", icon: Users },
  { href: "/sequences", label: "Sequences", icon: Mail },
  { href: "/outbox", label: "Outbox", icon: Send },
  { href: "/workflows", label: "Workflows", icon: GitBranch },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex w-[216px] shrink-0 flex-col gap-1 border-r border-line bg-surface px-3 py-3">
      <Link href="/" className="mb-3 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-canvas/70">
        <Image
          src="/hyring-logo.webp"
          alt=""
          width={28}
          height={28}
          priority
          className="h-7 w-7 shrink-0 rounded-lg object-contain"
        />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">Hyring</p>
          <p className="truncate text-[11px] text-faint">Sales CRM</p>
        </div>
      </Link>

      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cx(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-colors",
              active ? "bg-canvas text-ink" : "text-muted hover:bg-canvas/70 hover:text-ink",
            )}
          >
            <Icon size={16} className={active ? "text-accent" : "text-faint"} />
            {label}
          </Link>
        );
      })}

      <div className="mt-auto rounded-lg bg-canvas px-2.5 py-2">
        <p className="text-[11px] font-medium text-muted">Automations</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-faint">
          Workflows decide what happens. Sequences do the following up.
        </p>
      </div>
    </nav>
  );
}
