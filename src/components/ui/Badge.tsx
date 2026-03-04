// src/components/ui/Badge.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';
import type { Theme } from '../../theme/types';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';

interface Props {
  variant?: BadgeVariant;
  children: string;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    badge: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: theme.borderRadius.sm,
    },
  });
}

export function Badge({ variant = 'default', children }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const backgroundColors = {
    default: theme.colors.surface,
    primary: theme.colors.primaryLight,
    success: `${theme.colors.success}20`,
    warning: `${theme.colors.warning}20`,
    error: `${theme.colors.error}20`,
  };

  const textColors = {
    default: 'textSecondary',
    primary: 'primary',
    success: 'success',
    warning: 'warning',
    error: 'error',
  } as const;

  return (
    <View style={[styles.badge, { backgroundColor: backgroundColors[variant] }]}>
      <Text variant="xs" color={textColors[variant]}>
        {children}
      </Text>
    </View>
  );
}
