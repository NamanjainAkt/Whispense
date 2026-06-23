// src/components/ui/IconButton.tsx
import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

type IconButtonSize = 'sm' | 'md' | 'lg';

interface Props extends TouchableOpacityProps {
  size?: IconButtonSize;
  children: React.ReactNode;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
    },
    sm: {
      width: 32,
      height: 32,
      borderRadius: theme.borderRadius.sm,
    },
    md: {
      width: 44,
      height: 44,
      borderRadius: theme.borderRadius.md,
    },
    lg: {
      width: 56,
      height: 56,
      borderRadius: theme.borderRadius.lg,
    },
  });
}

export function IconButton({
  size = 'md',
  children,
  style,
  ...props
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <TouchableOpacity style={[styles.button, styles[size], style]} {...props}>
      {children}
    </TouchableOpacity>
  );
}
