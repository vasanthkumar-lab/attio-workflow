import { addBusinessDays, nextSendableTime } from './sending-window';
import { Sequence } from './sequence.types';

/** FAST_DEMO=1 makes 1 business day = 10 seconds and ignores the sending window, for testing. */
export const FAST_DEMO = process.env.FAST_DEMO === '1';

export function scheduleStep(seq: Sequence, from: Date, waitBusinessDays: number): Date {
  if (FAST_DEMO) return new Date(from.getTime() + waitBusinessDays * 10_000);
  return nextSendableTime(addBusinessDays(from, waitBusinessDays, seq.delivery), seq.delivery);
}

export function nextWindowTime(seq: Sequence, at: Date): Date {
  return FAST_DEMO ? at : nextSendableTime(at, seq.delivery);
}