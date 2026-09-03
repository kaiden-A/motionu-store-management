"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";
import { useCurrentEvent } from "@/components/event-context";
import { useEvents } from "@/lib/queries";
import { buildNavItems, isNavActive } from "@/components/nav";

export function MobileBottomNav() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const { currentEventId, openEventPicker } = useCurrentEvent();
  const { data: events } = useEvents();
  const [accountOpen, setAccountOpen] = useState(false);

  const isAdmin = !!user?.is_admin;
  const currentEvent = events?.find((e) => e.id === currentEventId);
  const nav = buildNavItems(isAdmin, currentEvent?.id);

  return (
    <>
      {accountOpen && (
        <>
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setAccountOpen(false)}
          />
          <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] right-3 z-40 md:hidden w-52 bg-card border border-line rounded-xl shadow-lg p-1.5">
            <div className="px-2.5 py-2 flex items-center gap-2">
            {user?.picture ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Zitadel/Google avatar URL
              <img
                src={user.picture}
                alt={user.name || "User"}
                className="w-6 h-6 rounded-full object-cover shrink-0"
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-violet/80 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U"}
              </span>
            )}
            <span className="text-[13px] font-semibold text-ink truncate">
              {user?.name || "Account"}
            </span>
          </div>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- full-page logout navigation */}
            <a
              href="/api/auth/logout"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-red hover:bg-paper"
            >
              <i className="fa-solid fa-arrow-right-from-bracket text-[12px]" aria-hidden="true" />
              Log out
            </a>
          </div>
        </>
      )}

      <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-card border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="flex h-14">
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
                className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
                  active ? "text-violet" : "text-ink-soft"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setAccountOpen((o) => !o)}
            aria-label="Account"
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold ${
              accountOpen ? "text-violet" : "text-ink-soft"
            }`}
          >
            <i className="fa-solid fa-user text-[15px]" aria-hidden="true" />
            <span>Account</span>
          </button>
        </div>
      </nav>
    </>
  );
}
