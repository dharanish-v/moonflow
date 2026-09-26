// Mood id → icon component, kept out of icons.tsx so that file exports only
// components (React fast refresh).
import { MoodCryIcon, MoodHappyIcon, MoodNeutralIcon, MoodSadIcon, MoodSmileIcon } from './icons';

export const MOOD_ICONS = {
  cry: MoodCryIcon,
  sad: MoodSadIcon,
  neutral: MoodNeutralIcon,
  smile: MoodSmileIcon,
  happy: MoodHappyIcon,
} as const;
