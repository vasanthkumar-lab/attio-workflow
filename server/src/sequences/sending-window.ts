import { DateTime } from 'luxon';
import { DeliverySettings } from './sequence.types';

const isOffDay = (t: DateTime, w: DeliverySettings) => w.businessDaysOnly && t.weekday >= 6; // 6 = Sat, 7 = Sun

/** Earliest moment at or after `from` that is inside the sending window. */
export function nextSendableTime(from: Date, w: DeliverySettings): Date {
  let t = DateTime.fromJSDate(from, { zone: w.timezone });
  for (let i = 0; i < 14; i++) {
    const start = t.set({ hour: w.startHour, minute: 0, second: 0, millisecond: 0 });
    const end = t.set({ hour: w.endHour, minute: 0, second: 0, millisecond: 0 });
    if (!isOffDay(t, w)) {
      if (t < start) return start.toJSDate();
      if (t < end) return t.toJSDate();
    }
    t = start.plus({ days: 1 });
  }
  return t.toJSDate();
}

/** Moves forward `days` days, skipping weekends when businessDaysOnly is on. */
export function addBusinessDays(from: Date, days: number, w: DeliverySettings): Date {
  let t = DateTime.fromJSDate(from, { zone: w.timezone });
  let left = days;
  while (left > 0) {
    t = t.plus({ days: 1 });
    if (!isOffDay(t, w)) left--;
  }
  return t.toJSDate();
}

export function isInsideWindow(at: Date, w: DeliverySettings): boolean {
  return nextSendableTime(at, w).getTime() === at.getTime();
}