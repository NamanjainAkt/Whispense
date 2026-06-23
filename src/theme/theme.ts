import { Platform } from 'react-native';

export const colors = {
  primary: '#0F766E',
  primaryLight: '#CCFBF1',
  primaryDark: '#115E59',

  secondary: '#14B8A6',
  accent: '#F59E0B',

  background: '#F3F4F6',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  text: '#111827',
  textSecondary: '#4B5563',
  textMuted: '#9CA3AF',

  border: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#E5E7EB',

  success: '#059669',
  warning: '#F59E0B',
  error: '#DC2626',

  income: '#059669',
  expense: '#DC2626',
};

export const darkColors: typeof colors = {
  primary: '#14B8A6',
  primaryLight: '#134E4A',
  primaryDark: '#0F766E',

  secondary: '#2DD4BF',
  accent: '#FBBF24',

  background: '#030712',
  surface: '#111827',
  card: '#1F2937',

  text: '#F9FAFB',
  textSecondary: '#D1D5DB',
  textMuted: '#6B7280',

  border: '#374151',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  shimmer: '#374151',

  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',

  income: '#34D399',
  expense: '#F87171',
};

export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

export const lineHeights = {
  xs: 14,
  sm: 16,
  md: 20,
  base: 24,
  lg: 28,
  xl: 28,
  xxl: 32,
  xxxl: 40,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

const fontFamily = Platform.select({
  ios: 'PlusJakartaSans_400Regular',
  android: 'PlusJakartaSans_400Regular',
  default: 'System',
});

const fontFamilyMedium = Platform.select({
  ios: 'PlusJakartaSans_500Medium',
  android: 'PlusJakartaSans_500Medium',
  default: 'System',
});

const fontFamilySemiBold = Platform.select({
  ios: 'PlusJakartaSans_600SemiBold',
  android: 'PlusJakartaSans_600SemiBold',
  default: 'System',
});

const fontFamilyBold = Platform.select({
  ios: 'PlusJakartaSans_700Bold',
  android: 'PlusJakartaSans_700Bold',
  default: 'System',
});

export const fonts = {
  regular: { fontFamily },
  medium: { fontFamily: fontFamilyMedium },
  semiBold: { fontFamily: fontFamilySemiBold },
  bold: { fontFamily: fontFamilyBold },
};

export const createShadows = (shadowColor: string) => ({
  light: {
    shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  heavy: {
    shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
});

export const lightTheme = {
  colors,
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
  borderRadius,
  shadows: createShadows(colors.black),
  fonts,
  isDark: false,
};

export const darkTheme = {
  colors: darkColors,
  fontSizes,
  fontWeights,
  lineHeights,
  spacing,
  borderRadius,
  shadows: createShadows(darkColors.black),
  fonts,
  isDark: true,
};

export type Theme = typeof lightTheme;
