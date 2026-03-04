// src/components/ui/Input.tsx
import React from 'react';
import {
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

interface Props extends TextInputProps {
  error?: boolean;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    input: {
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      fontSize: theme.fontSizes.base,
      color: theme.colors.text,
    },
    focused: {
      borderColor: theme.colors.primary,
    },
    error: {
      borderColor: theme.colors.error,
    },
  });
}

export function Input({ error = false, style, ...props }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <TextInput
      style={[
        styles.input,
        isFocused && styles.focused,
        error && styles.error,
        style,
      ]}
      placeholderTextColor={theme.colors.textMuted}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...props}
    />
  );
}
