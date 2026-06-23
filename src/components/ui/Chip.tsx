// src/components/ui/Chip.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, TouchableOpacityProps, Platform } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';
import type { Theme } from '../../theme/types';

interface Props extends TouchableOpacityProps {
  selected?: boolean;
  color?: string;
  children: string;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    selected: {
      borderColor: 'transparent',
    },
  });
}

export function Chip({
  selected = false,
  color,
  children,
  style,
  ...props
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const backgroundColor = selected
    ? color || theme.colors.primaryLight
    : theme.colors.surface;

  const textColor = selected ? 'primary' : 'textSecondary';

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        selected && styles.selected,
        { backgroundColor },
        Platform.OS === 'web' && ({ cursor: 'pointer' } as any),
        style,
      ]}
      {...props}
    >
      <Text variant="caption" color={textColor as 'primary' | 'textSecondary'}>
        {children}
      </Text>
    </TouchableOpacity>
  );
}
