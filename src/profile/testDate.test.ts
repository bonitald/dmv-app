import { describe, expect, test } from '@jest/globals';
import {
  addDays,
  addMonths,
  countdownFor,
  daysUntil,
  initialPickerDate,
  isSelectable,
  longDateLabel,
  monthGrid,
  parseDateString,
  selectableRange,
  toDateString,
} from './testDate';

// Local-time dates: new Date(y, m - 1, d, h) is 'today' as the device sees it.
const today = new Date(2026, 8, 24, 21, 30); // Sep 24, 2026, 9:30pm local

describe('parseDateString', () => {
  test('accepts a real YYYY-MM-DD date', () => {
    expect(parseDateString('2026-10-22')).toEqual({ year: 2026, month: 10, day: 22 });
  });

  test.each(['2026-02-31', '2026-13-01', '2026-00-10', '2026-1-5', 'next week', '', null, 42])(
    'rejects %p',
    (value) => {
      expect(parseDateString(value)).toBeNull();
    }
  );

  test('accepts Feb 29 only in a leap year', () => {
    expect(parseDateString('2028-02-29')).not.toBeNull();
    expect(parseDateString('2027-02-29')).toBeNull();
  });
});

describe('daysUntil', () => {
  test('counts calendar days, ignoring the time of day', () => {
    expect(daysUntil('2026-10-24', today)).toBe(30);
    expect(daysUntil('2026-09-25', today)).toBe(1);
    expect(daysUntil('2026-09-24', today)).toBe(0);
    expect(daysUntil('2026-09-23', today)).toBe(-1);
  });

  test('is not thrown off by a daylight-saving change in between', () => {
    // US DST ends Nov 1, 2026; a 25-hour day must still count as one day.
    expect(daysUntil('2026-11-02', new Date(2026, 9, 31, 23, 59))).toBe(2);
  });

  test('returns null for a malformed stored value (treated as no date)', () => {
    expect(daysUntil('2026-02-31', today)).toBeNull();
    expect(daysUntil(undefined, today)).toBeNull();
  });
});

describe('countdownFor', () => {
  test('uses the story copy for each case', () => {
    expect(countdownFor(12)).toEqual({ kind: 'days', days: 12, label: 'days until your test' });
    expect(countdownFor(2).kind).toBe('days');
    expect(countdownFor(1).label).toBe('Your test is tomorrow');
    expect(countdownFor(0).label).toBe('Test day — good luck!');
    expect(countdownFor(-3).label).toBe('Your test date has passed');
  });
});

describe('date arithmetic', () => {
  test('addDays rolls over months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('addMonths clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-09-24', 12)).toBe('2027-09-24');
  });

  test('toDateString uses the local calendar date', () => {
    expect(toDateString(today)).toBe('2026-09-24');
  });
});

describe('picker range', () => {
  test('allows today through 12 months ahead', () => {
    expect(selectableRange(today)).toEqual({ min: '2026-09-24', max: '2027-09-24' });
    expect(isSelectable('2026-09-24', today)).toBe(true);
    expect(isSelectable('2027-09-24', today)).toBe(true);
    expect(isSelectable('2026-09-23', today)).toBe(false);
    expect(isSelectable('2027-09-25', today)).toBe(false);
  });

  test('opens about 4 weeks out when nothing is saved', () => {
    expect(initialPickerDate(null, today)).toBe('2026-10-22');
  });

  test('opens on the saved date if it is still selectable, else 4 weeks out', () => {
    expect(initialPickerDate('2026-11-05', today)).toBe('2026-11-05');
    expect(initialPickerDate('2026-09-01', today)).toBe('2026-10-22');
  });
});

describe('monthGrid', () => {
  test('lays out a month in Sunday-first weeks, padded with nulls', () => {
    // Sep 1, 2026 is a Tuesday.
    const grid = monthGrid(2026, 9);
    expect(grid[0]).toEqual([null, null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(grid.flat().filter(Boolean)).toHaveLength(30);
    expect(grid[grid.length - 1]).toEqual(['2026-09-27', '2026-09-28', '2026-09-29', '2026-09-30', null, null, null]);
  });
});

test('longDateLabel names the weekday', () => {
  expect(longDateLabel('2026-10-22')).toBe('Thursday, October 22, 2026');
});
