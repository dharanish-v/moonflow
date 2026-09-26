import { describe, expect, it } from 'vitest';
import { buildCsv } from './csv';
import type { Entry } from './types';

describe('buildCsv', () => {
  it('writes a readable header and one row per day, oldest first', () => {
    const entries: Entry[] = [
      { date: '2026-09-02', flow: 'light', symptoms: [], mood: 'happy', note: '', tags: ['Pill taken'], updatedAt: 0 },
      { date: '2026-09-01', flow: 'medium', symptoms: ['cramps', 'tender_breasts'], mood: null, note: 'ok', temperature: 36.55, mucus: 'creamy', updatedAt: 0 },
    ];
    expect(buildCsv(entries).split('\r\n')).toEqual([
      'Date,Flow,Symptoms,Mood,Tags,Temperature (°C),Mucus,Note',
      '2026-09-01,Medium,Cramps; Tender breasts,,,36.55,Creamy,ok',
      '2026-09-02,Light,,Very happy,Pill taken,,,',
    ]);
  });

  it('quotes fields with commas, quotes or newlines', () => {
    const csv = buildCsv([{ date: '2026-09-01', flow: null, symptoms: [], mood: null, note: 'a, "b"\nc', updatedAt: 0 }]);
    expect(csv.split('\r\n')[1]).toBe('2026-09-01,,,,,,,"a, ""b""\nc"');
  });

  it('neutralises spreadsheet formula injection', () => {
    const csv = buildCsv([{ date: '2026-09-01', flow: null, symptoms: [], mood: null, note: '=HYPERLINK("x")', updatedAt: 0 }]);
    expect(csv.split('\r\n')[1]).toBe(`2026-09-01,,,,,,,"'=HYPERLINK(""x"")"`);
  });
});
