import { create } from 'zustand';
import { track } from './analytics';

/** Bump the version when the risk disclosure changes materially, so everyone accepts it again. */
const KEY = 'hood.riskAccepted.v1';

type RiskStore = {
  /** Accepted in this browser (or this session, when storage is unavailable). */
  accepted: boolean;
  /** The launch or trade waiting for the user to accept. */
  pending: (() => void) | null;
  accept(): void;
  dismiss(): void;
};

function readAccepted(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(KEY) != null;
  } catch {
    return false;
  }
}

export const useRisk = create<RiskStore>((set, get) => ({
  accepted: false,
  pending: null,
  accept() {
    try {
      window.localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Private window or blocked storage: accepted for this session only.
    }
    const run = get().pending;
    set({ accepted: true, pending: null });
    track('risk_accepted');
    run?.();
  },
  dismiss: () => set({ pending: null }),
}));

/**
 * Runs `action` once the one-time risk disclosure is accepted (docs/BRIEF.md §5.10): straight away
 * when it already was, otherwise after the user accepts the dialog. Gates every launch and trade.
 */
export function withRiskAccepted(action: () => void) {
  const s = useRisk.getState();
  if (s.accepted || readAccepted()) {
    if (!s.accepted) useRisk.setState({ accepted: true });
    action();
  } else {
    useRisk.setState({ pending: action });
  }
}
