import { DateTime } from 'luxon';
import { addBusinessDays, nextSendableTime } from './sending-window';
import { DeliverySettings } from './sequence.types';

const w: DeliverySettings = { timezone: 'Asia/Kolkata', startHour: 9, endHour: 17, businessDaysOnly: true };
const ist = (s: string) => DateTime.fromFormat(s, 'yyyy-MM-dd HH:mm', { zone: w.timezone }).toJSDate();

describe('sending window (09:00-17:00 IST, business days)', () => {
  it.each([
    ['inside window stays', '2026-11-23 10:30', '2026-11-23 10:30'], // Monday
    ['before window -> 09:00 same day', '2026-11-23 07:00', '2026-11-23 09:00'],
    ['after window -> 09:00 next day', '2026-11-23 18:00', '2026-11-24 09:00'],
    ['Friday evening -> Monday 09:00', '2026-11-27 19:00', '2026-11-30 09:00'],
    ['Saturday -> Monday 09:00', '2026-11-28 11:00', '2026-11-30 09:00'],
  ])('%s', (_name, input, expected) => {
    expect(nextSendableTime(ist(input), w)).toEqual(ist(expected));
  });

  it('Monday + 3 business days = Thursday', () => {
    expect(addBusinessDays(ist('2026-11-23 10:00'), 3, w)).toEqual(ist('2026-11-26 10:00'));
  });

  it('Thursday + 3 business days skips the weekend = Tuesday', () => {
    expect(addBusinessDays(ist('2026-11-26 10:00'), 3, w)).toEqual(ist('2026-12-01 10:00'));
  });

  it('counts calendar days when businessDaysOnly is off', () => {
    expect(addBusinessDays(ist('2026-11-27 10:00'), 1, { ...w, businessDaysOnly: false })).toEqual(ist('2026-11-28 10:00'));
  });
});