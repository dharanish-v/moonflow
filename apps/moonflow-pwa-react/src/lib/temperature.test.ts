import { describe, expect, it } from 'vitest';
import { defaultTemperatureUnit, displayTemperature, parseTemperature } from './temperature';

describe('temperature (T88)', () => {
  it('parses °C and °F input to stored °C, accepting a comma decimal', () => {
    expect(parseTemperature('36.55', 'C')).toBe(36.55);
    expect(parseTemperature('36,55', 'C')).toBe(36.55);
    expect(parseTemperature('97.9', 'F')).toBe(36.61);
  });

  it('rejects empty or implausible readings', () => {
    expect(parseTemperature('', 'C')).toBeNull();
    expect(parseTemperature('abc', 'C')).toBeNull();
    expect(parseTemperature('30', 'C')).toBeNull();
    expect(parseTemperature('45', 'C')).toBeNull();
    expect(parseTemperature('120', 'F')).toBeNull();
  });

  it('displays stored °C in the chosen unit with sensible precision', () => {
    expect(displayTemperature(36.61, 'C')).toBe('36.61');
    expect(displayTemperature(36.61, 'F')).toBe('97.90');
  });

  it('defaults to °F only where Fahrenheit is the norm', () => {
    expect(defaultTemperatureUnit('en-US')).toBe('F');
    expect(defaultTemperatureUnit('en-GB')).toBe('C');
    expect(defaultTemperatureUnit('ta-IN')).toBe('C');
  });
});
