import { Colors } from '@/constants/theme';

// Light-only theme — dark mode disabled app-wide per design requirements.
export function useTheme() {
  return Colors['light'];
}
