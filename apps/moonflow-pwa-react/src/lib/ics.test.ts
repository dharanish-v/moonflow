import { describe, expect, it } from 'vitest';
import { buildIcs, upcomingPeriods } from './ics';

describe('upcomingPeriods', () => {
  it('projects the next few periods from the forecast\'s typical cycle', () => {
    expect(upcomingPeriods('2026-10-20', 28, 3)).toEqual(['2026-10-20', '2026-11-17', '2026-12-15']);
  });
});

describe('buildIcs', () => {
  const ics = buildIcs({ dates: ['2026-10-20', '2026-11-17'], neutral: true, now: new Date(Date.UTC(2026, 8, 26, 12)) });
  const lines = ics.split('\r\n');

  it('is a valid iCalendar file with CRLF line endings', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines).toContain('VERSION:2.0');
    expect(lines.at(-2)).toBe('END:VCALENDAR');
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('makes one all-day event per date, with a reminder the day before at 9am', () => {
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(lines).toContain('DTSTART;VALUE=DATE:20261020');
    expect(lines).toContain('DTEND;VALUE=DATE:20261021');
    expect(lines).toContain('TRIGGER:-PT15H');
    expect(lines).toContain('BEGIN:VALARM');
  });

  it('uses a neutral title by default — calendar events sync to iCloud', () => {
    expect(lines).toContain('SUMMARY:Reminder');
    expect(ics).not.toMatch(/period|moonflow|cycle/i);
  });

  it('can use a descriptive title when asked', () => {
    expect(buildIcs({ dates: ['2026-10-20'], neutral: false, now: new Date() })).toMatch(/SUMMARY:Period expected/);
  });

  it('uses stable UIDs so re-importing updates instead of duplicating', () => {
    const again = buildIcs({ dates: ['2026-10-20', '2026-11-17'], neutral: true, now: new Date() });
    const uids = (s: string) => s.split('\r\n').filter((l) => l.startsWith('UID:'));
    expect(uids(again)).toEqual(uids(ics));
  });
});
