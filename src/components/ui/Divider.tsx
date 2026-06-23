// src/components/ui/Divider.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

interface Props {
  horizontal?: boolean;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    divider: {
      backgroundColor: theme.colors.border,
    },
    vertical: {
      width: 1,
      height: '100%',
    },
    horizontal: {
      height: 1,
      width: '100%',
    },
  });
}

export function Divider({ horizontal = true }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={[styles.divider, horizontal ? styles.horizontal : styles.vertical]} />
  );
}
