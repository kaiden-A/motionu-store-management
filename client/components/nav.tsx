import type { ReactNode } from "react";

export interface NavItem {
  href: string;
  label: string;
  admin?: boolean;
  icon: ReactNode;
}

export const NAV: NavItem[] = [
  {
    href: "/events",
    label: "Events",
    icon: <i className="fa-solid fa-calendar-days text-[15px]" aria-hidden="true" />,
  },
  {
    href: "/events",
    label: "Sell",
    icon: <i className="fa-solid fa-cart-shopping text-[15px]" aria-hidden="true" />,
  },
  {
    href: "/events",
    label: "Setup",
    admin: true,
    icon: <i className="fa-solid fa-sliders text-[15px]" aria-hidden="true" />,
  },
  {
    href: "/events",
    label: "Stats",
    admin: true,
    icon: <i className="fa-solid fa-chart-line text-[15px]" aria-hidden="true" />,
  },
  {
    href: "/preorders",
    label: "Pre-orders",
    admin: true,
    icon: <i className="fa-solid fa-boxes-stacked text-[15px]" aria-hidden="true" />,
  },
];

export function buildNavItems(isAdmin: boolean, eventId?: string): NavItem[] {
  return NAV.filter((n) => !n.admin || isAdmin).map((n) => ({
    ...n,
    href:
      n.href === "/events" && n.label !== "Events"
        ? eventId
          ? `/events/${n.label.toLowerCase()}/${eventId}`
          : "/events"
        : n.href,
  }));
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/events") {
    return item.label === "Events" && pathname === "/events";
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
