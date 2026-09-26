// src/lib/temperature.ts — basal body temperature (T88). Always stored in °C
// (two decimals); shown and typed in the user's unit.
export type TemperatureUnit = 'C' | 'F';

/** Plausible waking body temperatures; anything outside is a typo. */
const MIN_C = 34;
const MAX_C = 43;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function parseTemperature(input: string, unit: TemperatureUnit): number | null {
  const s = input.trim().replace(',', '.');
  if (!/^\d{2,3}(\.\d{1,3})?$/.test(s)) return null;
  const value = Number(s);
  const celsius = unit === 'F' ? ((value - 32) * 5) / 9 : value;
  return celsius >= MIN_C && celsius <= MAX_C ? round2(celsius) : null;
}

export function isPlausibleCelsius(c: unknown): c is number {
  return typeof c === 'number' && Number.isFinite(c) && c >= MIN_C && c <= MAX_C;
}

export function displayTemperature(celsius: number, unit: TemperatureUnit): string {
  return (unit === 'F' ? (celsius * 9) / 5 + 32 : celsius).toFixed(2);
}

/** Fahrenheit where it's the everyday unit (US and a few others), else °C. */
export function defaultTemperatureUnit(locale: string = navigator.language): TemperatureUnit {
  const region = locale.split('-')[1]?.toUpperCase();
  return region && ['US', 'LR', 'MM', 'BS', 'BZ', 'KY', 'PW', 'FM', 'MH'].includes(region) ? 'F' : 'C';
}
