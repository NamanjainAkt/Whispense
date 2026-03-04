// src/components/ui/Button.tsx
import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  TouchableOpacityProps,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { Text } from './Text';
import type { Theme } from '../../theme/types';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface Props extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: string;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    base: {
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sm: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    md: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    lg: {
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
    },
    primary: {
      backgroundColor: theme.colors.primary,
    },
    secondary: {
      backgroundColor: theme.colors.surface,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  });
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  children,
  style,
  ...props
}: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);

  const textColor: 'white' | 'text' | 'textMuted' | 'primary' = {
    primary: 'white',
    secondary: 'text',
    outline: 'text',
    ghost: 'textMuted',
  }[variant] as 'white' | 'text' | 'textMuted' | 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[size],
        styles[variant],
        (disabled || loading) && { opacity: 0.6 },
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? theme.colors.white : theme.colors.primary}
          size="small"
        />
      ) : (
        <Text variant="label" color={textColor}>
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}
