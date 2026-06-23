// src/components/ui/ProgressBar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

interface Props {
  progress: number;
  color?: 'primary' | 'success' | 'warning' | 'error';
  height?: number;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.full,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: theme.borderRadius.full,
    },
  });
}

export function ProgressBar({
  progress,
  color = 'primary',
  height = 8,
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const fillColors = {
    primary: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  };

  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return (
    <View style={[styles.container, { height }]}>
      <View
        style={[
          styles.fill,
          { width: `${clampedProgress * 100}%`, backgroundColor: fillColors[color] },
        ]}
      />
    </View>
  );
}
