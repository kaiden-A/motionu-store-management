"use client";

import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";

export function AppShell({
  children,
  withTopbar = true,
}: {
  children: ReactNode;
  withTopbar?: boolean;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {withTopbar && <Topbar />}
        <div className="flex-1 px-7 py-7 pb-16">{children}</div>
      </main>
    </div>
  );
}

export function ViewHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-5 gap-3">
      <h2 className="font-display text-[22px] font-bold">{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({
  mark,
  title,
  children,
}: {
  mark: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="max-w-[420px] mx-auto mt-14 text-center px-8 py-8 bg-card rounded-[14px] border border-dashed border-line">
      <div className="text-[30px] mb-1">{mark}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-ink-soft my-2 leading-relaxed">{children}</p>
    </div>
  );
}
