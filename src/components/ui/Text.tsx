// src/components/ui/Text.tsx
import React from 'react';
import { Text as RNText, StyleSheet, TextProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

type TextVariant = 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label' | 'xs';

interface Props extends TextProps {
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
    },
    h2: {
      fontSize: theme.fontSizes.xxl,
      fontWeight: theme.fontWeights.semiBold,
      lineHeight: theme.lineHeights.xxl,
    },
    h3: {
      fontSize: theme.fontSizes.xl,
      fontWeight: theme.fontWeights.semiBold,
      lineHeight: theme.lineHeights.xl,
    },
    body: {
      fontSize: theme.fontSizes.base,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.base,
    },
    caption: {
      fontSize: theme.fontSizes.sm,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.sm,
    },
    label: {
      fontSize: theme.fontSizes.md,
      fontWeight: theme.fontWeights.medium,
      lineHeight: theme.lineHeights.md,
    },
    xs: {
      fontSize: theme.fontSizes.xs,
      fontWeight: theme.fontWeights.regular,
      lineHeight: theme.lineHeights.xs,
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
