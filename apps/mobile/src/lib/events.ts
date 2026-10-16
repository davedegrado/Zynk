import type { ZynkEvent } from '@zynk/shared';

type Listener = (z: IncomingZynk) => void;
export interface IncomingZynk {
  zynk: ZynkEvent;
  /** Server-resolved sound for this recipient (from push data), if known. */
  soundId?: string | null;
}

const listeners = new Set<Listener>();
const shown = new Set<string>();

/** In-app "you got a Speow" bus. Each Speow is announced at most once. */
export const incomingZynks = {
  emit(z: IncomingZynk) {
    if (shown.has(z.zynk.id)) return;
    shown.add(z.zynk.id);
    if (shown.size > 500) shown.clear();
    listeners.forEach((l) => l(z));
  },
  markKnown(id: string) {
    shown.add(id);
  },
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
