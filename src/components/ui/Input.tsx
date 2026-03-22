// src/components/ui/Input.tsx
import React from 'react';
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  View,
  Text,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';
import type { Theme } from '../../theme/types';

interface Props extends TextInputProps {
  error?: boolean;
  prefix?: string;
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    prefix: {
      marginRight: theme.spacing.sm,
      fontSize: theme.fontSizes.base,
      color: theme.colors.textSecondary,
    },
    input: {
      flex: 1,
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

export function Input({ error = false, prefix, style, ...props }: Props) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <View style={styles.container}>
      {prefix && <Text style={styles.prefix}>{prefix}</Text>}
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
    </View>
  );
}
