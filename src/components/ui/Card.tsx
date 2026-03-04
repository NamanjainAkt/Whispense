// src/components/ui/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

interface Props extends ViewProps {
  children: React.ReactNode;
  shadow?: 'none' | 'light' | 'medium' | 'heavy';
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
    },
    none: {},
    light: theme.shadows.light,
    medium: theme.shadows.medium,
    heavy: theme.shadows.heavy,
  });
}

export function Card({ children, shadow = 'light', style, ...props }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.base, styles[shadow], style]} {...props}>
      {children}
    </View>
  );
}
