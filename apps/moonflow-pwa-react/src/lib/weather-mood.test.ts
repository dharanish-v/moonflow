import { describe, expect, it } from 'vitest';
import { WEATHER_MOODS } from './weather-mood';

describe('WEATHER_MOODS', () => {
  it('defines all five cyclePhase moods', () => {
    expect(Object.keys(WEATHER_MOODS).sort()).toEqual(['fertile', 'follicular', 'luteal', 'period', 'unknown']);
  });

  it('makes period the stormiest weather', () => {
    const rain = Object.values(WEATHER_MOODS).map((m) => m.rainIntensity);
    expect(WEATHER_MOODS.period.rainIntensity).toBe(Math.max(...rain));
    const lightning = Object.values(WEATHER_MOODS).map((m) => m.lightningFrequency);
    expect(WEATHER_MOODS.period.lightningFrequency).toBe(Math.max(...lightning));
  });

  it('makes fertile the clearest, calmest weather', () => {
    const rain = Object.values(WEATHER_MOODS).map((m) => m.rainIntensity);
    expect(WEATHER_MOODS.fertile.rainIntensity).toBe(Math.min(...rain));
    expect(WEATHER_MOODS.fertile.lightningFrequency).toBe(0);
  });
});
