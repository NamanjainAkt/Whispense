import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label' | 'xs';

interface Props extends React.ComponentProps<typeof RNText> {
  variant?: TextVariant;
  color?: 'text' | 'textSecondary' | 'textMuted' | 'primary' | 'white' | 'error' | 'success' | 'warning' | 'expense' | 'income';
  center?: boolean;
  children: React.ReactNode;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    h1: {
      fontSize: theme.fontSizes.xxxl,
      fontWeight: theme.fontWeights.bold,
      lineHeight: theme.lineHeights.xxxl,
      fontFamily: theme.fonts.bold.fontFamily,
      letterSpacing: -0.5,
    },
    h2: {
      fontSize: theme.fontSizes.xxl,
      fontWeight: theme.fontWeights.semiBold,
      lineHeight: theme.lineHeights.xxl,
      fontFamily: theme.fonts.semiBold.fontFamily,
    },
    h3: {
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.semiBold,
      lineHeight: theme.lineHeights.xl,
      fontFamily: theme.fonts.semiBold.fontFamily,
    },
    body: {
      fontSize: theme.fontSizes.base,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.base,
      fontFamily: theme.fonts.regular.fontFamily,
    },
    caption: {
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.sm,
      fontFamily: theme.fonts.regular.fontFamily,
    },
    label: {
      fontSize: theme.fontSizes.md,
      fontWeight: theme.fontWeights.medium,
      lineHeight: theme.lineHeights.md,
      fontFamily: theme.fonts.medium.fontFamily,
    },
    xs: {
      fontSize: theme.fontSizes.xs,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.xs,
      fontFamily: theme.fonts.regular.fontFamily,
    },
    center: {
      textAlign: 'center',
    },
  });
}

export function Text({
  variant = 'body',
  color = 'text',
  center = false,
  style,
  children,
  ...props
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const colorValue = {
    text: theme.colors.text,
    textSecondary: theme.colors.textSecondary,
    textMuted: theme.colors.textMuted,
    primary: theme.colors.primary,
    white: theme.colors.white,
    error: theme.colors.error,
    success: theme.colors.success,
    warning: theme.colors.warning,
    expense: theme.colors.expense,
    income: theme.colors.income,
  }[color];

  return (
    <RNText
      style={[
        styles[variant],
        { color: colorValue },
        center && styles.center,
        style,
      ]}
      {...props}
    >
      {children}
    </RNText>
  );
}
