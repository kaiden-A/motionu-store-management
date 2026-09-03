"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";
import { useEvents } from "@/lib/queries";
import { Logo } from "@/components/logo";
import { buildNavItems, isNavActive } from "@/components/nav";

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { currentEventId, openEventPicker } = useCurrentEvent();
  const { data: events } = useEvents();

  const isAdmin = !!user?.is_admin;

  const currentEvent = events?.find((e) => e.id === currentEventId);
  const nav = buildNavItems(isAdmin, currentEvent?.id);

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 bg-ink text-white flex-col p-5 sticky top-0 h-screen">
      <div className="flex items-center gap-2.5 px-1 pb-6">
        <Logo size={34} className="rounded-lg" />
        <div className="leading-tight">
          <span className="font-display font-bold text-[15px] tracking-tight block">
            Motion-U PinPoint
          </span>
          <span className="text-[10px] text-white/55 tracking-wide uppercase">
            Events Sales Management
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {nav.map((item) => {
          const active = isNavActive(pathname, item);
          const needsEvent = item.href === "/events" && item.label !== "Events";
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={(e) => {
                if (needsEvent) {
                  e.preventDefault();
                  openEventPicker(item.label.toLowerCase() as "sell" | "setup" | "stats");
                }
              }}
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
          <div className="flex items-center gap-2.5 px-1.5 pb-2.5">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Zitadel/Google avatar URL
              <img
                src={user.picture}
                alt={user.name || "User"}
                className="w-[28px] h-[28px] rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-[28px] h-[28px] rounded-full bg-violet/80 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                {user.name
                  ? user.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U"}
              </span>
            )}
            <span className="text-xs text-white/60 truncate">{user.name}</span>
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full-page logout navigation */}
        <a
          href="/api/auth/logout"
          className="w-full flex items-center gap-2.5 text-left px-3 py-2 rounded-lg text-[13px] font-medium text-white/75 border border-white/15 hover:bg-white/8 hover:text-white"
        >
          <i className="fa-solid fa-arrow-right-from-bracket text-[13px]" aria-hidden="true" />
          Log out
        </a>
      </div>
    </aside>
  );
}
