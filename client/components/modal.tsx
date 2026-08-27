"use client";

import { useEffect, type ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/45 backdrop-blur-[2px] p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-card w-full max-w-[440px] max-h-[88vh] overflow-y-auto rounded-[14px] shadow-xl">
        <div className="px-6 pt-5 pb-1">
          <h3 className="font-display text-lg font-bold">{title}</h3>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3.5">{children}</div>
        {footer && <div className="flex justify-end gap-2.5 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      <span>
        {label} {optional && <span className="font-normal text-ink-soft text-xs">(optional)</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "px-3 py-2.5 border border-line rounded-lg bg-paper font-normal text-ink focus:border-violet focus:bg-white outline-none";
