// src/lib/ics.ts — T67. Reminders without a server: an iCalendar file of the
// next predicted periods, each with an alarm, that iOS Calendar imports and
// then notifies for natively. Web push would need a relay; this needs nothing.
//
// Neutral by default: calendar events sync to iCloud and show on the lock
// screen, so nothing in a neutral file says "period" (or names the app).
import { addDays } from './cycle-math';

export function upcomingPeriods(nextDate: string, typicalCycle: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(nextDate, i * typicalCycle));
}

const compact = (d: string) => d.replace(/-/g, '');
const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function buildIcs({ dates, neutral, now }: { dates: string[]; neutral: boolean; now: Date }): string {
  const summary = neutral ? 'Reminder' : 'Period expected';
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const d of dates) {
    lines.push(
      'BEGIN:VEVENT',
      // Stable per date: importing an updated file replaces, not duplicates.
      `UID:reminder-${compact(d)}@local.invalid`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(d)}`,
      `DTEND;VALUE=DATE:${compact(addDays(d, 1))}`,
      `SUMMARY:${summary}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${summary}`,
      // All-day events start at midnight: -15h = 9am the day before.
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR', '');
  return lines.join('\r\n');
}
