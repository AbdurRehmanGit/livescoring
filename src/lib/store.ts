import { useSyncExternalStore } from "react";
import type { InningsEvent, MatchSetup, Team } from "./engine";

export type AppState = {
  teams: [Team, Team];
  overs: number;
  setup: MatchSetup | null;
  events: [InningsEvent[], InningsEvent[]];
  savedMatchId: string | null;
};

const KEY = "live-scoring-state-v1";
const uid = () => crypto.randomUUID();

export const newTeam = (name: string, color: string): Team => ({ id: uid(), name, color, players: [] });

const initial = (): AppState => ({
  teams: [newTeam("Team 1", "#ff8a00"), newTeam("Team 2", "#22d3ee")],
  overs: 6,
  setup: null,
  events: [[], []],
  savedMatchId: null,
});

let state: AppState = initial();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...initial(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
}

export function setState(fn: (s: AppState) => AppState) {
  load();
  state = fn(state);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function getState() {
  load();
  return state;
}

const serverSnapshot = initial();
export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => getState(),
    () => serverSnapshot,
  );
}

export function resetMatch() {
  setState((s) => ({ ...s, setup: null, events: [[], []], savedMatchId: null }));
}

export function pushEvent(e: InningsEvent, inning: 0 | 1) {
  setState((s) => {
    const ev: [InningsEvent[], InningsEvent[]] = [[...s.events[0]], [...s.events[1]]];
    ev[inning].push(e);
    return { ...s, events: ev };
  });
}

export function undoEvent(inning: 0 | 1) {
  setState((s) => {
    const ev: [InningsEvent[], InningsEvent[]] = [[...s.events[0]], [...s.events[1]]];
    if (ev[inning].length) ev[inning].pop();
    else if (inning === 1 && ev[0].length) ev[0].pop();
    return { ...s, events: ev };
  });
}

export { uid };
