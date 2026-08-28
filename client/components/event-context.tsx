"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pinpoint_current_event";

export type EventView = "sell" | "setup" | "stats";

interface EventSelectionContextValue {
  currentEventId: string | null;
  setCurrentEventId: (id: string) => void;
  pendingView: EventView | null;
  openEventPicker: (view: EventView) => void;
  closeEventPicker: () => void;
}

const EventSelectionContext = createContext<EventSelectionContextValue | null>(null);

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

export function EventSelectionProvider({ children }: { children: ReactNode }) {
  const currentEventId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pendingView, setPendingView] = useState<EventView | null>(null);

  const setCurrentEventId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const openEventPicker = useCallback((view: EventView) => {
    setPendingView(view);
  }, []);

  const closeEventPicker = useCallback(() => {
    setPendingView(null);
  }, []);

  return (
    <EventSelectionContext.Provider
      value={{ currentEventId, setCurrentEventId, pendingView, openEventPicker, closeEventPicker }}
    >
      {children}
    </EventSelectionContext.Provider>
  );
}

export function useCurrentEvent() {
  const ctx = useContext(EventSelectionContext);
  if (!ctx) throw new Error("useCurrentEvent must be used within EventSelectionProvider");
  return ctx;
}
