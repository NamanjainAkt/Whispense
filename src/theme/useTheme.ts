import { useColorScheme } from 'react-native';
import { lightTheme, darkTheme } from './theme';
import type { Theme } from './types';

export function useTheme(): Theme {
  const colorScheme = useColorScheme();
  return colorScheme === 'dark' ? darkTheme : lightTheme;
}
