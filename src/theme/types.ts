export interface ThemeColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  white: string;
  black: string;
  overlay: string;
  shimmer: string;
  success: string;
  warning: string;
  error: string;
  income: string;
  expense: string;
}

export interface FontSizes {
  xs: number;
  sm: number;
  md: number;
  base: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface FontWeights {
  regular: '400' | 'normal';
  medium: '500';
  semiBold: '600';
  bold: '700' | 'bold';
}

export interface LineHeights {
  xs: number;
  sm: number;
  md: number;
  base: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
}

export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
}

export interface BorderRadius {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export interface Shadows {
  light: ShadowStyle;
  medium: ShadowStyle;
  heavy: ShadowStyle;
}

export interface FontStyles {
  regular: { fontFamily: string };
  medium: { fontFamily: string };
  semiBold: { fontFamily: string };
  bold: { fontFamily: string };
}

export interface Theme {
  colors: ThemeColors;
  fontSizes: FontSizes;
  fontWeights: FontWeights;
  lineHeights: LineHeights;
  spacing: Spacing;
  borderRadius: BorderRadius;
  shadows: Shadows;
  fonts: FontStyles;
  isDark: boolean;
}
