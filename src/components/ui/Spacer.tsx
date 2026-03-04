// src/components/ui/Spacer.tsx
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

type SpacerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface Props {
  size?: SpacerSize;
  horizontal?: boolean;
}

export function Spacer({ size = 'md', horizontal = false }: Props) {
  const theme = useTheme();
  const value = theme.spacing[size];

  return (
    <View
      style={{
        [horizontal ? 'width' : 'height']: value,
      }}
    />
  );
}
