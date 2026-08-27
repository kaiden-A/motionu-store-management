"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";
import { useEvents } from "@/lib/queries";

const NAV = [
  {
    href: "/events",
    label: "Events",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L4 3a1 1 0 0 0-1 1l.24 5.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.82Z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Sell",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 2-1.58l1.65-7.42H5.12" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Setup",
    admin: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" x2="4" y1="21" y2="14" /><line x1="4" x2="4" y1="10" y2="3" />
        <line x1="12" x2="12" y1="21" y2="12" /><line x1="12" x2="12" y1="8" y2="3" />
        <line x1="20" x2="20" y1="21" y2="16" /><line x1="20" x2="20" y1="12" y2="3" />
        <line x1="2" x2="6" y1="14" y2="14" /><line x1="10" x2="14" y1="8" y2="8" /><line x1="18" x2="22" y1="16" y2="16" />
      </svg>
    ),
  },
  {
    href: "/events",
    label: "Stats",
    admin: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" />
      </svg>
    ),
  },
  {
    href: "/preorders",
    label: "Pre-orders",
    admin: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { currentEventId } = useCurrentEvent();
  const { data: events } = useEvents();

  const isAdmin = !!user?.is_admin;

  const currentEvent = events?.find((e) => e.id === currentEventId);
  const eventSuffix = currentEvent ? `/events/${currentEvent.id}` : "/events";

  const nav = NAV.filter((n) => !n.admin || isAdmin).map((n) => ({
    ...n,
    href: n.href === "/events" && n.label !== "Events" ? `${eventSuffix}/${n.label.toLowerCase()}` : n.href,
  }));

  return (
    <aside className="w-[220px] shrink-0 bg-ink text-white flex flex-col p-5 sticky top-0 h-screen">
      <div className="flex items-center gap-2 px-2.5 pb-6">
        <span className="w-[30px] h-[30px] bg-violet rounded-lg flex items-center justify-center text-[15px] -rotate-8">
          📌
        </span>
        <span className="font-display font-bold text-lg tracking-tight">PinPoint</span>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-violet text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/15 pt-3">
        {user && (
          <div className="px-3 pb-2 text-xs text-white/60 truncate">{user.name}</div>
        )}
        <a
          href="/api/auth/logout"
          className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium text-white/75 border border-white/15 hover:bg-white/8 hover:text-white"
        >
          Log out
        </a>
      </div>
    </aside>
  );
}
