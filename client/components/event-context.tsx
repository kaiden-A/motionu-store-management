"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const STORAGE_KEY = "pinpoint_current_event";

interface EventSelectionContextValue {
  currentEventId: string | null;
  setCurrentEventId: (id: string) => void;
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

  const setCurrentEventId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return (
    <EventSelectionContext.Provider value={{ currentEventId, setCurrentEventId }}>
      {children}
    </EventSelectionContext.Provider>
  );
}

export function useCurrentEvent() {
  const ctx = useContext(EventSelectionContext);
  if (!ctx) throw new Error("useCurrentEvent must be used within EventSelectionProvider");
  return ctx;
}
