// src/theme/useTheme.ts
import { theme } from './theme';
import type { Theme } from './types';

export function useTheme(): Theme {
  // Future: Add dark mode support here
  // const colorScheme = useColorScheme();
  // return colorScheme === 'dark' ? darkTheme : theme;

  return theme;
}
